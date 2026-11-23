// 図の座標を計算する。中心を原点、角度は真上を 0 度として時計回りに測る。
// 線の形はロゴに合わせる。
// - カテゴリごとに平行な線の束が中心から出て、同じ中心を持つ角で 1 回だけ曲がり、円弧を進んだ先の端がリポジトリの点になる。
//   束の真ん中の線は曲がらずに外まで伸びる。
// - 外のもの（Discord など）は、時計の輪の外の、カテゴリの間（ラベルのない向き）に置く。
//   どの間に置くかは、つながる相手が近くなるように決める。箱から目盛りの輪へは、その向きのまま、まっすぐ入る。
// - 流れのつながりは、点の輪と目盛りの輪の間の帯に、中心と同じ円弧で描く（ふだんは隠し、選んだときだけ出す）。
//   外のものとのつながりは、目盛りの輪から始まる（輪から箱までは、箱から輪への線が受け持つ）。
// - 中心（4rtofl の GitHub）とのつながりは、リポジトリなら中心からの線を、外のものなら中心へまっすぐ引いた線を使う。
// - 線に添える短い説明は、線に沿って、名前・箱・カテゴリ名に重ならない所を探して置く。
// - 図は回せる（turn.ts）。点・線・目盛りは回転でまとめて動かし、名前・外のものの箱・カテゴリ名・中心の文字は、
//   向きに合わせて置き直す（置き方は place.ts）。ここでは、広い図（回していない向き）と、
//   スマートフォンの小さい図（名前が画面の幅に収まる向きに回したもの）の 2 つを計算する。

import type { Actor, Category, Flow, Project } from "./data.ts";
import {
	add,
	type Box,
	badgeWidth,
	catPlace,
	deg,
	f2 as f,
	mul,
	type NamePlace,
	norm,
	overlap,
	type Pt,
	placeName,
	polar,
	pt,
	rad,
	satBadgeAt,
	satBox,
	satInner,
	signed,
	tangent,
	turn,
	unit,
} from "./place.ts";

export type { Box, Pt } from "./place.ts";

/** 広い図（full）と、スマートフォンの小さい図（compact） */
export type Mode = "full" | "compact";
export const MODES: Mode[] = ["full", "compact"];

export interface NameLayout extends NamePlace {
	/** 名前の幅（字幅からの見積もり）・文字の大きさ・中心からの距離。図を回したときに置き直すのに使う */
	w: number;
	size: number;
	r: number;
}

export interface NodeLayout {
	project: Project;
	/** 1 から始まる通し番号 */
	index: number;
	angle: number;
	radius: number;
	pos: Pt;
	/** 中心から点までの線（SVG の path の d） */
	track: string;
	/** 名前を置く場所（広い図と小さい図。小さい図は、compactTurn だけ回した向きでの場所） */
	name: Record<Mode, NameLayout>;
}

/** 輪の外に置く、外のもの */
export interface SatLayout {
	actor: Actor;
	/** 置いた向き（カテゴリの間） */
	angle: number;
	/** 広い図での箱と線 */
	full: SatPlace;
	/** 小さい図（スマートフォン）での箱と線。名前を大きく書く */
	compact: SatPlace;
}

export interface SatPlace {
	/** 箱（小さい図は、compactTurn だけ回した向きでの場所） */
	box: Box;
	/** 箱の内側の端の、中心からの距離 */
	inner: number;
	/** 名前とぶつからないよう箱を外へ出すときの、目盛りの輪からの始めの距離と、名前との間 */
	gap: number;
	avoid: number;
	/** 箱から目盛りの輪までの線（回していない向きの座標。ふだんは点線、選んだときは実線） */
	port: { from: Pt; to: Pt };
}

export interface LinkLayout {
	/** 両端の id を並べたもの（例: "bobert~discord"） */
	id: string;
	ends: [string, string];
	/** このつながりを通る流れの id */
	flows: string[];
	/** 帯の円弧を使うつながりか、中心へまっすぐ引いた線か */
	kind: "band" | "spoke";
	d: string;
	/** 線を描く順（intro の動き） */
	order: number;
}

/** 線に添える短い説明（角の丸い枠に入れて出す） */
export interface PillLayout {
	text: string;
	/** 枠の真ん中 */
	at: Pt;
	w: number;
	/** 流れの id と、つながりの id か、中心からの線のリポジトリ */
	flow: string;
	link?: string;
	track?: string;
	/** 動く点がこの番号の段にいる間だけ出す */
	leg: number;
	/** この段で着く先（手順の名前にのせたときにも出す） */
	to: string;
}

export interface Badge {
	/** 回していない向きの座標 */
	at: Pt;
	/** 小さい図での場所（外のものの箱は、広い図と小さい図で場所が違う） */
	compactAt: Pt;
	text: string;
	actor: string;
	/** 外のものの箱に付ける番号なら、その id（図を回すと、箱に合わせて動かす） */
	sat?: string;
	/** 番号の枠の幅 */
	width: number;
}

export interface FlowLayout {
	flow: Flow;
	/** 進む順にたどる道（動く点が通る） */
	route: string;
	/** 本線の段ごとの、道全体の長さに対する始まりと終わりの割合 */
	legT: [number, number][];
	/** 光らせるつながり */
	links: string[];
	/** 光らせる、中心からリポジトリへの線（リポジトリの id） */
	tracks: string[];
	/** 出てくるもの（リポジトリと外のもの。中心は "github" などの id のまま） */
	actors: string[];
	/** 番号を置く場所 */
	badges: Badge[];
	/** 中心から、どのリポジトリへも広がる流れか（GitHub に Pull request を出す） */
	anyRepo: boolean;
}

