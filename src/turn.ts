// 図を回す。
// - 円をつかんで（マウス・指・ペン）回すと、離したあとも少し回り続け、名前が重ならず図に収まる向きで止まる。
//   ページが縦に動く幅（スマートフォンなど）では、指を横へ動かしたときだけ回す。縦に動かせば、ふだんどおりページが動く。
// - 広い画面では、図の上でスクロール（ホイール・トラックパッド）しても回る。
// - 点・線・目盛り・流れ（class に rot を付けたもの）は、CSS の --rot でまとめて回す。
//   名前・外のものの箱・カテゴリ名・中心の文字は回さずに立てておき、向きに合わせてここで置き直す（置き方は place.ts）。

import {
	type Box,
	captionPath,
	catPlace,
	deg,
	inside,
	norm,
	overlap,
	placeName,
	polar,
	satBadgeAt,
	satBox,
	satInner,
	signed,
	turn,
} from "./place.ts";

type Mode = "full" | "compact";
const MODES: Mode[] = ["full", "compact"];

/** リポジトリの名前 */
interface Name {
	text: SVGTextElement;
	hit: SVGRectElement;
	angle: number;
	w: number;
	r: number;
	size: number;
}

/** 外のものの箱と、そこから目盛りの輪へ入る線と、箱に付く流れの番号 */
interface Sat {
	g: SVGGElement;
	port: SVGLineElement | null;
	badges: SVGGElement[];
	angle: number;
	w: number;
	h: number;
	gap: number;
	avoid: number;
	/** 箱の内側の端の、中心からの距離（名前を避けて外へ出すときは、少しずつ動かす） */
	inner: number;
}

export interface TurnOptions {
	/** スマートフォンの小さい図の幅か */
	compact: MediaQueryList;
	/** ページを動かさずに 1 画面に収める幅か（このときだけ、ホイールで回す） */
	wide: MediaQueryList;
	reduceMotion: MediaQueryList;
}

