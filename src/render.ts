// ビルドのときに、data.ts から HTML と SVG を作って index.html に埋め込む。
// ブラウザ側の main.ts は、ここで付けた data-* 属性だけを読んで動く。

import {
	type Actor,
	actors,
	categories,
	type Flow,
	flows,
	type Member,
	members,
	org,
	type ProjectLink,
	projects,
	type Stop,
	statusLabel,
} from "./data.ts";
import {
	type Badge,
	GEOMETRY,
	layoutMap,
	type MapLayout,
	type Mode,
	type NodeLayout,
	type Pt,
	type SatLayout,
} from "./layout.ts";
import { markGroup, markSvg } from "./logo.ts";

export const esc = (s: string) =>
	s
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const pad2 = (n: number) => String(n).padStart(2, "0");
const ext = 'target="_blank" rel="noopener"';
export const n2 = (v: number) => v.toFixed(2);
const n1 = (v: number) => v.toFixed(1);

const projectById = (id: string) => projects.find((p) => p.id === id);
const actorById = (id: string) => actors.find((a) => a.id === id) as Actor;
const memberById = (id: string) => members.find((m) => m.id === id) as Member;

/** 図の上の id（リポジトリは projects の id、外のものは actors の id） */
const placeOf = (a: Actor) => a.project ?? a.id;

/** その流れに出てくるもの（合流するもの・分かれる先も含む） */
const actorsIn = (f: Flow) =>
	new Set(
		f.stops.flatMap((s) => (s.branch ? [s.actor, s.branch.actor] : [s.actor])),
	);
/** 図の上の id が出てくる流れ */
const flowsOf = (placeId: string) =>
	flows.filter((f) =>
		[...actorsIn(f)].some((a) => placeOf(actorById(a)) === placeId),
	);