export interface MapLayout {
	nodes: NodeLayout[];
	sats: SatLayout[];
	links: LinkLayout[];
	pills: PillLayout[];
	flows: FlowLayout[];
	categories: CategoryLayout[];
	/** 中心の輪の外に置く GitHub のアイコンの向き（線のない、いちばん広い間の真ん中） */
	hubBadge: { angle: number };
	viewBox: Box;
	compactViewBox: Box;
	/** 小さい図で、名前が画面の幅に収まるように図を回す角度 */
	compactTurn: number;
	ticks: { angle: number; major: boolean }[];
	rDial: number;
	hubId: string;
}

export interface CategoryLayout {
	category: Category;
	angle: number;
	/** 束の真ん中から、反時計回りの側の端までの幅（カテゴリ名をその外に置く） */
	side: number;
	label: { x: number; y: number; rotate: number; anchor: "start" | "end" };
}

export const GEOMETRY = {
	rHub: 64,
	/** 一番内側で曲がる線の半径 */
	rArc: 238,
	/** 束の線の間隔 */
	gap: 12,
	/** 一番内側で曲がる線の、角の半径 */
	filletBase: 12,
	/** つながりの帯の、いちばん内側の線と点の輪の間 */
	bandInset: 16,
	/** つながりの帯の線の間隔 */
	laneGap: 8,
	/** つながりの線の角の半径 */
	linkFillet: 6,
	/** リポジトリの名前の文字の大きさと、目盛りの輪からの距離（広い図と小さい図） */
	name: {
		full: { size: 19, gap: 17 },
		compact: { size: 26, gap: 12 },
	},
	/** 外のものの箱の文字 */
	satName: 11.5,
	/** 小さい図での、外のものの名前 */
	satCompact: 17,
	/** 外のものの箱を置き始める、目盛りの輪からの距離と、名前との間 */
	satGap: { full: 22, compact: 12 },
	satAvoid: { full: 10, compact: 6 },
	/** 線に添える説明の文字 */
	pillSize: 12,
} as const;

/** 束のいちばん外の線まで含めた半径（真ん中の線が届くところ） */
const rTop = (depth: number) => GEOMETRY.rArc + depth * GEOMETRY.gap;

const K = 0.5523; // 円弧を 3 次ベジェで近似するときの係数

/** 文字列の幅を、Geist のおおよその字幅から見積もる */
export function textWidth(text: string, size: number): number {
	const narrow = "ijlI.,:;'|!";
	const semi = "frt-() ";
	const wide = "mwMW";
	let w = 0;
	for (const ch of text) {
		if (narrow.includes(ch)) w += 0.26;
		else if (semi.includes(ch)) w += 0.37;
		else if (wide.includes(ch)) w += 0.8;
		else if (ch >= "A" && ch <= "Z") w += 0.64;
		else if (ch.charCodeAt(0) > 0x2e80) w += 1;
		else w += 0.54;
	}
	return w * size;
}

/** 等幅の大文字（字間 0.12em）の幅 */
export function monoWidth(text: string, size: number): number {
	return text.length * size * 0.72;
}

// ---------- path の部品 ----------

type Seg =
	| { t: "L"; to: Pt }
	| { t: "C"; c1: Pt; c2: Pt; to: Pt }
	| { t: "A"; r: number; sweep: 0 | 1; to: Pt };

interface Path {
	start: Pt;
	segs: Seg[];
}

function toD(p: Path): string {
	let d = `M${pt(p.start)}`;
	for (const s of p.segs) {
		if (s.t === "L") d += `L${pt(s.to)}`;
		else if (s.t === "C") d += `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.to)}`;
		else d += `A${f(s.r)} ${f(s.r)} 0 0 ${s.sweep} ${pt(s.to)}`;
	}
	return d;
}

function reverse(p: Path): Path {
	const pts = [p.start, ...p.segs.map((s) => s.to)];
	const segs: Seg[] = [];
	for (let i = p.segs.length - 1; i >= 0; i--) {
		const s = p.segs[i] as Seg;
		const to = pts[i] as Pt;
		if (s.t === "L") segs.push({ t: "L", to });
		else if (s.t === "C") segs.push({ t: "C", c1: s.c2, c2: s.c1, to });
		else segs.push({ t: "A", r: s.r, sweep: s.sweep === 1 ? 0 : 1, to });
	}
	return { start: pts[pts.length - 1] as Pt, segs };
}

