// 4rtofl のロゴ（GitHub の組織のアイコンを測って描き直したもの）。
// 3 本の L 字は同じ点 (188, 190) を中心に曲がり、縦の 3 本は横線の下を、線の太さの半分の隙間をあけてくぐる。

export const MARK_VIEWBOX = { x: 69, y: 58, w: 322, h: 344 } as const;

export const MARK_BODY = [
	'<g fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round">',
	'<path d="M162 71V190A26 26 0 0 0 188 216H378"/>',
	'<path d="M122 111V190A66 66 0 0 0 188 256H378"/>',
	'<path d="M82 151V190A106 106 0 0 0 188 296H378"/>',
	"</g>",
	'<g fill="currentColor">',
	'<path d="M240 190V151A13 13 0 0 1 266 151V190Z"/>',
	'<path d="M280 190V111A13 13 0 0 1 306 111V190Z"/>',
	'<path d="M320 190V71A13 13 0 0 1 346 71V190Z"/>',
	'<path d="M240 322V389A13 13 0 0 0 266 389V322Z"/>',
	'<path d="M280 322V389A13 13 0 0 0 306 389V322Z"/>',
	'<path d="M320 322V389A13 13 0 0 0 346 389V322Z"/>',
	"</g>",
].join("");

/** HTML の中に置く SVG のロゴ */
export function markSvg(className: string, label?: string): string {
	const { x, y, w, h } = MARK_VIEWBOX;
	const a11y = label
		? `role="img" aria-label="${label}"`
		: 'aria-hidden="true"';
	return `<svg class="${className}" viewBox="${x} ${y} ${w} ${h}" ${a11y}>${MARK_BODY}</svg>`;
}

/** SVG の図の中に、中心 (0, 0)・高さ height で置くロゴ */
export function markGroup(height: number): string {
	const { x, y, w, h } = MARK_VIEWBOX;
	const s = height / h;
	const tx = -(w * s) / 2 - x * s;
	const ty = -(h * s) / 2 - y * s;
	return `<g class="hub-mark" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">${MARK_BODY}</g>`;
}
