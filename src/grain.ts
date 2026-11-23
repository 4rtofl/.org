// 画面全体に重ねる、細かい粒（フィルムの粒のようなノイズ）。
// 1 粒ずつ明るさがばらばらの絵を敷き詰め、overlay で重ねるので、地や文字の明るさは変えずに、ざらつきだけを足す。
// 1 秒に 24 回、絵をずらして粒を入れ替える（フィルムの映像のように、粒がちらつく）。
// 粒の入れ替えは、動きを減らす設定でも続ける（粒は薄く、図や文字は動かないので、サイトの見た目として残す）。
// 見た目は lab/noise.html で比べて決めた（案 B）。

/** 粒の絵の 1 辺（端末のピクセル）。1 粒を、端末の 1 ピクセルで描く */
const TILE = 256;
/** 1 秒に粒を入れ替える回数 */
const FPS = 24;

/** 1 粒ずつ明るさがばらばらの絵（PNG の data URL） */
function grainImage(): string {
	const c = document.createElement("canvas");
	c.width = TILE;
	c.height = TILE;
	const ctx = c.getContext("2d");
	if (!ctx) return "";
	const img = ctx.createImageData(TILE, TILE);
	for (let i = 0; i < img.data.length; i += 4) {
		// 2 つの乱数の平均にして、真ん中の明るさの粒を多くする（ぎらつきを抑える）
		const v = ((Math.random() + Math.random()) / 2) * 255;
		img.data[i] = v;
		img.data[i + 1] = v;
		img.data[i + 2] = v;
		img.data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return c.toDataURL("image/png");
}

export function setupGrain(): void {
	const url = grainImage();
	if (!url) return;
	const el = document.createElement("div");
	el.className = "grain";
	el.setAttribute("aria-hidden", "true");
	el.style.backgroundImage = `url("${url}")`;
	document.body.append(el);

	/** 端末の 1 ピクセル（CSS のピクセル）。画面を別の画面へ移すと変わる */
	let px = 1 / window.devicePixelRatio;
	const fit = () => {
		px = 1 / window.devicePixelRatio;
		el.style.setProperty("--grain-tile", `${(TILE * px).toFixed(3)}px`);
	};
	fit();
	window.addEventListener("resize", fit);

	// 絵を、端末のピクセルの倍数だけずらして、粒をにじませずに入れ替える。
	// 層は画面より絵 1 枚ぶん大きくしてあり（style.css）、ずらしても画面の端に隙間はできない
	let last = 0;
	const tick = (now: number) => {
		requestAnimationFrame(tick);
		if (now - last < 1000 / FPS) return;
		last = now;
		const x = Math.floor(Math.random() * TILE) * px;
		const y = Math.floor(Math.random() * TILE) * px;
		el.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0)`;
	};
	requestAnimationFrame(tick);
}
