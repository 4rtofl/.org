// GitHub の 4rtofl のトップ（組織のプロフィール）に載せる、図の画像（SVG）を作る。
// 4rtofl/.github の profile/README.md が、https://4rtofl.org/github/map-light.svg と map-dark.svg を読む。
// README の画像は <img> として開かれ、外のフォントも JavaScript も読めないので、フォントは中に埋め込み、操作のない図だけを描く。
// 開いたときに線を中心から描いていく動きは、サイトと同じにする。
// ビルドのとき（vite.config.ts）に作るので、Node.js でだけ動く。

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { actors, categories, flows, org, projects } from "./data.ts";
import { layoutMap } from "./layout.ts";
import {
	catLabels,
	dialTicks,
	esc,
	hubInner,
	leaderLines,
	n2,
	nameLabel,
	portLine,
	satGroup,
	trackPaths,
} from "./render.ts";

export type ProfileTheme = "light" | "dark";

/** サイトと同じ色（style.css の :root と同じ値） */
const COLORS: Record<
	ProfileTheme,
	{ paper: string; ink: string; ink2: string; ink3: string; rule: string }
> = {
	light: {
		paper: "#f2f1ec",
		ink: "#121317",
		ink2: "#55565b",
		ink3: "#8f8f8a",
		rule: "rgb(18 19 23 / 0.3)",
	},
	dark: {
		paper: "#0e0f11",
		ink: "#ecebe6",
		ink2: "#a2a29d",
		ink3: "#6c6c69",
		rule: "rgb(236 235 230 / 0.28)",
	},
};

const require = createRequire(import.meta.url);
const fontData = (file: string) =>
	readFileSync(require.resolve(file)).toString("base64");

function style(theme: ProfileTheme): string {
	const c = COLORS[theme];
	const sans = fontData(
		"@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
	);
	const mono = fontData(
		"@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
	);
	const ease = "cubic-bezier(.2,.7,.1,1)";
	return [
		`@font-face{font-family:"Geist";font-weight:100 900;src:url(data:font/woff2;base64,${sans}) format("woff2")}`,
		`@font-face{font-family:"Geist Mono";font-weight:100 900;src:url(data:font/woff2;base64,${mono}) format("woff2")}`,
		`text{font-family:"Geist",system-ui,sans-serif;fill:${c.ink}}`,
		`.bg{fill:${c.paper}}`,
		".node-hit,.hub-hit,.hub-caption-path{fill:none}",
		`.orbit{fill:none;stroke:${c.rule};stroke-width:1}`,
		`.tick{stroke:${c.ink3};stroke-width:.7;opacity:.55}`,
		`.tick-major{stroke:${c.ink};stroke-width:1;opacity:.9}`,
		`.track{fill:none;stroke:${c.ink};stroke-width:1.15;stroke-linecap:round;opacity:.78}`,
		`.leader,.port{stroke:${c.ink3};stroke-width:1;stroke-dasharray:1 3.2;stroke-linecap:round}`,
		`.node-dot{fill:${c.ink};stroke:${c.paper};stroke-width:3.5;paint-order:stroke}`,
		`.node:not([data-status="active"]) .node-dot{fill:${c.paper};stroke:${c.ink};stroke-width:1.2}`,
		".node-name{font-weight:620;letter-spacing:-.02em}",
		`.sat-box{fill:${c.paper};stroke:${c.ink};stroke-width:1.2}`,
		'.sat-name,.cat-label,.hub-caption{font-family:"Geist Mono",ui-monospace,monospace}',
		".sat-name{font-size:11.5px;font-weight:650;letter-spacing:.12em}",
		`.cat-label{font-size:9px;letter-spacing:.18em;fill:${c.ink2}}`,
		`.hub-ring{fill:${c.paper};stroke:${c.ink};stroke-width:1.15}`,
		`.hub-mark{color:${c.ink}}`,
		`.hub-caption{font-size:7.5px;letter-spacing:.24em;fill:${c.ink2}}`,
		"@media (prefers-reduced-motion:no-preference){",
		`.hub-ring{animation:draw .9s ${ease} .05s backwards}`,
		`.hub-mark,.hub-caption{animation:fade .9s ${ease} .15s backwards}`,
		`.track{animation:draw 1.15s ${ease} calc(.3s + var(--i) * 45ms) backwards}`,
		`.orbit{animation:draw 1.6s ${ease} .2s backwards}`,
		".tick,.leader{animation:fade .8s ease .9s backwards}",
		".port{animation:fade .8s ease 1.2s backwards}",
		`.node-dot,.sat-box{animation:pop .5s ${ease} calc(.95s + var(--i) * 40ms) backwards;transform-box:fill-box;transform-origin:center}`,
		`.node-name,.sat-name{animation:fade .7s ${ease} calc(1.05s + var(--i) * 40ms) backwards}`,
		`.cat-label{animation:fade .7s ${ease} .9s backwards}`,
		"}",
		"@keyframes draw{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}",
		"@keyframes fade{from{opacity:0}}",
		"@keyframes pop{from{opacity:0;transform:scale(0)}}",
	].join("");
}

/** GitHub のプロフィールに載せる図。サイトの広い図と同じ向き・同じ配置で、操作のない部分だけを描く */
export function renderProfileMap(theme: ProfileTheme): string {
	const layout = layoutMap(categories, projects, actors, flows);
	const pad = 8;
	const vb = layout.viewBox;
	const x = vb.x - pad;
	const y = vb.y - pad;
	const w = vb.w + 2 * pad;
	const h = vb.h + 2 * pad;
	const nodes = layout.nodes
		.map(
			(nd) =>
				`<g class="node" data-status="${nd.project.status}" style="--i:${nd.index}"><circle class="node-dot" cx="${n2(nd.pos.x)}" cy="${n2(nd.pos.y)}" r="4.5"/>${nameLabel(nd, "full")}</g>`,
		)
		.join("");
	const sats = layout.sats
		.map(
			(st, i) =>
				`<g class="node" style="--i:${layout.nodes.length + i}">${satGroup(st, "full")}</g>`,
		)
		.join("");
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n2(x)} ${n2(y)} ${n2(w)} ${n2(h)}" width="${Math.round(w)}" height="${Math.round(h)}" role="img" aria-label="${esc(`Map of ${org.name}: GitHub at the center, its repositories around it, and the services they connect to.`)}">`,
		`<title>${esc(org.name)}</title>`,
		`<style>${style(theme)}</style>`,
		`<rect class="bg" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="20"/>`,
		`<g><circle class="orbit" r="${layout.rDial}" pathLength="1"/>${dialTicks(layout)}</g>`,
		`<g>${trackPaths(layout)}</g>`,
		`<g>${leaderLines(layout)}${layout.sats.map((st) => portLine(st, "full")).join("")}</g>`,
		`<g>${hubInner(layout)}</g>`,
		`<g>${catLabels(layout)}</g>`,
		`<g>${nodes}${sats}</g>`,
		"</svg>",
	].join("");
}
