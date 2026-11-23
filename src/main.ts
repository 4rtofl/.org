import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./style.css";
import { setupGrain } from "./grain.ts";
import { setupTurn } from "./turn.ts";

// ビルドのときに書き出した HTML に、操作を足す。
// - 点（リポジトリ）と箱（外のもの）: のせると、つながる相手と線を強調する。押すと、説明欄に説明を出し、URL の # を変える。
// - 流れ: 一覧の行にのせるか押すと、図にその流れの線と順番の番号を出し、点を道に沿って動かす。
// - 欄と図の間の目盛り: リポジトリを作った日の目盛りにのせると、その点を強調する。
//   リポジトリを 1 つ選んでいる間は、作った日から今日までを太い線で引き、作った日の日付を出す。
// - マウス: 矢印は隠し、小さな丸が少し遅れてなめらかについて動き、押せるものの上で広がる（ZERO TOKYO のホームページと同じ動き）。
// - 図を回す動きは turn.ts、画面全体に重ねる細かい粒は grain.ts。

const root = document.documentElement;
const svg = document.querySelector<SVGSVGElement>(".map-svg");
const nodes = [...document.querySelectorAll<SVGAElement>(".node")];
const tracks = [...document.querySelectorAll<SVGPathElement>(".track")];
const leaders = [...document.querySelectorAll<SVGLineElement>(".leader")];
const links = [...document.querySelectorAll<SVGPathElement>(".link")];
const pills = [...document.querySelectorAll<SVGTextElement>(".edge-label")];
const ports = [...document.querySelectorAll<SVGLineElement>(".port")];
const catLabels = [...document.querySelectorAll<SVGTextElement>(".cat-label")];
const ruler = document.querySelector<HTMLElement>(".ruler");
const rulerSpan = ruler?.querySelector<HTMLElement>(".ruler-span");
const rulerDate = ruler?.querySelector<HTMLElement>(".ruler-date");
const rulerMarks = [...document.querySelectorAll<HTMLElement>(".ruler-mark")];
const memberLinks = [
	...document.querySelectorAll<HTMLAnchorElement>(".member"),
];
const hub = document.querySelector<SVGAElement>(".map-hub");
const hubId = hub?.dataset.id ?? "github";
const articles = new Map(
	[...document.querySelectorAll<HTMLElement>(".sheet-project")].map((a) => [
		a.dataset.id ?? "",
		a,
	]),
);
const routes = new Map(
	[...document.querySelectorAll<SVGPathElement>(".route-path")].map((p) => [
		p.dataset.flow ?? "",
		p,
	]),
);
const badgeGroups = new Map(
	[...document.querySelectorAll<SVGGElement>(".flow-badges")].map((g) => [
		g.dataset.flow ?? "",
		g,
	]),
);
const dot = document.querySelector<SVGCircleElement>(".flow-dot");
const marker = document.querySelector<SVGGElement>(".map-marker");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const stacked = window.matchMedia("(max-width: 1179px)");
// スマートフォン: 図を小さい図（名前を大きくし、画面の幅に収まる向きに回したもの）にする
const narrow = window.matchMedia("(max-width: 760px)");

const nodeById = new Map(nodes.map((n) => [n.dataset.id ?? "", n]));
const words = (s: string | undefined) => (s ?? "").split(" ").filter(Boolean);
// 矢印キーで移る順（時計回り）
const ring = [...nodes].sort(
	(a, b) => Number(a.dataset.angle) - Number(b.dataset.angle),
);

let selected: string | null = null;
let hovered: string | null = null;
let hoveredFlow: string | null = null;
let hoveredCat: string | null = null;
let hoveredMember: string | null = null;
let hoveredStop: string | null = null;
let hoveredRuler: string[] | null = null;
let hoveredHub = false;
let markerAngle = 0;

const flowOf = (id: string | null) =>
	id?.startsWith("flow-") ? id.slice(5) : null;

