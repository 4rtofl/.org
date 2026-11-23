// 図の上で、名前・外のものの箱・カテゴリ名を置く場所を決める計算。
// ビルドのとき（layout.ts）と、図を回している間（turn.ts）の両方で使うので、ブラウザでも動く書き方だけにする。
// 中心を原点、角度は真上を 0 度として時計回りに測る。

export interface Pt {
	x: number;
	y: number;
}

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
export const unit = (a: number): Pt => ({
	x: Math.sin(rad(a)),
	y: -Math.cos(rad(a)),
});
/** 時計回りの接線の向き */
export const tangent = (a: number): Pt => ({
	x: Math.cos(rad(a)),
	y: Math.sin(rad(a)),
});
export const polar = (r: number, a: number): Pt => ({
	x: r * Math.sin(rad(a)),
	y: -r * Math.cos(rad(a)),
});
export const add = (...ps: Pt[]): Pt =>
	ps.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
export const mul = (p: Pt, k: number): Pt => ({ x: p.x * k, y: p.y * k });
/** 中心のまわりに a 度、時計回りに回した点 */
export function turn(p: Pt, a: number): Pt {
	const c = Math.cos(rad(a));
	const s = Math.sin(rad(a));
	return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}
export const norm = (a: number) => ((a % 360) + 360) % 360;
/** a から b への、近いほうの向きの差（時計回りが正） */
export const signed = (a: number, b: number) =>
	((((b - a) % 360) + 540) % 360) - 180;
export const f2 = (n: number) => Number(n.toFixed(2));
export const pt = (p: Pt) => `${f2(p.x)} ${f2(p.y)}`;

/** 2 つの箱の重なり（それぞれを pad だけ広げて測る）。重ならなければ 0 */
export function overlap(a: Box, b: Box, pad: number): number {
	const w =
		Math.min(a.x + a.w + pad, b.x + b.w + pad) - Math.max(a.x - pad, b.x - pad);
	const h =
		Math.min(a.y + a.h + pad, b.y + b.h + pad) - Math.max(a.y - pad, b.y - pad);
	return w > 0 && h > 0 ? w * h : 0;
}

/** 箱 b が、outer の内側（縁から pad 以上離れた所）に収まっているか */
export function inside(b: Box, outer: Box, pad = 0): boolean {
	return (
		b.x >= outer.x + pad &&
		b.y >= outer.y + pad &&
		b.x + b.w <= outer.x + outer.w - pad &&
		b.y + b.h <= outer.y + outer.h - pad
	);
}

export interface NamePlace {
	anchor: "start" | "end" | "middle";
	x: number;
	/** 文字の基準線 */
	y: number;
	box: Box;
}

/**
 * リポジトリの名前を、中心から r の所に横書きで置く。幅 w、文字の大きさ size。
 * 右側では点から右へ、左側では左へ伸ばし、真上と真下の近くでは点の上か下の真ん中に置く。
 * その間は少しずつずらすので、図を回しても名前は飛ばずに動く。
 */
export function placeName(
	angle: number,
	w: number,
	r: number,
	size: number,
): NamePlace {
	const h = size * (22 / 19);
	const gap = size * (2 / 19);
	const s = Math.sin(rad(angle));
	const c = Math.cos(rad(angle));
	const at = polar(r, angle);
	// k: 1 なら点から右へ、-1 なら左へ、0 なら点の真ん中。m: 点の上か下へずらす割合
	const k = Math.max(-1, Math.min(1, s / 0.3));
	const m = 1 - Math.abs(k);
	const left = at.x - w / 2 + (k * w) / 2;
	const top = at.y - h / 2 + m * (c > 0 ? gap - h / 2 : h / 2 + gap);
	const anchor = k >= 1 ? "start" : k <= -1 ? "end" : "middle";
	return {
		anchor,
		x: anchor === "middle" ? left + w / 2 : at.x,
		y: top + size * (16 / 19),
		box: { x: left, y: top, w, h },
	};
}

/** 外のものの箱を、angle の向きに、箱の内側の端が中心から inner の所に来るように置く */
export function satBox(
	angle: number,
	w: number,
	h: number,
	inner: number,
): Box {
	const u = unit(angle);
	const t = Math.min(
		w / 2 / Math.max(Math.abs(u.x), 1e-6),
		h / 2 / Math.max(Math.abs(u.y), 1e-6),
	);
	const c = polar(inner + t, angle);
	return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/**
 * 外のものの箱を、名前（avoid）と pad 以上離れるところまで、中心から from の所から外へ出していく。
 * 返すのは、箱の内側の端の、中心からの距離。
 */
export function satInner(
	angle: number,
	w: number,
	h: number,
	from: number,
	avoid: Box[],
	pad: number,
): number {
	for (let inner = from; inner < from + 240; inner += 4) {
		const b = satBox(angle, w, h, inner);
		if (avoid.every((x) => overlap(b, x, pad) === 0)) return inner;
	}
	return from + 240;
}

/** 流れの番号の枠の幅（1 文字なら丸、2 文字以上なら角の丸い四角） */
export const badgeWidth = (text: string) =>
	text.length > 1 ? 10 + text.length * 5.6 : 18;

/** 小さい図（スマートフォン）では、番号を CSS で 1.7 倍に描く */
export const COMPACT_BADGE_SCALE = 1.7;

/**
 * 外のものの箱に付ける流れの番号の場所。広い図では箱の左上の角。
 * 小さい図では番号が大きくなるので、名前にかからないよう、箱の上の、輪に近い側の角の外へずらす。
 */
export function satBadgeAt(
	box: Box,
	angle: number,
	width: number,
	compact: boolean,
): Pt {
	if (!compact) return { x: box.x, y: box.y };
	const half = (width * COMPACT_BADGE_SCALE) / 2;
	const rightHalf = norm(angle) < 180;
	return {
		x: rightHalf ? box.x + 6 - half : box.x + box.w - 6 + half,
		y: box.y - 9,
	};
}

export interface CatPlace {
	x: number;
	y: number;
	rotate: number;
	anchor: "start" | "end";
}

/**
 * カテゴリ名は、束の反時計回りの側（束の真ん中から side 離れた所）に、中心から外へ向かって書く。
 * 文字が逆さにならないよう、左半分では向きを変える。
 */
export function catPlace(trunk: number, side: number, rHub: number): CatPlace {
	const n0 = norm(trunk);
	const rightHalf = n0 > 0 && n0 < 180;
	const lateral = -side - (rightHalf ? 7 : 13.5);
	const base = add(mul(unit(trunk), rHub + 14), mul(tangent(trunk), lateral));
	return {
		x: f2(base.x),
		y: f2(base.y),
		rotate: f2(rightHalf ? trunk - 90 : trunk + 90),
		anchor: rightHalf ? "start" : "end",
	};
}