/** 道をつなげる。前の道の終わりと次の道の始まりが離れていれば、そこで飛ぶ */
function join(paths: Path[]): string {
	let d = "";
	let last: Pt | null = null;
	for (const p of paths) {
		const same =
			last !== null &&
			Math.abs(last.x - p.start.x) < 0.5 &&
			Math.abs(last.y - p.start.y) < 0.5;
		d += same ? toD(p).replace(/^M[^LCA]+/, "") : toD(p);
		last = p.segs.length ? (p.segs[p.segs.length - 1] as Seg).to : p.start;
	}
	return d;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** 中心から見た向き（度） */
const angleAt = (p: Pt) => deg(Math.atan2(p.x, -p.y));

/** 円弧（中心は原点）で回る角度。時計回りが正 */
function arcTurn(from: Pt, s: { sweep: 0 | 1; to: Pt }): number {
	const a0 = angleAt(from);
	const a1 = angleAt(s.to);
	return s.sweep === 1 ? norm(a1 - a0) : -norm(a0 - a1);
}

function segLength(from: Pt, s: Seg): number {
	if (s.t === "L") return dist(from, s.to);
	if (s.t === "C") {
		// 弦と、制御点を結んだ折れ線の長さの平均で近づける
		return (
			(dist(from, s.to) +
				dist(from, s.c1) +
				dist(s.c1, s.c2) +
				dist(s.c2, s.to)) /
			2
		);
	}
	return rad(Math.abs(arcTurn(from, s))) * s.r;
}

/** 道の始まりから、全体の長さの t の割合だけ進んだ点 */
function pointAt(p: Path, t: number): Pt {
	const lens: number[] = [];
	let from = p.start;
	for (const s of p.segs) {
		lens.push(segLength(from, s));
		from = s.to;
	}
	let left = t * lens.reduce((a, b) => a + b, 0);
	from = p.start;
	for (const [i, s] of p.segs.entries()) {
		const len = lens[i] as number;
		if (left <= len || i === p.segs.length - 1) {
			const u = len > 0 ? Math.min(1, left / len) : 0;
			if (s.t === "L") return add(mul(from, 1 - u), mul(s.to, u));
			if (s.t === "C") {
				const v = 1 - u;
				return add(
					mul(from, v * v * v),
					mul(s.c1, 3 * v * v * u),
					mul(s.c2, 3 * v * u * u),
					mul(s.to, u * u * u),
				);
			}
			return polar(s.r, angleAt(from) + arcTurn(from, s) * u);
		}
		left -= len;
		from = s.to;
	}
	return from;
}

// ---------- 並べ方 ----------

interface Placed {
	project: Project;
	index: number;
	angle: number;
}

function placeAngles(groups: Project[][], start: number): Placed[] {
	const inner = groups.reduce((s, g) => s + g.length - 1, 0);
	// カテゴリの間は、プロジェクトの間の 2 倍あける
	const step = 360 / (inner + 2 * groups.length);
	const placed: Placed[] = [];
	let a = start;
	let index = 1;
	for (const g of groups) {
		for (const [i, p] of g.entries()) {
			if (i > 0) a += step;
			placed.push({ project: p, index: index++, angle: a });
		}
		a += 2 * step;
	}
	return placed;
}

/** カテゴリの間の真ん中の向き（並べ方の始まりを 0 にしたとき） */
function gapAngles(groups: Project[][]): number[] {
	const inner = groups.reduce((s, g) => s + g.length - 1, 0);
	const step = 360 / (inner + 2 * groups.length);
	const out: number[] = [];
	let a = 0;
	for (const g of groups) {
		a += (g.length - 1) * step;
		out.push(a + step);
		a += 2 * step;
	}
	return out;
}

function maxDepth(groups: Project[][]): number {
	let d = 0;
	for (const g of groups) {
		const m = Math.floor((g.length - 1) / 2);
		d = Math.max(d, m, g.length - 1 - m);
	}
	return d;
}

function permutations<T>(xs: T[]): T[][] {
	if (xs.length <= 1) return [xs];
	return xs.flatMap((x, i) =>
		permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [
			x,
			...rest,
		]),
	);
}

// ---------- ラベル ----------

/** 名前が重ならず、横に広がりすぎない回転ほど小さくなる点数 */
function scoreRotation(placed: Placed[], rName: number): number {
	const { size } = GEOMETRY.name.full;
	const boxes = placed.map(
		(p) => placeName(p.angle, textWidth(p.project.name, size), rName, size).box,
	);
	let score = 0;
	for (let i = 0; i < boxes.length; i++) {
		for (let j = i + 1; j < boxes.length; j++) {
			score += overlap(boxes[i] as Box, boxes[j] as Box, 8);
		}
	}
	// 真上と真下に近い点は、横に長いラベルが隣とぶつかりやすいので少し避ける
	for (const p of placed) {
		const c = Math.abs(Math.cos(rad(p.angle)));
		if (c > 0.97) score += 400 * (c - 0.97) * 100;
	}
	// 横に広がりすぎないようにする（図を大きく見せるため）
	let minX = 0;
	let maxX = 0;
	for (const b of boxes) {
		minX = Math.min(minX, b.x);
		maxX = Math.max(maxX, b.x + b.w);
	}
	score += Math.max(-minX, maxX) * 2;
	return score;
}

// ---------- 線 ----------

/** 中心から点までの線。d は束の中の位置（真ん中が 0、時計回りの側が正） */
function trackPath(
	angle: number,
	trunk: number,
	d: number,
	sideDepth: number,
	depth: number,
): { path: Path; r: number } {
	const { rHub, rArc, gap, filletBase } = GEOMETRY;
	if (d === 0) {
		const r = rTop(depth);
		return {
			path: {
				start: polar(rHub, trunk),
				segs: [{ t: "L", to: polar(r, trunk) }],
			},
			r,
		};
	}
	const side = Math.sign(d);
	// 曲がる方向の端にある線ほど、内側で先に曲がる（ロゴと同じ）
	const step = sideDepth - Math.abs(d);
	const o = d * gap;
	const rt = rArc + step * gap;
	let f1 = filletBase + step * gap;
	const uc = unit(trunk);
	const vc = tangent(trunk);
	const start = add(mul(uc, Math.sqrt(rHub * rHub - o * o)), mul(vc, o));
	const tTurn = Math.sqrt(rt * rt - o * o);
	const turnAngle = trunk + deg(Math.atan2(o, tTurn));
	const avail = rad(side * (angle - turnAngle)) * rt;
	if (f1 > avail * 0.8) f1 = avail * 0.8;
	const a1 = add(mul(uc, tTurn - f1), mul(vc, o));
	const b1Angle = turnAngle + side * deg(f1 / rt);
	const b1 = polar(rt, b1Angle);
	const c1 = add(a1, mul(uc, K * f1));
	const c2 = add(b1, mul(tangent(b1Angle), -side * K * f1));
	return {
		path: {
			start,
			segs: [
				{ t: "L", to: a1 },
				{ t: "C", c1, c2, to: b1 },
				{ t: "A", r: rt, sweep: side > 0 ? 1 : 0, to: polar(rt, angle) },
			],
		},
		r: rt,
	};
}