interface Focus {
	nodes: Set<string>;
	links: Set<string>;
	/** 道として太く描く、中心からリポジトリへの線 */
	routeTracks: Set<string>;
	/** 強調する点（is-focus） */
	main: string | null;
	flow: string | null;
	/** 中心から、どのリポジトリへも広がる流れか */
	anyRepo?: boolean;
	/** 中心（GitHub）にのせているか */
	hub?: boolean;
}

function focusOf(): Focus | null {
	const flow = hoveredFlow ?? (hovered || hoveredHub ? null : flowOf(selected));
	if (flow && !hoveredCat && !hoveredMember && !hoveredRuler) {
		const r = routes.get(flow);
		if (r) {
			return {
				nodes: new Set(words(r.dataset.actors)),
				links: new Set(words(r.dataset.links)),
				routeTracks: new Set(words(r.dataset.tracks)),
				main: null,
				flow,
				anyRepo: r.dataset.anyRepo === "true",
			};
		}
	}
	const pick = (pred: (n: SVGAElement) => boolean) =>
		new Set(nodes.filter(pred).map((n) => n.dataset.id ?? ""));
	// 中心にのせると、すべてのリポジトリへの線を強調する
	if (hoveredHub) {
		return {
			nodes: pick((n) => n.dataset.type === "repo"),
			links: new Set(),
			routeTracks: new Set(),
			main: null,
			flow: null,
			hub: true,
		};
	}
	if (hoveredRuler) {
		const ids = hoveredRuler;
		return {
			nodes: pick((n) => ids.includes(n.dataset.id ?? "")),
			links: new Set(),
			routeTracks: new Set(),
			main: null,
			flow: null,
		};
	}
	if (hoveredCat) {
		return {
			nodes: pick((n) => n.dataset.cat === hoveredCat),
			links: new Set(),
			routeTracks: new Set(),
			main: null,
			flow: null,
		};
	}
	if (hoveredMember) {
		return {
			nodes: pick((n) =>
				words(n.dataset.members).includes(hoveredMember ?? ""),
			),
			links: new Set(),
			routeTracks: new Set(),
			main: null,
			flow: null,
		};
	}
	const id = hovered ?? (flowOf(selected) ? null : selected);
	if (id) {
		const near = words(nodeById.get(id)?.dataset.near);
		return {
			nodes: new Set([id, ...near]),
			links: new Set(
				links
					.filter((l) => words(l.dataset.ends).includes(id))
					.map((l) => l.dataset.link ?? ""),
			),
			routeTracks: new Set(near.includes(hubId) ? [id] : []),
			main: id,
			flow: null,
		};
	}
	return null;
}

function render() {
	if (!svg) return;
	const fo = focusOf();
	svg.classList.toggle("has-focus", fo !== null);
	svg.classList.toggle("is-flow", fo?.flow != null);
	svg.classList.toggle("is-any-repo", fo?.anyRepo === true);
	svg.classList.toggle("is-hub", fo?.hub === true);
	for (const n of nodes) {
		const id = n.dataset.id ?? "";
		n.classList.toggle("is-on", fo?.nodes.has(id) ?? false);
		n.classList.toggle("is-focus", id === fo?.main);
		n.classList.toggle("is-selected", id === selected);
	}
	for (const t of tracks) {
		const id = t.dataset.node ?? "";
		t.classList.toggle("is-route", fo?.routeTracks.has(id) ?? false);
		// 点にのせたときは、その点の線だけ。カテゴリやメンバーのときは、まとめて
		t.classList.toggle(
			"is-on",
			fo !== null &&
				fo.flow === null &&
				(fo.main === null ? fo.nodes.has(id) : id === fo.main),
		);
	}
	for (const l of leaders) {
		l.classList.toggle("is-on", fo?.nodes.has(l.dataset.node ?? "") ?? false);
	}
	for (const l of links) {
		l.classList.toggle("is-on", fo?.links.has(l.dataset.link ?? "") ?? false);
	}
	shownFlow = fo?.flow ?? null;
	showPills();
	for (const l of ports) {
		l.classList.toggle("is-on", fo?.nodes.has(l.dataset.node ?? "") ?? false);
	}
	renderRuler(fo);
	hub?.classList.toggle("is-on", (fo?.nodes.has(hubId) || fo?.hub) ?? false);
	for (const c of catLabels) {
		const cat = c.dataset.cat ?? "";
		const lit =
			hoveredCat === cat ||
			(fo?.main != null && nodeById.get(fo.main)?.dataset.cat === cat);
		c.classList.toggle("is-on", lit);
	}
	for (const [id, g] of badgeGroups) {
		g.classList.toggle("is-on", id === fo?.flow);
		for (const b of g.querySelectorAll<SVGGElement>(".badge")) {
			b.classList.toggle("is-hot", b.dataset.actor === hoveredStop);
		}
	}
	for (const row of document.querySelectorAll<HTMLElement>(
		"[data-flow-link]",
	)) {
		row.classList.toggle("is-on", row.dataset.flowLink === fo?.flow);
	}
	runDot(fo?.flow ?? null);
}