function avatar(m: Member, size: number): string {
	return `<img class="avatar" src="${esc(m.avatar)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
}

export function radial(r0: number, r1: number, angle: number) {
	const a = (angle * Math.PI) / 180;
	const s = Math.sin(a);
	const k = -Math.cos(a);
	return `x1="${n2(r0 * s)}" y1="${n2(r0 * k)}" x2="${n2(r1 * s)}" y2="${n2(r1 * k)}"`;
}

/** 外の目盛り（2.5 度ごとの細かい目盛りと、点の向きの長い目盛り） */
export function dialTicks(layout: MapLayout): string {
	const rDial = layout.rDial;
	return layout.ticks
		.map(
			(t) =>
				`<line class="tick${t.major ? " tick-major" : ""}" ${radial(t.major ? rDial - 4 : rDial, t.major ? rDial + 9 : rDial + 3.5, t.angle)}/>`,
		)
		.join("");
}

/** 中心から点までの線 */
export function trackPaths(layout: MapLayout): string {
	return layout.nodes
		.map(
			(nd, i) =>
				`<path class="track" data-node="${nd.project.id}" data-cat="${nd.project.category}" d="${nd.track}" pathLength="1" style="--i:${i}"/>`,
		)
		.join("");
}

/** 点から、外の目盛りとラベルへ向かう点線 */
export function leaderLines(layout: MapLayout): string {
	return layout.nodes
		.map(
			(nd) =>
				`<line class="leader" data-node="${nd.project.id}" ${radial(nd.radius + 8, layout.rDial - 5, nd.angle)} style="--i:${nd.index}"/>`,
		)
		.join("");
}

/** 外のものの箱から目盛りの輪へ入る線 */
export function portLine(st: SatLayout, mode: Mode): string {
	const { from, to } = st[mode].port;
	return `<line class="port port-${mode}" data-node="${st.actor.id}" x1="${n2(from.x)}" y1="${n2(from.y)}" x2="${n2(to.x)}" y2="${n2(to.y)}"/>`;
}

/** カテゴリ名。図を回すと置き直すので、束の向き（trunk）と幅（side）を持たせる */
export function catLabels(layout: MapLayout): string {
	return layout.categories
		.map(
			(cl) =>
				`<text class="cat-label" data-cat="${cl.category.id}" data-trunk="${n2(cl.angle)}" data-side="${cl.side}" transform="translate(${cl.label.x} ${cl.label.y}) rotate(${cl.label.rotate})" text-anchor="${cl.label.anchor}">${esc(cl.category.label.toUpperCase())}</text>`,
		)
		.join("");
}

/** 中心の輪とロゴと、輪に沿って書く「GITHUB」。ロゴは図を回しても立てたままにする */
export function hubInner(layout: MapLayout): string {
	const { rHub } = GEOMETRY;
	const cap = layout.hubCaption;
	return [
		`<circle class="hub-hit" r="${rHub + 6}"/>`,
		`<circle class="hub-ring" r="${rHub}" pathLength="1"/>`,
		markGroup(rHub * 1.12),
		`<path id="hub-caption" class="hub-caption-path" d="${cap.path}" data-angle="${cap.angle}" data-span="${cap.span}" data-r="${cap.r}"/>`,
		`<text class="hub-caption"><textPath href="#hub-caption" startOffset="50%" text-anchor="middle">${esc(cap.text)}</textPath></text>`,
	].join("");
}

/** リポジトリの名前（押せる範囲の四角と文字）。図を回すと置き直すので、幅・中心からの距離・文字の大きさを持たせる */
export function nameLabel(nd: NodeLayout, mode: Mode): string {
	const n = nd.name[mode];
	const b = n.box;
	return [
		`<g class="name name-${mode}" data-w="${n.w}" data-r="${n.r}" data-size="${n.size}">`,
		`<rect class="node-hit" x="${n1(b.x - 6)}" y="${n1(b.y - 4)}" width="${n1(b.w + 12)}" height="${n1(b.h + 8)}"/>`,
		`<text class="node-name" x="${n1(n.x)}" y="${n1(n.y)}" text-anchor="${n.anchor}" font-size="${n.size}">${esc(nd.project.name)}</text>`,
		"</g>",
	].join("");
}

/** 外のものの箱。箱の真ん中を translate で動かすので、中身は (0, 0) を真ん中に描く */
export function satGroup(st: SatLayout, mode: Mode): string {
	const p = st[mode];
	const b = p.box;
	const name = esc(st.actor.name.toUpperCase());
	const text =
		mode === "full"
			? `<text class="sat-name" x="0" y="4.2" text-anchor="middle">${name}</text>`
			: `<text class="sat-cname" x="0" y="6" text-anchor="middle">${name}</text>`;
	return [
		`<g class="sat sat-${mode}" data-w="${b.w}" data-h="${b.h}" data-gap="${p.gap}" data-avoid="${p.avoid}" data-inner="${p.inner}" transform="translate(${n2(b.x + b.w / 2)} ${n2(b.y + b.h / 2)})">`,
		`<rect class="sat-box" x="${n2(-b.w / 2)}" y="${n2(-b.h / 2)}" width="${n2(b.w)}" height="${n2(b.h)}" rx="4"/>`,
		text,
		"</g>",
	].join("");
}

/** 流れの番号。(0, 0) を真ん中に描き、translate で置く */
function badgeMarkup(b: Badge, at: Pt, cls: string): string {
	const shape =
		b.shape === "circle" && b.text.length <= 1
			? '<circle r="9"/>'
			: `<rect x="${n2(-b.width / 2)}" y="-9" width="${n2(b.width)}" height="18" rx="${b.shape === "circle" ? 9 : 2.5}"/>`;
	const sat = b.sat ? ` data-sat="${b.sat}" data-bw="${n2(b.width)}"` : "";
	return `<g class="badge-at${cls}" transform="translate(${n2(at.x)} ${n2(at.y)})"${sat}><g class="badge" data-actor="${b.actor}">${shape}<text y="3.6" text-anchor="middle">${esc(b.text)}</text></g></g>`;
}

/**
 * 図。class に rot を付けたものは、CSS の --rot でまとめて回す（点・線・目盛り・流れ）。
 * 名前・外のものの箱・カテゴリ名・中心の文字は回さずに立てておき、回したときは turn.ts が置き直す。
 */
function renderMap(layout: MapLayout): string {
	const { rHub } = GEOMETRY;
	const rDial = layout.rDial;
	const { x, y, w, h } = layout.viewBox;
	const c = layout.compactViewBox;

	// 中心から、どのリポジトリへも広がる流れのときに、中心から外へ流れる光
	const pulses = layout.nodes
		.map(
			(nd) =>
				`<path class="track-pulse" d="${nd.track}" pathLength="1" style="--i:${nd.index}"/>`,
		)
		.join("");

	// 外のものの箱から目盛りの輪へ入る線（広い図と小さい図で、箱の場所が違う）
	const ports = layout.sats
		.flatMap((st) => [portLine(st, "full"), portLine(st, "compact")])
		.join("");

	// つながりの線と、それに添える説明（ふだんは隠し、選んだときに出す）
	const linkPaths = layout.links
		.map(
			(l) =>
				`<path class="link link-${l.kind}" data-link="${l.id}" data-ends="${l.ends.join(" ")}" data-flows="${l.flows.join(" ")}" d="${l.d}" pathLength="1"/>`,
		)
		.join("");
	// 線の説明は、動く点がその段にいる間だけ出す（枠は付けず、紙の色の縁取りで線から浮かせる）
	const pills = layout.pills
		.map((pl) => {
			const on = pl.track
				? `data-track="${pl.track}"`
				: `data-link="${pl.link}"`;
			return `<text class="edge-label" data-flow="${pl.flow}" data-leg="${pl.leg}" data-to="${pl.to}" ${on} x="${n2(pl.at.x)}" y="${n2(pl.at.y + 4)}" text-anchor="middle">${esc(pl.text)}</text>`;
		})
		.join("");

	const neighbors = new Map<string, Set<string>>();
	for (const l of layout.links) {
		const [a, b] = l.ends;
		if (!neighbors.has(a)) neighbors.set(a, new Set());
		if (!neighbors.has(b)) neighbors.set(b, new Set());
		neighbors.get(a)?.add(b);
		neighbors.get(b)?.add(a);
	}
	// 中心とのつながり（リポジトリの線で表すもの）も、隣として数える
	for (const fl of layout.flows) {
		for (const id of fl.tracks) {
			const set = neighbors.get(id) ?? new Set<string>();
			set.add(layout.hubId);
			neighbors.set(id, set);
		}
	}
	const near = (id: string) => [...(neighbors.get(id) ?? [])].join(" ");

	// リポジトリ: 点は回す図の中に、名前は回さずに置く（広い図と小さい図で、名前の大きさと場所が違う）
	const repoNodes = layout.nodes.map((nd) => {
		const p = nd.project;
		const primary = p.links[0]?.href ?? org.github;
		const { x: px, y: py } = nd.pos;
		return [
			`<a class="node" href="${esc(primary)}" data-id="${p.id}" data-type="repo" data-cat="${p.category}" data-members="${esc(p.members.join(" "))}" data-near="${near(p.id)}" data-angle="${nd.angle.toFixed(2)}" data-status="${p.status}" style="--i:${nd.index}" aria-label="${esc(`${pad2(nd.index)} ${p.name}, ${p.kind}`)}">`,
			'<g class="rot">',
			`<circle class="node-hit" cx="${n2(px)}" cy="${n2(py)}" r="18"/>`,
			`<circle class="node-ring" cx="${n2(px)}" cy="${n2(py)}" r="10.5"/>`,
			`<circle class="node-dot" cx="${n2(px)}" cy="${n2(py)}" r="4.5"/>`,
			"</g>",
			nameLabel(nd, "full"),
			nameLabel(nd, "compact"),
			"</a>",
		].join("");
	});

	// 外のもの: 輪の外の箱。小さい図では、名前を大きく書いた箱を、名前とぶつからない所に出す
	const satNodes = layout.sats.map((st, i) => {
		const a = st.actor;
		return [
			`<a class="node node-ext" href="#${a.id}" data-id="${a.id}" data-type="ext" data-near="${near(a.id)}" data-angle="${st.angle.toFixed(2)}" style="--i:${layout.nodes.length + i}" aria-label="${esc(`${a.name}, ${a.kind}`)}">`,
			satGroup(st, "full"),
			satGroup(st, "compact"),
			"</a>",
		].join("");
	});

	// 流れを選んだときに出す番号（流れごとにまとめておき、選んだものだけ見せる）
	const badges = layout.flows
		.map((fl) =>
			[
				`<g class="flow-badges" data-flow="${fl.flow.id}">`,
				// 外のものの箱は、広い図と小さい図で場所が違うので、番号も 2 つ置く
				...fl.badges.flatMap((b) =>
					b.sat
						? [
								badgeMarkup(b, b.at, " badge-full"),
								badgeMarkup(b, b.compactAt, " badge-compact"),
							]
						: [badgeMarkup(b, b.at, "")],
				),
				"</g>",
			].join(""),
		)
		.join("");
	const routes = layout.flows
		.map(
			(fl) =>
				`<path class="route-path" data-flow="${fl.flow.id}" data-links="${fl.links.join(" ")}" data-tracks="${fl.tracks.join(" ")}" data-actors="${fl.actors.join(" ")}" data-any-repo="${fl.anyRepo}" data-legs="${fl.legT.map((t) => t.join(",")).join(" ")}" d="${fl.route}"/>`,
		)
		.join("");

	return [
		`<svg class="map-svg" viewBox="${x} ${y} ${w} ${h}" data-viewbox-full="${x} ${y} ${w} ${h}" data-viewbox-compact="${c.x} ${c.y} ${c.w} ${c.h}" data-r-dial="${rDial}" data-r-hub="${rHub}" data-compact-turn="${layout.compactTurn}" style="--rot-compact:${layout.compactTurn}deg" role="group" aria-label="${esc(`Map of ${org.name}: GitHub at the center, ${projects.length} repositories in ${categories.length} categories, and the services around them. Drag to turn it.`)}">`,
		`<g class="map-dial rot"><circle class="orbit" r="${rDial}" pathLength="1"/>${dialTicks(layout)}</g>`,
		`<g class="map-tracks rot">${trackPaths(layout)}${pulses}</g>`,
		`<g class="map-leaders rot">${leaderLines(layout)}${ports}</g>`,
		`<g class="map-links rot">${linkPaths}</g>`,
		`<a class="map-hub" href="${org.github}" ${ext} data-id="${layout.hubId}" aria-label="${esc(org.name)} on GitHub">${hubInner(layout)}</a>`,
		`<g class="map-cats">${catLabels(layout)}</g>`,
		`<g class="map-nodes">${repoNodes.join("")}${satNodes.join("")}</g>`,
		`<g class="map-labels rot" aria-hidden="true">${pills}</g>`,
		`<g class="map-flow rot" aria-hidden="true">${routes}${badges}<circle class="flow-dot" r="3.6"/></g>`,
		`<g class="rot" aria-hidden="true"><g class="map-marker"><path d="M0 ${-(rDial - 1)}l-4.5 -8h9z"/></g></g>`,
		"</svg>",
	].join("");
}

/** 流れの手順を、図と同じ形（リポジトリは丸、外のものは四角、中心は輪）で並べた小さな印 */
function signature(f: Flow): string {
	const step = 13;
	const w = 10 + (f.stops.length - 1) * step;
	const marks = f.stops.map((s, i) => {
		const a = actorById(s.actor);
		const x = 5 + i * step;
		if (a.hub) return `<circle class="sig-hub" cx="${x}" cy="5" r="3"/>`;
		if (a.project) return `<circle cx="${x}" cy="5" r="3.2"/>`;
		return `<rect x="${x - 3.2}" y="1.8" width="6.4" height="6.4" rx="1"/>`;
	});
	return `<svg class="flow-sig" viewBox="0 0 ${w} 10" width="${w}" height="10" aria-hidden="true"><line x1="5" y1="5" x2="${w - 5}" y2="5"/>${marks.join("")}</svg>`;
}

function flowRow(f: Flow): string {
	return `<li><a class="flow-row" href="#flow-${f.id}" data-flow-link="${f.id}"><span class="flow-name">${esc(f.name)}</span>${signature(f)}</a></li>`;
}

function renderOverview(): string {
	return [
		'<div class="sheet-overview">',
		'<div class="ov-head">',
		`<h1 class="wordmark">${esc(org.name)}</h1>`,
		"</div>",
		'<div class="ov-body">',
		`<nav class="ov-flows" aria-label="Flows"><ol class="flow-list">${flows.map(flowRow).join("")}</ol></nav>`,
		'<ul class="member-list" aria-label="Members">',
		...members.map(
			(m) =>
				`<li><a class="member" href="https://github.com/${esc(m.id)}" ${ext} data-member="${esc(m.id)}">${avatar(m, 26)}<span class="member-id">${esc(m.id)}</span></a></li>`,
		),
		"</ul>",
		`<p class="colophon"><span>© 2026</span><a href="${org.source}" ${ext}>Source</a><span>MPL-2.0</span></p>`,
		"</div>",
		"</div>",
	].join("");
}

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

/**
 * 欄と図の間の目盛り。上が組織の始まり（org.started）、下が今日で、1 日ごとに目盛りを刻む。
 * 各リポジトリを作った日には長い目盛りを付け、のせるとその点を強調する。
 */
function renderRuler(): string {
	const DAY = 86_400_000;
	const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
	const start = day(org.started);
	const now = new Date();
	const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	const end = Math.max(today, ...projects.map((p) => day(p.created)));
	// 始まりの日を 0、今日を last として、縦に並べる
	const last = Math.max(1, Math.round((end - start) / DAY));
	const index = (t: number) => Math.round((t - start) / DAY);
	const pct = (i: number) => ((i / last) * 100).toFixed(3);
	// 縦（広い画面）と横（狭い画面）の 2 つの向きで、同じ目盛りを描く
	let daysV = "";
	let daysH = "";
	let monthsV = "";
	let monthsH = "";
	const months: string[] = [];
	for (let i = 0; i <= last; i++) {
		const d = new Date(start + i * DAY);
		if (d.getUTCDate() === 1) {
			monthsV += `M2 ${i}H12`;
			monthsH += `M${i} 2V12`;
			months.push(
				`<span class="ruler-month" style="--at:${pct(i)}">${MONTHS[d.getUTCMonth()]}</span>`,
			);
		} else {
			daysV += `M8 ${i}H12`;
			daysH += `M${i} 8V12`;
		}
	}
	const byDay = new Map<string, string[]>();
	for (const p of projects)
		byDay.set(p.created, [...(byDay.get(p.created) ?? []), p.id]);
	const marks = [...byDay]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(
			([d, ids]) =>
				`<span class="ruler-mark" data-repos="${ids.join(" ")}" style="--at:${pct(index(day(d)))}"></span>`,
		);
	return [
		'<div class="ruler" aria-hidden="true">',
		`<svg class="ruler-ticks ruler-v" viewBox="0 0 24 ${last}" preserveAspectRatio="none"><line class="ruler-line" x1="12" y1="0" x2="12" y2="${last}"/><path d="${daysV}"/><path d="${monthsV}"/></svg>`,
		`<svg class="ruler-ticks ruler-h" viewBox="0 0 ${last} 24" preserveAspectRatio="none"><line class="ruler-line" x1="0" y1="12" x2="${last}" y2="12"/><path d="${daysH}"/><path d="${monthsH}"/></svg>`,
		...months,
		...marks,
		"</div>",
	].join("");
}

function linkList(links: ProjectLink[]): string {
	return [
		'<ul class="sheet-links">',
		...links.map(
			(l) =>
				`<li><a href="${esc(l.href)}" ${ext}><span class="link-label">${esc(l.label)}</span><span class="link-note">${esc(l.note)}</span><span class="link-arrow" aria-hidden="true">↗</span></a></li>`,
		),
		"</ul>",
	].join("");
}

function flowLinks(its: Flow[]): string {
	if (its.length === 0) return "";
	return `<nav class="sheet-rel" aria-label="Flows"><ol class="flow-list">${its.map(flowRow).join("")}</ol></nav>`;
}

const sheetBar = () =>
	'<div class="sheet-bar"><a class="sheet-back" href="./" data-action="close"><span aria-hidden="true">←</span> Back</a></div>';

/** 種類・使っているもの・状態などを、短い見出しを付けて並べる */
function facts(rows: [string, string][]): string {
	return [
		'<dl class="sheet-specs">',
		...rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`),
		"</dl>",
	].join("");
}