/**
 * 帯のつながり。端 a から高さ lane まで向きを変えずに進み、円弧で近いほうへ回って、端 b の向きで b へ向かう。
 * 端は、輪の内側（リポジトリの点）にも外側（外のものの箱）にもなれる。
 */
function bandPath(
	ta: number,
	ra: number,
	tb: number,
	rb: number,
	lane: number,
): Path {
	const s = signed(ta, tb);
	const dir = Math.sign(s) || 1;
	let fr: number = GEOMETRY.linkFillet;
	const avail = rad(Math.abs(s)) * lane;
	if (fr > avail * 0.45) fr = avail * 0.45;
	const dA = deg(fr / lane);
	const sweep: 0 | 1 = dir > 0 ? 1 : 0;
	// 内側から来る端は lane - fr で、外側から来る端は lane + fr で曲がり始める
	const inA = ra < lane ? 1 : -1;
	const inB = rb < lane ? 1 : -1;
	const p0 = polar(ra, ta);
	const p1 = polar(lane - inA * fr, ta);
	const p2 = polar(lane, ta + dir * dA);
	const p3 = polar(lane, tb - dir * dA);
	const p4 = polar(lane - inB * fr, tb);
	const p5 = polar(rb, tb);
	return {
		start: p0,
		segs: [
			{ t: "L", to: p1 },
			{
				t: "C",
				c1: add(p1, mul(unit(ta), inA * K * fr)),
				c2: add(p2, mul(tangent(ta + dir * dA), -dir * K * fr)),
				to: p2,
			},
			{ t: "A", r: lane, sweep, to: p3 },
			{
				t: "C",
				c1: add(p3, mul(tangent(tb - dir * dA), dir * K * fr)),
				c2: add(p4, mul(unit(tb), inB * K * fr)),
				to: p4,
			},
			{ t: "L", to: p5 },
		],
	};
}

// ---------- 全体 ----------