// ---------- 欄と図の間の目盛り ----------

/** 目盛りの線を引いている、選んだリポジトリ */
let spanRepo: string | null = null;

/**
 * リポジトリを 1 つ選んでいる間は、目盛りを、そのリポジトリを作った日から今日までの太い線と、作った日の日付にする。
 * 図や欄の何かにのせている間は、のせたものの目盛りを、いつもどおり強調する。
 */
function renderRuler(fo: Focus | null) {
	const repo =
		selected && nodeById.get(selected)?.dataset.type === "repo"
			? selected
			: null;
	const mark = repo
		? rulerMarks.find((m) => words(m.dataset.repos).includes(repo))
		: undefined;
	const hovering =
		hovered !== null ||
		hoveredFlow !== null ||
		hoveredCat !== null ||
		hoveredMember !== null ||
		hoveredRuler !== null ||
		hoveredHub;
	ruler?.classList.toggle("is-single", mark !== undefined);
	if (ruler && mark && repo !== spanRepo) {
		ruler.style.setProperty("--from", mark.style.getPropertyValue("--at"));
		if (rulerDate) rulerDate.textContent = mark.dataset.date ?? "";
		// 選び直すたびに、作った日から今日へ線を引き直す
		for (const el of [rulerSpan, rulerDate]) {
			if (!el) continue;
			el.style.animation = "none";
			void el.offsetWidth;
			el.style.animation = "";
		}
	}
	spanRepo = mark ? repo : null;
	for (const m of rulerMarks) {
		m.classList.toggle("is-sel", m === mark);
		m.classList.toggle(
			"is-on",
			(!mark || hovering) &&
				words(m.dataset.repos).some((id) => fo?.nodes.has(id)),
		);
	}
}

// ---------- 流れに沿って動く点と、線の説明 ----------

// 線の説明は、選んだ流れの中で、動く点がいる段の説明と、手順の名前にのせている所へ着く段の説明だけを出す
let shownFlow: string | null = null;
let dotLeg = -1;

function showPills() {
	for (const p of pills) {
		const { flow, leg, to } = p.dataset;
		const on =
			flow === shownFlow &&
			(Number(leg) === dotLeg || (hoveredStop !== null && to === hoveredStop));
		p.classList.toggle("is-on", on);
	}
}

function setLeg(leg: number) {
	if (leg === dotLeg) return;
	dotLeg = leg;
	showPills();
}

let dotFlow: string | null = null;
let dotFrame = 0;