function renderArticle(nd: NodeLayout): string {
	const p = nd.project;
	const rows: [string, string][] = [["kind", esc(p.kind)]];
	if (p.stack.length) rows.push(["stack", esc(p.stack.join(", "))]);
	if (p.runsOn.length) rows.push(["runs on", esc(p.runsOn.join(", "))]);
	rows.push([
		"status",
		`<span class="status-dot" data-status="${p.status}"></span>${statusLabel[p.status]}`,
	]);
	if (p.members.length) {
		rows.push([
			"by",
			p.members
				.map(
					(id) =>
						`<a class="spec-member" href="https://github.com/${esc(id)}" ${ext}>${avatar(memberById(id), 20)}<span>${esc(id)}</span></a>`,
				)
				.join(""),
		]);
	}
	return [
		`<article class="sheet-project" id="about-${p.id}" data-id="${p.id}" hidden aria-labelledby="t-${p.id}">`,
		sheetBar(),
		`<h2 class="sheet-name" id="t-${p.id}" tabindex="-1">${esc(p.name)}</h2>`,
		`<p class="sheet-desc">${esc(p.summary)}</p>`,
		facts(rows),
		linkList(p.links),
		flowLinks(flowsOf(p.id)),
		"</article>",
	].join("");
}

function renderExtArticle(e: SatLayout): string {
	const a = e.actor;
	return [
		`<article class="sheet-project" id="about-${a.id}" data-id="${a.id}" hidden aria-labelledby="t-${a.id}">`,
		sheetBar(),
		`<h2 class="sheet-name" id="t-${a.id}" tabindex="-1">${esc(a.name)}</h2>`,
		a.about ? `<p class="sheet-desc">${esc(a.about)}</p>` : "",
		facts([["kind", esc(a.kind)]]),
		a.links?.length ? linkList(a.links) : "",
		flowLinks(flowsOf(a.id)),
		"</article>",
	].join("");
}

