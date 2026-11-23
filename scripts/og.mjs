// リンクを貼ったときの画像（public/og.png、1200×630）と、ホーム画面用のアイコン
// （public/apple-touch-icon.png、180×180）を、ビルドしたサイトの見た目から作り直す。
// 使い方: npm run build && npm run og
// Chrome の場所は CHROME_PATH で変えられる（既定は macOS の Google Chrome）。

import { readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { preview } from "vite";

const chrome =
	process.env.CHROME_PATH ??
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const pub = new URL("../public/", import.meta.url).pathname;

const server = await preview({ preview: { port: 0, open: false } });
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("プレビューのサーバーを起動できませんでした");

const browser = await puppeteer.launch({
	executablePath: chrome,
	headless: true,
});
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
	await page.emulateMediaFeatures([
		{ name: "prefers-color-scheme", value: "light" },
		{ name: "prefers-reduced-motion", value: "reduce" },
	]);
	await page.goto(url, { waitUntil: "networkidle0" });
	await page.addStyleTag({
		content: `
			:root { --sheet-w: 430px !important; }
			.top, .ov-body, .sheet-project { display: none !important; }
			.hero { grid-template-columns: var(--sheet-w) 1fr !important; min-height: 630px !important; height: 630px; border: 0 !important; }
			.sheet { padding: 56px 48px !important; display: flex !important; flex-direction: column; justify-content: center; }
			.sheet-overview { display: block !important; flex: none !important; }
			.wordmark { font-size: 132px !important; }
			.map { position: static !important; height: 630px !important; padding: 16px 12px !important; }
			.map-svg { max-height: 600px !important; }
		`,
	});
	await page.evaluate(() => document.fonts.ready);
	await new Promise((r) => setTimeout(r, 300));
	await page.screenshot({ path: `${pub}og.png`, type: "png" });

	// ホーム画面用のアイコン: 角は丸めない（端末の側で丸める）
	const mark = readFileSync(`${pub}favicon.svg`, "utf8")
		.replace(/<style>[\s\S]*?<\/style>/, "")
		.replace(/<title>.*?<\/title>/, "")
		.replace(/<rect class="bg"[^>]*\/>/, "")
		.replace('<g class="ink">', '<g style="color:#121317">')
		.replace("<svg ", '<svg width="132" height="132" ');
	const icon = await browser.newPage();
	await icon.setViewport({ width: 180, height: 180, deviceScaleFactor: 1 });
	await icon.setContent(
		`<html><body style="margin:0;background:#f2f1ec;display:grid;place-items:center;height:180px">${mark}</body></html>`,
	);
	await icon.screenshot({ path: `${pub}apple-touch-icon.png`, type: "png" });
	console.log("public/og.png と public/apple-touch-icon.png を作り直しました");
} finally {
	await browser.close();
	await server.close();
}