function runDot(flow: string | null) {
	if (flow === dotFlow) return;
	dotFlow = flow;
	cancelAnimationFrame(dotFrame);
	setLeg(-1);
	const path = flow ? routes.get(flow) : undefined;
	if (!dot || !path || reduceMotion.matches) {
		dot?.classList.remove("is-on");
		return;
	}
	const len = path.getTotalLength();
	const legs = words(path.dataset.legs).map(
		(w) => w.split(",").map(Number) as [number, number],
	);
	if (len < 1 || legs.length === 0) {
		dot.classList.remove("is-on");
		return;
	}
	// 段ごとに、長さに合わせた時間で進み、着いた所で少し止まる。最後まで着いたら少し休んで、また始める
	const pause = 420;
	const rest = 900;
	const times = legs.map(([a, b]) =>
		b > a ? Math.min(1500, Math.max(650, (b - a) * len * 3.4)) : 0,
	);
	const starts: number[] = [];
	let total = 0;
	for (const d of times) {
		starts.push(total);
		total += d > 0 ? d + pause : 0;
	}
	const begin = performance.now();
	dot.classList.add("is-on");
	const tick = (now: number) => {
		const t = (now - begin) % (total + rest);
		if (t >= total) {
			dot.style.opacity = "0";
			setLeg(-1);
		} else {
			let i = legs.length - 1;
			while (i > 0 && t < (starts[i] ?? 0)) i--;
			const [a, b] = legs[i] ?? [0, 1];
			const d = times[i] ?? 1;
			const k = d > 0 ? Math.min(1, (t - (starts[i] ?? 0)) / d) : 1;
			// 段ごとに、動き始めと着く前をゆっくりにする
			const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
			const p = path.getPointAtLength((a + (b - a) * e) * len);
			dot.setAttribute("cx", p.x.toFixed(2));
			dot.setAttribute("cy", p.y.toFixed(2));
			dot.style.opacity = "1";
			setLeg(i);
		}
		dotFrame = requestAnimationFrame(tick);
	};
	dotFrame = requestAnimationFrame(tick);
}

// ---------- 選ぶ ----------

function moveMarker(id: string | null) {
	if (!marker) return;
	const angle = id
		? Number(nodeById.get(id)?.dataset.angle ?? Number.NaN)
		: null;
	if (angle === null || Number.isNaN(angle)) {
		marker.classList.remove("is-on");
		return;
	}
	// いまの向きから近いほうへ回す
	const delta = ((((angle - markerAngle) % 360) + 540) % 360) - 180;
	markerAngle += delta;
	marker.style.transform = `rotate(${markerAngle}deg)`;
	marker.classList.add("is-on");
}

function select(
	id: string | null,
	opts: { push?: boolean; focusSheet?: boolean } = {},
) {
	const next = id && articles.has(id) ? id : null;
	selected = next;
	for (const [key, a] of articles) a.hidden = key !== next;
	root.classList.toggle("has-selection", next !== null);
	moveMarker(next);
	if (opts.push !== false) {
		const url = next ? `#${next}` : `${location.pathname}${location.search}`;
		if (
			url !== `${location.pathname}${location.search}${location.hash}` &&
			url !== location.hash
		) {
			history.pushState(null, "", url);
		}
	}
	if (next && opts.focusSheet) {
		articles
			.get(next)
			?.querySelector<HTMLElement>(".sheet-name")
			?.focus({ preventScroll: true });
	}
	// 説明欄は、選び直すたびに上から見せる
	document.querySelector(".sheet")?.scrollTo({ top: 0 });
	for (const a of articles.values()) a.scrollTo({ top: 0 });
	if (next && stacked.matches) {
		scrollToMap(
			reduceMotion.matches || opts.push === false ? "auto" : "smooth",
		);
	}
	render();
}

/** 図と説明を上下に並べる幅では、図が見える位置まで動かす（説明は下から出て、図はその上に縮む） */
function scrollToMap(behavior: ScrollBehavior) {
	const map = document.querySelector<HTMLElement>(".map");
	const top = map ? map.getBoundingClientRect().top + window.scrollY : 0;
	const bar = document.querySelector<HTMLElement>(".top")?.offsetHeight ?? 0;
	window.scrollTo({ top: Math.max(0, top - bar), behavior });
}