export function layoutMap(
	categories: Category[],
	projects: Project[],
	actors: Actor[],
	flows: Flow[],
): MapLayout {
	const { rHub, gap, bandInset, laneGap } = GEOMETRY;
	const groups = categories
		.map((c) => projects.filter((p) => p.category === c.id))
		.filter((g) => g.length > 0);
	const depth = maxDepth(groups);
	const rRing = rTop(depth);

	// 流れに出てくるものを、図の上の id に直す（リポジトリは projects の id、中心は hubId）
	const hub = actors.find((a) => a.hub);
	const hubId = hub?.id ?? "github";
	const placeOf = (actorId: string): string => {
		const a = actors.find((x) => x.id === actorId);
		if (!a) return actorId;
		if (a.hub) return hubId;
		return a.project ?? a.id;
	};
	const projectIds = new Set(projects.map((p) => p.id));
	const exts = actors.filter(
		(a) =>
			!a.project &&
			!a.hub &&
			flows.some((fl) =>
				fl.stops.some((s) => s.actor === a.id || s.branch?.actor === a.id),
			),
	);
	const extIds = new Set(exts.map((a) => a.id));

	// 流れを、つながり（2 つの id の組）に分ける。一度通ったところへ戻る段は、始まりの場所へ戻るとき（返事が届くなど）だけ線を引かない
	interface Leg {
		from: string;
		to: string;
		label: string;
		/** 説明を出すときの、本線の段の番号（横から合流する段は、合流先へ来る本線の段と一緒に出す） */
		leg: number;
	}
	const legsOf = (fl: Flow) => {
		const main: Leg[] = [];
		const branches: Leg[] = [];
		const first = fl.stops[0] ? placeOf(fl.stops[0].actor) : "";
		let prev: string | null = null;
		for (const [i, s] of fl.stops.entries()) {
			const here = placeOf(s.actor);
			// 始まりの場所へ戻る段（返事が届くなど）は、説明があるときだけ線を引く
			const back = i > 0 && here === first;
			if (prev !== null && here !== prev && (!back || s.label)) {
				main.push({
					from: prev,
					to: here,
					label: s.label ?? "",
					leg: main.length,
				});
			}
			if (!back) prev = here;
			if (s.branch) {
				const other = placeOf(s.branch.actor);
				const label = s.branch.label ?? "";
				const leg = Math.max(0, main.length - 1);
				branches.push(
					s.branch.dir === "in"
						? { from: other, to: here, label, leg }
						: { from: here, to: other, label, leg },
				);
			}
		}
		return { main, branches };
	};
	const linkKey = (a: string, b: string) => [a, b].sort().join("~");
	const linkFlows = new Map<string, Set<string>>();
	for (const fl of flows) {
		const { main, branches } = legsOf(fl);
		for (const l of [...main, ...branches]) {
			const key = linkKey(l.from, l.to);
			if (!linkFlows.has(key)) linkFlows.set(key, new Set());
			linkFlows.get(key)?.add(fl.id);
		}
	}

	// 外のものを置く間を決める（並べ方の始まりを 0 にした向きで考える）
	const rel = placeAngles(groups, 0);
	const relAngle = new Map(rel.map((p) => [p.project.id, p.angle]));
	const gaps = gapAngles(groups);
	const ringPairs: [string, string][] = [...linkFlows.keys()]
		.map((k) => k.split("~") as [string, string])
		.filter(([a, b]) => a !== hubId && b !== hubId);
	let bestGaps = new Map<string, number>();
	let bestCost = Number.POSITIVE_INFINITY;
	const slots = gaps.map((_, i) => i);
	for (const order of permutations(slots)) {
		const at = new Map<string, number>();
		for (const [i, a] of exts.entries()) {
			const g = order[i];
			if (g !== undefined) at.set(a.id, gaps[g] as number);
		}
		let cost = 0;
		for (const [a, b] of ringPairs) {
			const pa = relAngle.get(a) ?? at.get(a);
			const pb = relAngle.get(b) ?? at.get(b);
			if (pa === undefined || pb === undefined) continue;
			cost += Math.abs(signed(pa, pb));
		}
		if (cost < bestCost - 1e-6) {
			bestCost = cost;
			bestGaps = at;
		}
	}
	const relOf = (id: string) => relAngle.get(id) ?? bestGaps.get(id) ?? 0;

	// 帯の線の高さ（短いつながりほど内側）。同じ端につながるものは、同じ高さにしない
	interface Band {
		key: string;
		a: string;
		b: string;
		s: number;
		e: number;
		lane: number;
		flows: Set<string>;
	}
	const bands: Band[] = ringPairs
		.map(([a, b]) => {
			const pa = relOf(a);
			const d = signed(pa, relOf(b));
			const s = Math.min(pa, pa + d);
			const key = linkKey(a, b);
			return {
				key,
				a,
				b,
				s,
				e: s + Math.abs(d),
				lane: 0,
				flows: linkFlows.get(key) ?? new Set<string>(),
			};
		})
		.sort((x, y) => x.e - x.s - (y.e - y.s) || x.s - y.s);
	const overlaps = (x: Band, y: Band) =>
		[-360, 0, 360].some(
			(sh) => x.s <= y.e + sh + 1e-6 && y.s + sh <= x.e + 1e-6,
		);
	// 線は選んだときだけ出るので、いっしょに出る線（同じ端につながる・同じ流れに出る）だけを別の高さに分ける
	const together = (x: Band, y: Band) =>
		x.a === y.a ||
		x.a === y.b ||
		x.b === y.a ||
		x.b === y.b ||
		[...x.flows].some((fl) => y.flows.has(fl));
	const assigned: Band[] = [];
	for (const b of bands) {
		let lane = 0;
		while (
			assigned.some((o) => o.lane === lane && overlaps(o, b) && together(o, b))
		)
			lane++;
		b.lane = lane;
		assigned.push(b);
	}
	const lanes = bands.length ? Math.max(...bands.map((b) => b.lane)) + 1 : 0;
	const laneR = (k: number) => rRing + bandInset + k * laneGap;
	// 外の目盛りの輪は、帯のいちばん外の線の少し外に置く
	const rDial = lanes ? laneR(lanes - 1) + 16 : rRing + 18;
	// 名前を置く、中心からの距離（広い図と小さい図）
	const rName: Record<Mode, number> = {
		full: rDial + GEOMETRY.name.full.gap,
		compact: rDial + GEOMETRY.name.compact.gap,
	};

	// ラベルが重ならない回転を探す
	let best = 0;
	let bestScore = Number.POSITIVE_INFINITY;
	for (let a = 0; a < 360; a += 0.5) {
		const s = scoreRotation(placeAngles(groups, a), rName.full);
		if (s < bestScore - 1e-6) {
			bestScore = s;
			best = a;
		}
	}
	const placed = placeAngles(groups, best);
	const angleOf = (id: string) => best + relOf(id);

	/** 名前の置き場所。図を turnBy だけ回したときの場所を返す */
	const nameAt = (
		p: Project,
		angle: number,
		mode: Mode,
		turnBy: number,
	): NameLayout => {
		const { size } = GEOMETRY.name[mode];
		const w = f(textWidth(p.name, size));
		const r = rName[mode];
		return { ...placeName(angle + turnBy, w, r, size), w, size, r };
	};

	// リポジトリの線
	const nodes: NodeLayout[] = [];
	const cats: CategoryLayout[] = [];
	const trackPaths = new Map<string, Path>();
	for (const category of categories) {
		const group = placed.filter((p) => p.project.category === category.id);
		if (group.length === 0) continue;
		const m = Math.floor((group.length - 1) / 2);
		const trunk = (group[m] as Placed).angle;
		const depthCw = group.length - 1 - m;
		const depthCcw = m;
		for (const [k, p] of group.entries()) {
			const d = k - m;
			const t = trackPath(p.angle, trunk, d, d > 0 ? depthCw : depthCcw, depth);
			trackPaths.set(p.project.id, t.path);
			const full = nameAt(p.project, p.angle, "full", 0);
			nodes.push({
				project: p.project,
				index: p.index,
				angle: p.angle,
				radius: t.r,
				pos: polar(t.r, p.angle),
				track: toD(t.path),
				// 小さい図の名前は、回す角度が決まってから置き直す
				name: { full, compact: full },
			});
		}
		// カテゴリ名は、束の反時計回りの側に、中心から外へ向かって書く
		const side = depthCcw * gap;
		cats.push({
			category,
			angle: trunk,
			side,
			label: catPlace(trunk, side, rHub),
		});
	}
	nodes.sort((a, b) => a.index - b.index);

	// 外のもの: カテゴリの間の向きに、リポジトリの名前とぶつからないところまで外へ出して置く
	const { satName, satCompact } = GEOMETRY;
	const satSize = (a: Actor, mode: Mode) => {
		const name = a.name.toUpperCase();
		// 小さい図は、名前を大きく書く（字間 0.08em）
		return mode === "full"
			? { w: f(monoWidth(name, satName) + 26), h: 30 }
			: { w: f(name.length * satCompact * 0.68 + 20), h: 32 };
	};
	const satAt = (
		a: Actor,
		angle: number,
		mode: Mode,
		turnBy: number,
		names: Box[],
	): SatPlace => {
		const { w, h } = satSize(a, mode);
		const gapOut = GEOMETRY.satGap[mode];
		const avoid = GEOMETRY.satAvoid[mode];
		const inner = satInner(angle + turnBy, w, h, rDial + gapOut, names, avoid);
		return {
			box: satBox(angle + turnBy, w, h, inner),
			inner,
			gap: gapOut,
			avoid,
			port: { from: polar(inner, angle), to: polar(rDial, angle) },
		};
	};
	const satActors = exts
		.filter((a) => bestGaps.has(a.id))
		.map((a) => ({ actor: a, angle: angleOf(a.id) }));
	const fullNames = nodes.map((n) => n.name.full.box);

	// 小さい図では、名前が画面の幅に収まるよう、左右に出る幅がいちばん狭くなる角度に図を回す
	let compactTurn = 0;
	let compactCost = Number.POSITIVE_INFINITY;
	for (let r = 0; r < 360; r += 0.5) {
		const boxes = nodes.map(
			(n) => nameAt(n.project, n.angle, "compact", r).box,
		);
		let clash = false;
		for (let i = 0; i < boxes.length && !clash; i++) {
			for (let j = i + 1; j < boxes.length; j++) {
				if (overlap(boxes[i] as Box, boxes[j] as Box, 4) > 0) {
					clash = true;
					break;
				}
			}
		}
		if (clash) continue;
		let half = 0;
		for (const b of [
			...boxes,
			...satActors.map((s) => satAt(s.actor, s.angle, "compact", r, boxes).box),
		]) {
			half = Math.max(half, -b.x, b.x + b.w);
		}
		// 同じくらいなら、回す角度の小さいほう
		const cost = half + 0.01 * Math.min(r, 360 - r);
		if (cost < compactCost - 1e-6) {
			compactCost = cost;
			compactTurn = r;
		}
	}
	for (const n of nodes) {
		n.name.compact = nameAt(n.project, n.angle, "compact", compactTurn);
	}
	const compactNames = nodes.map((n) => n.name.compact.box);
	const sats: SatLayout[] = satActors.map(({ actor, angle }) => ({
		actor,
		angle,
		full: satAt(actor, angle, "full", 0, fullNames),
		compact: satAt(actor, angle, "compact", compactTurn, compactNames),
	}));
	const labelBoxes = fullNames;

	const placeAngle = new Map<string, number>();
	const placeR = new Map<string, number>();
	for (const n of nodes) {
		placeAngle.set(n.project.id, n.angle);
		placeR.set(n.project.id, n.radius);
	}
	// 外のものとのつながりは、目盛りの輪から始める
	for (const s of sats) {
		placeAngle.set(s.actor.id, s.angle);
		placeR.set(s.actor.id, rDial);
	}

	// つながりの線
	const bandByKey = new Map(bands.map((b) => [b.key, b]));
	const bandOf = (from: string, to: string) => {
		const band = bandByKey.get(linkKey(from, to));
		if (!band) return null;
		return {
			path: bandPath(
				placeAngle.get(from) ?? 0,
				placeR.get(from) ?? rRing,
				placeAngle.get(to) ?? 0,
				placeR.get(to) ?? rRing,
				laneR(band.lane),
			),
			lane: laneR(band.lane),
		};
	};
	const links: LinkLayout[] = [];
	const linkPaths = new Map<string, Path>();
	const spokePaths = new Map<string, Path>();
	let order = 0;
	for (const [key, fls] of linkFlows) {
		const [a, b] = key.split("~") as [string, string];
		if (a === hubId || b === hubId) {
			const other = a === hubId ? b : a;
			if (!extIds.has(other)) continue; // リポジトリと中心は、中心からの線で表す
			const ang = placeAngle.get(other) ?? 0;
			const path: Path = {
				start: polar(placeR.get(other) ?? rDial, ang),
				segs: [{ t: "L", to: polar(rHub, ang) }],
			};
			spokePaths.set(other, path);
			linkPaths.set(key, path);
			links.push({
				id: key,
				ends: [other, hubId],
				flows: [...fls],
				kind: "spoke",
				d: toD(path),
				order: order++,
			});
			continue;
		}
		const bp = bandOf(a, b);
		if (!bp) continue;
		linkPaths.set(key, bp.path);
		links.push({
			id: key,
			ends: [a, b],
			flows: [...fls],
			kind: "band",
			d: toD(bp.path),
			order: order++,
		});
	}

	// 流れごとの道と番号
	const legPath = (l: Leg): Path | null => {
		if (l.from === hubId || l.to === hubId) {
			const other = l.from === hubId ? l.to : l.from;
			const p = projectIds.has(other)
				? trackPaths.get(other)
				: spokePaths.get(other);
			if (!p) return null;
			// リポジトリの線は中心から点へ、外のものの線は点から中心へ向いている
			const fromHub = projectIds.has(other) ? p : reverse(p);
			return l.from === hubId ? fromHub : reverse(fromHub);
		}
		return bandOf(l.from, l.to)?.path ?? null;
	};
	const flowLayouts: FlowLayout[] = flows.map((fl) => {
		const { main, branches } = legsOf(fl);
		const routeParts = main.map(legPath).filter((p): p is Path => p !== null);
		const pathLength = (pa: Path) => {
			let from = pa.start;
			let total = 0;
			for (const sg of pa.segs) {
				total += segLength(from, sg);
				from = sg.to;
			}
			return total;
		};
		const lens = main.map((l) => {
			const pa = legPath(l);
			return pa ? pathLength(pa) : 0;
		});
		const whole = lens.reduce((a, b) => a + b, 0) || 1;
		let acc = 0;
		const legT = lens.map((len): [number, number] => {
			const t0 = acc / whole;
			acc += len;
			return [Number(t0.toFixed(4)), Number((acc / whole).toFixed(4))];
		});
		const linkIds = new Set<string>();
		const trackIds = new Set<string>();
		for (const l of [...main, ...branches]) {
			const other =
				l.from === hubId ? l.to : l.to === hubId ? l.from : undefined;
			if (other !== undefined && projectIds.has(other)) trackIds.add(other);
			else linkIds.add(linkKey(l.from, l.to));
		}
		// 番号: 同じところに何度も来るときは「1·5」のようにまとめる
		const steps = new Map<string, number[]>();
		for (const [i, s] of fl.stops.entries()) {
			const here = placeOf(s.actor);
			if (!steps.has(here)) steps.set(here, []);
			steps.get(here)?.push(i + 1);
		}
		const hubEntry = (() => {
			const l =
				main.find((x) => x.to === hubId) ?? main.find((x) => x.from === hubId);
			const p = l ? legPath(l) : null;
			if (!p) return polar(rHub, 0);
			if (l?.to === hubId) return (p.segs[p.segs.length - 1] as Seg).to;
			return p.start;
		})();
		const badges = [...steps].map(([id, nums]): Badge => {
			const sat = sats.find((s) => s.actor.id === id);
			const text = nums.join("·");
			const width = badgeWidth(text);
			if (sat) {
				// 外のものの箱に付ける番号は、箱に合わせて置く。番号は回した図の中にあるので、回す前の向きの座標に直す
				const at = satBadgeAt(sat.full.box, sat.angle, width, false);
				const c = satBadgeAt(
					sat.compact.box,
					sat.angle + compactTurn,
					width,
					true,
				);
				return {
					at,
					compactAt: turn(c, -compactTurn),
					text,
					actor: id,
					sat: id,
					width,
				};
			}
			const at =
				id === hubId
					? hubEntry
					: polar(placeR.get(id) ?? rRing, placeAngle.get(id) ?? 0);
			return { at, compactAt: at, text, actor: id, width };
		});
		const actorsIn = new Set<string>();
		for (const s of fl.stops) {
			actorsIn.add(placeOf(s.actor));
			if (s.branch) actorsIn.add(placeOf(s.branch.actor));
		}
		return {
			flow: fl,
			route: join(routeParts),
			legT,
			links: [...linkIds],
			tracks: [...trackIds],
			actors: [...actorsIn],
			badges,
			anyRepo: main.some(
				(l) => l.to === hubId && extIds.has(l.from) && l.from !== hubId,
			),
		};
	});

	// 線に添える説明。線に沿っていくつかの場所を試し、かぶってはいけないものと重ならない、真ん中に近い場所を選ぶ
	const { pillSize } = GEOMETRY;
	const pad = (b: Box, d: number): Box => ({
		x: b.x - d,
		y: b.y - d,
		w: b.w + 2 * d,
		h: b.h + 2 * d,
	});
	// 名前と箱には、少しでも重ねない（重さ 3）。点・線・カテゴリ名は、できるだけ避ける（重さ 1）
	const hard: Box[] = [
		...labelBoxes.map((b) => pad(b, 4)),
		// 外のものの箱のすぐ横の説明は、その箱の説明に見えるので、少し離す
		...sats.map((s) => pad(s.full.box, 32)),
	];
	const blocked: Box[] = [
		...nodes.map((n) => ({ x: n.pos.x - 12, y: n.pos.y - 12, w: 24, h: 24 })),
	];
	// 外のものの箱から目盛りの輪へ入る線と、その付け根（ほかの説明と見分けにくくなる）
	for (const st of sats) {
		const { from, to } = st.full.port;
		const len = dist(from, to);
		for (let d = 0; d <= len; d += 6) {
			const q = add(from, mul(add(to, mul(from, -1)), d / Math.max(len, 1)));
			blocked.push({ x: q.x - 5, y: q.y - 5, w: 10, h: 10 });
		}
		blocked.push({ x: to.x - 16, y: to.y - 16, w: 32, h: 32 });
	}
	// カテゴリ名は、束に沿って中心から外へ書いてある
	for (const c of cats) {
		const text = c.category.label;
		const len = text.length * 9 * 0.78 + 7;
		const u = unit(c.angle);
		for (let d = 0; d <= len; d += 6) {
			const q = add({ x: c.label.x, y: c.label.y }, mul(u, d));
			blocked.push({ x: q.x - 6, y: q.y - 6, w: 12, h: 12 });
		}
	}
	// 中心の輪と、そのまわりの「GITHUB · 4RTOFL」にもかぶせない
	const hubClear = rHub + 18;
	const intoHub = (b: Box) => {
		const dx = Math.max(b.x, 0, -(b.x + b.w));
		const dy = Math.max(b.y, 0, -(b.y + b.h));
		return Math.max(0, hubClear - Math.hypot(dx, dy));
	};
	// 線に沿って試す場所（始まりからの長さの割合）。好む場所 center から離れるほど少しずつ損にする
	interface Tries {
		center: number;
		from: number;
		to: number;
	}
	const BAND_T: Tries = { center: 0.5, from: 0.12, to: 0.88 };
	const SPOKE_T: Tries = { center: 0.5, from: 0.25, to: 0.75 };
	const TRACK_T: Tries = { center: 0.64, from: 0.4, to: 0.9 };
	const placePill = (path: Path, text: string, tries: Tries, near: Box[]) => {
		const w = textWidth(text, pillSize) + 18;
		const h = 22;
		let best = { at: path.start, box: { x: 0, y: 0, w, h } };
		let bestCost = Number.POSITIVE_INFINITY;
		for (let t = tries.from; t <= tries.to + 1e-9; t += 0.02) {
			const at = pointAt(path, t);
			const box = { x: at.x - w / 2, y: at.y - h / 2, w, h };
			let cost = Math.abs(t - tries.center) * 60 + intoHub(box) * 200;
			for (const b of hard) cost += overlap(box, b, 0) * 3;
			for (const b of blocked) cost += overlap(box, b, 0);
			for (const b of near) cost += overlap(box, b, 4) * 3;
			if (cost < bestCost - 1e-6) {
				bestCost = cost;
				best = { at, box };
			}
		}
		return { at: best.at, w, box: best.box };
	};
	const pills: PillLayout[] = [];
	// 流れを選んだとき: その流れの説明と番号どうしを重ねない
	for (const fl of flowLayouts) {
		const { main, branches } = legsOf(fl.flow);
		const near: Box[] = fl.badges.map((b) => ({
			x: b.at.x - 12,
			y: b.at.y - 12,
			w: 24,
			h: 24,
		}));
		const seen = new Set<string>();
		for (const l of [...main, ...branches]) {
			const key = linkKey(l.from, l.to);
			if (!l.label || seen.has(key)) continue;
			seen.add(key);
			const other =
				l.from === hubId ? l.to : l.to === hubId ? l.from : undefined;
			const track =
				other !== undefined && projectIds.has(other) ? other : undefined;
			const path = track ? trackPaths.get(track) : linkPaths.get(key);
			if (!path) continue;
			const ts = track ? TRACK_T : other !== undefined ? SPOKE_T : BAND_T;
			const p = placePill(path, l.label, ts, near);
			near.push(p.box);
			pills.push({
				text: l.label,
				at: p.at,
				w: p.w,
				flow: fl.flow.id,
				...(track ? { track } : { link: key }),
				leg: l.leg,
				to: l.to,
			});
		}
	}

	// 中心の輪の外に GitHub のアイコンを置く。線のないいちばん広い向きを探す
	const used = [
		...cats.map((c) => c.angle),
		...[...spokePaths.keys()].map((id) => placeAngle.get(id) ?? 0),
	].map(norm);
	used.sort((x, y) => x - y);
	let capAngle = 180;
	let widest = -1;
	for (const [i, a] of used.entries()) {
		const next =
			i + 1 < used.length ? (used[i + 1] as number) : (used[0] as number) + 360;
		if (next - a > widest) {
			widest = next - a;
			capAngle = (a + next) / 2;
		}
	}
	const hubBadge = { angle: f(capAngle) };

	// 目盛り: 2.5 度ごとの細かい目盛りと、点の向きの長い目盛り
	const ticks = [
		...Array.from({ length: 144 }, (_, i) => ({
			angle: i * 2.5,
			major: false,
		})),
		...nodes.map((n) => ({ angle: n.angle, major: true })),
	];

	// 表示範囲は、円とラベルと外のものが収まる大きさにする（中心を真ん中に保つ）
	const margin = 24;
	let halfW = rDial + 12;
	let halfH = rDial + 12;
	for (const b of [...labelBoxes, ...sats.map((s) => s.full.box)]) {
		halfW = Math.max(halfW, -b.x, b.x + b.w);
		halfH = Math.max(halfH, -b.y, b.y + b.h);
	}
	halfW += margin;
	halfH += margin;
	const viewBox = {
		x: f(-halfW),
		y: f(-halfH),
		w: f(halfW * 2),
		h: f(halfH * 2),
	};
	// 小さい図は、回した向きで、円と名前と外のものの箱（上に付く番号は 1.7 倍になる）が収まる大きさにする
	const compactMargin = 10;
	let cw = rDial + 12;
	let ch = rDial + 12;
	for (const b of [
		...nodes.map((n) => n.name.compact.box),
		...sats.map((s) => s.compact.box),
		...sats.map((s) => ({ ...s.compact.box, y: s.compact.box.y - 26 })),
	]) {
		cw = Math.max(cw, -b.x, b.x + b.w);
		ch = Math.max(ch, -b.y, b.y + b.h);
	}
	cw += compactMargin;
	ch += compactMargin;
	const compactViewBox = {
		x: f(-cw),
		y: f(-ch),
		w: f(cw * 2),
		h: f(ch * 2),
	};

	return {
		nodes,
		sats,
		links,
		pills,
		flows: flowLayouts,
		categories: cats,
		hubBadge,
		viewBox,
		compactViewBox,
		compactTurn,
		ticks,
		rDial,
		hubId,
	};
}