export function setupTurn(svg: SVGSVGElement, opts: TurnOptions): void {
	const rDial = Number(svg.dataset.rDial);
	const rHub = Number(svg.dataset.rHub);
	// 小さい図は、名前が画面の幅に収まる向きに回してから見せる
	const base: Record<Mode, number> = {
		full: 0,
		compact: Number(svg.dataset.compactTurn ?? 0),
	};
	const viewBoxOf = (m: Mode): Box => {
		const vb =
			m === "full" ? svg.dataset.viewboxFull : svg.dataset.viewboxCompact;
		const [x = 0, y = 0, w = 0, h = 0] = (vb ?? "").split(" ").map(Number);
		return { x, y, w, h };
	};

	const names: Record<Mode, Name[]> = { full: [], compact: [] };
	const sats: Record<Mode, Sat[]> = { full: [], compact: [] };
	for (const node of svg.querySelectorAll<SVGAElement>(".node")) {
		const angle = Number(node.dataset.angle);
		const id = node.dataset.id ?? "";
		for (const m of MODES) {
			if (node.dataset.type === "repo") {
				const g = node.querySelector<SVGGElement>(`.name-${m}`);
				const text = g?.querySelector("text");
				const hit = g?.querySelector("rect");
				if (!g || !text || !hit) continue;
				names[m].push({
					text,
					hit,
					angle,
					w: Number(g.dataset.w),
					r: Number(g.dataset.r),
					size: Number(g.dataset.size),
				});
				continue;
			}
			const g = node.querySelector<SVGGElement>(`.sat-${m}`);
			if (!g) continue;
			sats[m].push({
				g,
				port: svg.querySelector<SVGLineElement>(
					`.port-${m}[data-node="${id}"]`,
				),
				badges: [
					...svg.querySelectorAll<SVGGElement>(`.badge-${m}[data-sat="${id}"]`),
				],
				angle,
				w: Number(g.dataset.w),
				h: Number(g.dataset.h),
				gap: Number(g.dataset.gap),
				avoid: Number(g.dataset.avoid),
				inner: Number(g.dataset.inner),
			});
		}
	}
	const cats = [...svg.querySelectorAll<SVGTextElement>(".cat-label")].map(
		(el) => ({
			el,
			trunk: Number(el.dataset.trunk),
			side: Number(el.dataset.side),
		}),
	);
	const caption = svg.querySelector<SVGPathElement>(".hub-caption-path");
	const cap = caption
		? {
				angle: Number(caption.dataset.angle),
				span: Number(caption.dataset.span),
				r: Number(caption.dataset.r),
			}
		: null;

	let mode: Mode = opts.compact.matches ? "compact" : "full";
	/** 今の向き（度、時計回り）。何周しても続けて数える */
	let rot = base[mode];

	const n2 = (n: number) => n.toFixed(2);

	/** 今の向きに合わせて、名前・箱・カテゴリ名・中心の文字を置き直す。smooth なら箱は少しずつ動かし、まだ動いている箱があれば true を返す */
	function place(smooth: boolean): boolean {
		svg.style.setProperty("--rot", `${rot.toFixed(3)}deg`);
		const boxes: Box[] = [];
		for (const n of names[mode]) {
			const p = placeName(n.angle + rot, n.w, n.r, n.size);
			n.text.setAttribute("x", p.x.toFixed(1));
			n.text.setAttribute("y", p.y.toFixed(1));
			n.text.setAttribute("text-anchor", p.anchor);
			n.hit.setAttribute("x", (p.box.x - 6).toFixed(1));
			n.hit.setAttribute("y", (p.box.y - 4).toFixed(1));
			boxes.push(p.box);
		}
		let moving = false;
		for (const s of sats[mode]) {
			const a = s.angle + rot;
			const goal = satInner(a, s.w, s.h, rDial + s.gap, boxes, s.avoid);
			if (smooth && Math.abs(goal - s.inner) > 0.1) {
				s.inner += (goal - s.inner) * 0.25;
				moving = true;
			} else {
				s.inner = goal;
			}
			const b = satBox(a, s.w, s.h, s.inner);
			s.g.setAttribute(
				"transform",
				`translate(${n2(b.x + b.w / 2)} ${n2(b.y + b.h / 2)})`,
			);
			if (s.port) {
				// 線は回す図の中にあるので、回す前の向きで書く
				const from = polar(s.inner, s.angle);
				s.port.setAttribute("x1", n2(from.x));
				s.port.setAttribute("y1", n2(from.y));
			}
			for (const bg of s.badges) {
				const at = turn(
					satBadgeAt(b, a, Number(bg.dataset.bw), mode === "compact"),
					-rot,
				);
				bg.setAttribute("transform", `translate(${n2(at.x)} ${n2(at.y)})`);
			}
		}
		// カテゴリ名と中心の文字は、小さい図では出さない
		if (mode === "full") {
			for (const c of cats) {
				const p = catPlace(c.trunk + rot, c.side, rHub);
				c.el.setAttribute(
					"transform",
					`translate(${p.x} ${p.y}) rotate(${p.rotate})`,
				);
				c.el.setAttribute("text-anchor", p.anchor);
			}
			if (caption && cap) {
				caption.setAttribute(
					"d",
					captionPath(cap.angle + rot, cap.span, cap.r),
				);
			}
		}
		return moving;
	}

	// ---------- 止まる向き ----------

	/** 図を r だけ回したとき、名前が重ならず、名前と箱が表示範囲に収まるか */
	function fits(m: Mode, r: number): boolean {
		const vb = viewBoxOf(m);
		const boxes = names[m].map(
			(n) => placeName(n.angle + r, n.w, n.r, n.size).box,
		);
		for (let i = 0; i < boxes.length; i++) {
			const a = boxes[i] as Box;
			if (!inside(a, vb, 2)) return false;
			for (let j = i + 1; j < boxes.length; j++) {
				if (overlap(a, boxes[j] as Box, 3) > 0) return false;
			}
		}
		return sats[m].every((s) => {
			const a = s.angle + r;
			const inner = satInner(a, s.w, s.h, rDial + s.gap, boxes, s.avoid);
			return inside(satBox(a, s.w, s.h, inner), vb, 2);
		});
	}

	// 0.5 度ごとに、止まってよい向きかを、初めて要るときに数えておく
	const fitTables: Partial<Record<Mode, Uint8Array>> = {};
	function fitTable(m: Mode): Uint8Array {
		let t = fitTables[m];
		if (!t) {
			t = new Uint8Array(720);
			for (let i = 0; i < 720; i++) t[i] = fits(m, i / 2) ? 1 : 0;
			fitTables[m] = t;
		}
		return t;
	}

	/** t にいちばん近い、止まってよい向き */
	function nearestFit(t: number): number {
		const ok = fitTable(mode);
		const i0 = Math.round(norm(t) * 2) % 720;
		if (ok[i0]) return t;
		for (let k = 1; k <= 360; k++) {
			for (const i of [i0 + k, i0 - k]) {
				const j = ((i % 720) + 720) % 720;
				if (ok[j]) return t + signed(norm(t), j / 2);
			}
		}
		// どこにも収まらないときは、最初の向きに戻す
		const b = base[mode];
		return b + 360 * Math.round((t - b) / 360);
	}

	// ---------- 動かす ----------

	let frame = 0;
	let last = 0;
	/** 手を離したあとに向かう向きと、近づく速さ（時定数、ミリ秒） */
	let target: number | null = null;
	let tau = 260;

	interface Drag {
		id: number;
		x0: number;
		y0: number;
		/** 前に読んだ、指の向き */
		a: number;
		moved: boolean;
		/** 勢いを測るための、時刻と向き */
		samples: [number, number][];
	}
	let drag: Drag | null = null;
	let swallowClick = false;

	function tick(now: number) {
		const dt = Math.min(48, Math.max(1, now - last));
		last = now;
		if (target !== null && !drag) {
			rot += (target - rot) * (1 - Math.exp(-dt / tau));
			if (Math.abs(target - rot) < 0.01) {
				rot = target;
				target = null;
			}
		}
		const moving = place(true);
		frame = drag || target !== null || moving ? requestAnimationFrame(tick) : 0;
	}

	function kick() {
		if (frame) return;
		last = performance.now();
		frame = requestAnimationFrame(tick);
	}

	/** 手を離したあと: 勢い v（度/ミリ秒）のまま少し回り、だんだん遅くなって、収まる向きで止まる */
	function settle(v: number) {
		if (opts.reduceMotion.matches) {
			rot = nearestFit(rot);
			target = null;
			place(false);
			return;
		}
		target = nearestFit(rot + v * 325);
		const d = target - rot;
		// 離したときの勢いのまま動き出し、止まる向きにちょうど着くよう、近づく速さを決める
		tau =
			Math.abs(v) > 0.02 && Math.sign(d) === Math.sign(v)
				? Math.min(900, Math.max(140, d / v))
				: 260;
		kick();
	}

	const toMap = (e: PointerEvent) => {
		const m = svg.getScreenCTM();
		return m
			? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
			: null;
	};
	const angleOf = (p: DOMPoint) => deg(Math.atan2(p.x, -p.y));

	svg.addEventListener("pointerdown", (e) => {
		swallowClick = false;
		if (e.pointerType === "mouse" && e.button !== 0) return;
		const p = toMap(e);
		// 中心は、押して GitHub を開く所なので、ここからは回さない
		if (!p || Math.hypot(p.x, p.y) < rHub + 4) return;
		drag = {
			id: e.pointerId,
			x0: e.clientX,
			y0: e.clientY,
			a: angleOf(p),
			moved: false,
			samples: [[e.timeStamp, rot]],
		};
	});

	svg.addEventListener("pointermove", (e) => {
		const d = drag;
		if (!d || e.pointerId !== d.id) return;
		if (!d.moved) {
			// 少し動かすまでは、押しただけとみなす（点を押して選べるように）
			if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
			d.moved = true;
			target = null;
			try {
				svg.setPointerCapture(e.pointerId);
			} catch {
				// 押している指がもう離れていれば、つかまえずに続ける
			}
			svg.classList.add("is-turning");
		}
		const p = toMap(e);
		// 中心のすぐ近くでは向きが定まらないので、回さない
		if (!p || Math.hypot(p.x, p.y) < 24) return;
		const a = angleOf(p);
		rot += signed(d.a, a);
		d.a = a;
		d.samples.push([e.timeStamp, rot]);
		while (d.samples.length > 2 && e.timeStamp - (d.samples[0]?.[0] ?? 0) > 120)
			d.samples.shift();
		kick();
	});

	const end = (e: PointerEvent) => {
		const d = drag;
		if (!d || e.pointerId !== d.id) return;
		drag = null;
		svg.classList.remove("is-turning");
		if (!d.moved) return;
		// 回したあとに来る click で、点を選んだり、選んだものを外したりしない
		swallowClick = e.type === "pointerup";
		// 離す直前の 0.1 秒の動きから、勢いを測る（止めてから離したときは 0）
		const recent = d.samples.filter(([t]) => e.timeStamp - t < 100);
		const first = recent[0];
		const lastSample = recent[recent.length - 1];
		let v = 0;
		if (
			first &&
			lastSample &&
			lastSample[0] - first[0] > 8 &&
			e.timeStamp - lastSample[0] < 60
		) {
			v = (lastSample[1] - first[1]) / (lastSample[0] - first[0]);
		}
		settle(Math.max(-2.5, Math.min(2.5, v)));
	};
	svg.addEventListener("pointerup", end);
	svg.addEventListener("pointercancel", end);

	// 図の中の click より先に受け取れるよう、document で受ける
	document.addEventListener(
		"click",
		(e) => {
			if (!swallowClick) return;
			swallowClick = false;
			e.preventDefault();
			e.stopImmediatePropagation();
		},
		true,
	);
	// リンク（点）をつかんで回したときに、リンクを引きずる動きにしない
	svg.addEventListener("dragstart", (e) => e.preventDefault());

	// 広い画面: 図の上のスクロールで回す。指を止めて少したったら、収まる向きで止める
	let wheelTimer = 0;
	svg.addEventListener(
		"wheel",
		(e) => {
			if (!opts.wide.matches || e.ctrlKey) return;
			e.preventDefault();
			const px = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
			const d =
				(Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * px;
			target = null;
			rot += Math.max(-20, Math.min(20, d * 0.12));
			kick();
			window.clearTimeout(wheelTimer);
			wheelTimer = window.setTimeout(() => settle(0), 160);
		},
		{ passive: false },
	);

	// 小さい図と広い図を行き来したら、その図の最初の向きに戻す
	opts.compact.addEventListener("change", () => {
		mode = opts.compact.matches ? "compact" : "full";
		rot = base[mode];
		target = null;
		drag = null;
		svg.classList.remove("is-turning");
		place(false);
	});

	place(false);
}