function plainClick(e: MouseEvent) {
	return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}

/** のせている間だけ値を入れる（マウスとキーボードの両方） */
function onHover(
	el: Element,
	enter: () => void,
	leave: () => void,
	{ skipTouch = false } = {},
) {
	el.addEventListener("pointerenter", (e) => {
		if (skipTouch && (e as PointerEvent).pointerType === "touch") return;
		enter();
	});
	el.addEventListener("pointerleave", leave);
	el.addEventListener("focusin", enter);
	el.addEventListener("focusout", leave);
}

// 点と四角
for (const n of nodes) {
	const id = n.dataset.id ?? "";
	n.addEventListener("click", (e) => {
		if (!plainClick(e)) return; // ⌘ や Ctrl を押しながらなら、リポジトリを開く
		e.preventDefault();
		select(id, { focusSheet: e.detail === 0 });
	});
	onHover(
		n,
		() => {
			hovered = id;
			render();
		},
		() => {
			if (hovered === id) hovered = null;
			render();
		},
		{ skipTouch: true },
	);
	n.addEventListener("keydown", (e) => {
		const step =
			e.key === "ArrowRight" || e.key === "ArrowDown"
				? 1
				: e.key === "ArrowLeft" || e.key === "ArrowUp"
					? -1
					: 0;
		if (step !== 0) {
			e.preventDefault();
			const i = ring.indexOf(n);
			ring[(i + step + ring.length) % ring.length]?.focus();
		} else if (e.key === " ") {
			e.preventDefault();
			select(id, { focusSheet: true });
		}
	});
}

// 図の何もないところを押したら、全体に戻る
svg?.addEventListener("click", (e) => {
	if (!(e.target instanceof Element) || e.target.closest(".node, .map-hub"))
		return;
	if (selected) select(null);
});

// カテゴリとメンバー: のせると、その点をまとめて強調する
for (const el of catLabels) {
	const cat = el.dataset.cat ?? "";
	onHover(
		el,
		() => {
			hoveredCat = cat;
			render();
		},
		() => {
			if (hoveredCat === cat) hoveredCat = null;
			render();
		},
	);
}
for (const el of memberLinks) {
	const member = el.dataset.member ?? "";
	onHover(
		el,
		() => {
			hoveredMember = member;
			render();
		},
		() => {
			if (hoveredMember === member) hoveredMember = null;
			render();
		},
	);
}

// 中心（GitHub）: のせると、すべてのリポジトリへの線に中心から光を流す。押すと GitHub の 4rtofl を開く
if (hub) {
	onHover(
		hub,
		() => {
			hoveredHub = true;
			render();
		},
		() => {
			hoveredHub = false;
			render();
		},
		{ skipTouch: true },
	);
}

// 目盛り: リポジトリを作った日の印にのせると、その点を強調する
for (const m of rulerMarks) {
	const ids = words(m.dataset.repos);
	onHover(
		m,
		() => {
			hoveredRuler = ids;
			render();
		},
		() => {
			if (hoveredRuler === ids) hoveredRuler = null;
			render();
		},
		{ skipTouch: true },
	);
}

// 流れの行: のせると図に流れを出す
for (const row of document.querySelectorAll<HTMLElement>("[data-flow-link]")) {
	const flow = row.dataset.flowLink ?? "";
	onHover(
		row,
		() => {
			hoveredFlow = flow;
			render();
		},
		() => {
			if (hoveredFlow === flow) hoveredFlow = null;
			render();
		},
		{ skipTouch: true },
	);
}

// 流れの説明の中の名前: のせると、図の番号を大きくする
for (const s of document.querySelectorAll<HTMLElement>(
	".sheet-flow .stop, .sheet-flow .branch",
)) {
	const actor = s.dataset.actor ?? "";
	const head = s.querySelector(".stop-head");
	if (!head) continue;
	onHover(
		head,
		() => {
			hoveredStop = actor;
			render();
		},
		() => {
			if (hoveredStop === actor) hoveredStop = null;
			render();
		},
		{ skipTouch: true },
	);
}