function renderStop(
	stop: Stop | NonNullable<Stop["branch"]>,
	cls: string,
	num: string,
	extra = "",
): string {
	const a = actorById(stop.actor);
	const project = a.project ? projectById(a.project) : undefined;
	const id = placeOf(a);
	const name = a.hub
		? `<span class="stop-name">${esc(a.name)}</span>`
		: `<a class="stop-name" href="${esc(project?.links[0]?.href ?? `#${id}`)}" data-select="${id}">${esc(a.name)}</a>`;
	return [
		`<div class="${cls}" data-actor="${a.hub ? a.id : id}" data-kind="${a.project ? "repo" : "ext"}"${extra}>`,
		`<i class="stop-mark" aria-hidden="true">${num}</i>`,
		cls === "branch"
			? '<i class="branch-mask" aria-hidden="true"></i><i class="branch-arrow" aria-hidden="true"></i>'
			: "",
		`<p class="stop-head">${name}</p>`,
		`<p class="stop-text">${esc(stop.text)}</p>`,
		"</div>",
	].join("");
}

function renderFlowArticle(f: Flow): string {
	const id = `flow-${f.id}`;
	return [
		`<article class="sheet-project sheet-flow" id="about-${id}" data-id="${id}" hidden aria-labelledby="t-${id}">`,
		sheetBar(),
		`<h2 class="sheet-name" id="t-${id}" tabindex="-1">${esc(f.name)}</h2>`,
		'<ol class="route">',
		...f.stops.map((stop, k) =>
			[
				`<li class="stop-item${k === f.stops.length - 1 ? " is-last" : ""}">`,
				renderStop(stop, "stop", String(k + 1)),
				stop.branch
					? renderStop(
							stop.branch,
							"branch",
							"",
							` data-dir="${stop.branch.dir}"`,
						)
					: "",
				"</li>",
			].join(""),
		),
		"</ol>",
		"</article>",
	].join("");
}

export function renderApp(): string {
	const layout = layoutMap(categories, projects, actors, flows);
	return [
		'<header class="top">',
		`<a class="brand" href="./" aria-label="${esc(org.name)}">${markSvg("brand-mark")}<span>${esc(org.name)}</span></a>`,
		'<nav class="top-nav" aria-label="Links">',
		`<a href="${org.github}" ${ext}>GitHub<span aria-hidden="true"> ↗</span></a>`,
		// 今の色の名前を出す。どちらを出すかは CSS が決めるので、JavaScript が動く前から合う
		'<button class="theme" type="button" data-theme-toggle aria-label="Color theme: Dark"><span class="theme-icon" aria-hidden="true"></span><span class="theme-text theme-light">Light</span><span class="theme-text theme-dark">Dark</span></button>',
		"</nav>",
		"</header>",
		'<main class="hero">',
		'<aside class="sheet" aria-label="Details">',
		renderOverview(),
		...layout.nodes.map(renderArticle),
		...layout.sats.map(renderExtArticle),
		...flows.map(renderFlowArticle),
		"</aside>",
		renderRuler(),
		`<figure class="map" aria-label="Map of ${esc(org.name)}">${renderMap(layout)}</figure>`,
		"</main>",
	].join("\n");
}