document.addEventListener("click", (e) => {
	if (!(e.target instanceof Element)) return;
	const link = e.target.closest<HTMLAnchorElement>("a[data-select]");
	if (link && plainClick(e)) {
		e.preventDefault();
		hoveredStop = null;
		select(link.dataset.select ?? null, { focusSheet: e.detail === 0 });
		return;
	}
	const flowLink = e.target.closest<HTMLAnchorElement>("a[data-flow-link]");
	if (flowLink && plainClick(e)) {
		e.preventDefault();
		hoveredFlow = null;
		select(`flow-${flowLink.dataset.flowLink ?? ""}`, {
			focusSheet: e.detail === 0,
		});
		return;
	}
	const close = e.target.closest<HTMLAnchorElement>("[data-action='close']");
	if (close && plainClick(e)) {
		e.preventDefault();
		const was = selected;
		select(null);
		if (e.detail === 0 && was)
			nodeById.get(was)?.focus({ preventScroll: true });
	}
});

document.addEventListener("keydown", (e) => {
	if (e.key !== "Escape" || !selected) return;
	const was = selected;
	select(null);
	nodeById.get(was)?.focus({ preventScroll: true });
});

window.addEventListener("popstate", () => {
	select(location.hash.slice(1) || null, { push: false });
});

// スマートフォンでは、小さい図の表示範囲にする
function fitViewBox() {
	if (!svg) return;
	const vb = narrow.matches
		? svg.dataset.viewboxCompact
		: svg.dataset.viewboxFull;
	if (vb) svg.setAttribute("viewBox", vb);
}
narrow.addEventListener("change", fitViewBox);
fitViewBox();
if (svg) {
	setupTurn(svg, {
		compact: narrow,
		wide: window.matchMedia("(min-width: 1180px)"),
	});
}
reduceMotion.addEventListener("change", () => {
	dotFlow = null;
	render();
});
setupGrain();

// マウスについて動く丸。押せるものの上では広がり、リポジトリの点の上では点に吸い付き、図を回している間は少し大きくなる。
// マウスの矢印は隠し、この丸を矢印の代わりにする。丸は、マウスに少し遅れて、なめらかについてくる
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
if (finePointer.matches) {
	const cursor = document.createElement("div");
	cursor.className = "cursor";
	cursor.setAttribute("aria-hidden", "true");
	document.body.append(cursor);
	// 丸を出せたときだけ、矢印を隠す（style.css の has-cursor）
	root.classList.add("has-cursor");
	/** 丸がマウスに追いつくまでの、おおよその時間（秒）。大きいほど、ゆったり遅れてついてくる */
	const SMOOTH = 0.06;
	let x = 0;
	let y = 0;
	let vx = 0;
	let vy = 0;
	let tx = 0;
	let ty = 0;
	let frame = 0;
	let last = 0;
	/**
	 * 丸を、目標へ、ばね（臨界減衰）で近づける。速さを引き継ぐので、動き出しと止まり際がなめらかになる。
	 * マウスの動きに合わせて動くものなので、動きを減らす設定でも、なめらかに動かす
	 */
	const follow = (
		pos: number,
		goal: number,
		vel: number,
		dt: number,
	): [number, number] => {
		const w = 2 / SMOOTH;
		const k = w * dt;
		const e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k);
		const d = pos - goal;
		const s = (vel + w * d) * dt;
		return [goal + (d + s) * e, (vel - w * s) * e];
	};
	const draw = () => {
		cursor.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
	};
	const step = (now: number) => {
		const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
		last = now;
		[x, vx] = follow(x, tx, vx, dt);
		[y, vy] = follow(y, ty, vy, dt);
		draw();
		const settled =
			Math.abs(tx - x) < 0.05 &&
			Math.abs(ty - y) < 0.05 &&
			Math.abs(vx) < 1 &&
			Math.abs(vy) < 1;
		frame = settled ? 0 : requestAnimationFrame(step);
	};
	document.addEventListener("pointermove", (e) => {
		if (e.pointerType !== "mouse") return;
		const t = e.target instanceof Element ? e.target : null;
		const dot = t
			?.closest('.node[data-type="repo"]')
			?.querySelector(".node-dot");
		// 中心にのせると、丸が中心の輪を覆う大きさに広がり、アイコンの色を反転させる
		const ring = t?.closest(".map-hub")?.querySelector(".hub-ring");
		const snapTo = ring ?? dot;
		if (snapTo) {
			const r = snapTo.getBoundingClientRect();
			tx = r.left + r.width / 2;
			ty = r.top + r.height / 2;
			if (ring)
				cursor.style.setProperty("--hub", `${(r.width + 6).toFixed(1)}px`);
		} else {
			tx = e.clientX;
			ty = e.clientY;
		}
		const active = !!t?.closest("a, button, .node, .ruler-mark, .cat-label");
		cursor.classList.toggle("is-active", active && !snapTo);
		cursor.classList.toggle("is-snap", !!dot && !ring);
		cursor.classList.toggle("is-hub", !!ring);
		cursor.classList.toggle("is-grab", !!t?.closest(".map-svg.is-turning"));
		// 画面の外から戻ってきたときは、前の場所から飛んでこないよう、その位置から始める
		if (!cursor.classList.contains("is-visible")) {
			x = tx;
			y = ty;
			vx = 0;
			vy = 0;
			draw();
			cursor.classList.add("is-visible");
		}
		if (!frame) {
			last = performance.now();
			frame = requestAnimationFrame(step);
		}
	});
	// 図を回し終えたら、すぐに元の大きさに戻す
	document.addEventListener("pointerup", () => {
		cursor.classList.remove("is-grab");
	});
	document.documentElement.addEventListener("pointerleave", () => {
		cursor.classList.remove("is-visible");
	});
}

// 表示の色: 初めは Dark。ボタンで Light と切り替え、選んだ色を覚える（index.html が最初の表示の前に読み直す）。
// ボタンに出すアイコン（月と太陽）は CSS が決めるので、ここでは色と、読み上げの名前と、ブラウザの帯の色を変える
const themeButton = document.querySelector<HTMLButtonElement>(
	"[data-theme-toggle]",
);
const themeColor = document.querySelector<HTMLMetaElement>(
	'meta[name="theme-color"]',
);
type Theme = "light" | "dark";
const currentTheme = (): Theme =>
	root.dataset.theme === "light" ? "light" : "dark";
function applyTheme(t: Theme) {
	if (t === "light") root.dataset.theme = "light";
	else delete root.dataset.theme;
	themeColor?.setAttribute("content", t === "light" ? "#f2f1ec" : "#0e0f11");
	themeButton?.setAttribute(
		"aria-label",
		`Color theme: ${t === "light" ? "Light" : "Dark"}`,
	);
}
themeButton?.addEventListener("click", () => {
	const next: Theme = currentTheme() === "dark" ? "light" : "dark";
	applyTheme(next);
	try {
		localStorage.setItem("theme", next);
	} catch {
		// 保存できない環境でも、表示は切り替える
	}
});
applyTheme(currentTheme());

// 最初の表示（線を描く動きは index.html で付けた is-intro が始める）
history.scrollRestoration = "manual";
const initial = location.hash.slice(1) || null;
select(initial, { push: false });
// 開いた直後はブラウザが位置を戻すことがあるので、読み込みが終わってから図の位置へ動かす
if (selected && stacked.matches) {
	window.addEventListener(
		"load",
		() => requestAnimationFrame(() => scrollToMap("auto")),
		{ once: true },
	);
}
window.setTimeout(() => root.classList.remove("is-intro"), 3600);
