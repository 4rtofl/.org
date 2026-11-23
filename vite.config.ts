import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { type ProfileTheme, renderProfileMap } from "./src/profile.ts";
import { renderApp } from "./src/render.ts";

// index.html の <!--app--> を、data.ts から作った HTML に置き換える。
// 図と一覧を HTML に書き出しておくので、JavaScript が動く前から表示され、検索エンジンにも読まれる。
function prerender(): Plugin {
	return {
		name: "prerender-app",
		transformIndexHtml: {
			order: "pre",
			handler: (html) => html.replace("<!--app-->", renderApp()),
		},
	};
}

// リンクを貼ったときの画像（og:image）の URL に、画像の中身から作った版（?v=...）を付ける。
// Discord などは、一度読んだ URL の画像を覚えていて使い続けるので、画像を作り直したら URL も変えて、新しい画像を読ませる。
function ogImageVersion(): Plugin {
	return {
		name: "og-image-version",
		transformIndexHtml: {
			order: "pre",
			handler: (html, ctx) => {
				// サイトのページ（index.html）だけに付ける。lab/ の試しのページには og:image が無い
				if (ctx.path !== "/index.html") return html;
				const png = readFileSync(new URL("./public/og.png", import.meta.url));
				const v = createHash("sha256").update(png).digest("hex").slice(0, 8);
				const tag = /(<meta property="og:image" content="[^"?]+\/og\.png)"/;
				if (!tag.test(html))
					throw new Error("index.html に og.png の og:image が見つかりません");
				return html.replace(tag, `$1?v=${v}"`);
			},
		},
	};
}

// GitHub の 4rtofl のトップ（4rtofl/.github の profile/README.md）に載せる図の画像を、
// github/map-light.svg と github/map-dark.svg に書き出す。開発用のサーバーでも、同じ場所で開ける。
function githubProfile(): Plugin {
	const themes: ProfileTheme[] = ["light", "dark"];
	return {
		name: "github-profile-map",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const theme = themes.find((t) => req.url === `/github/map-${t}.svg`);
				if (!theme) return next();
				res.setHeader("Content-Type", "image/svg+xml");
				res.end(renderProfileMap(theme));
			});
		},
		generateBundle() {
			for (const theme of themes) {
				this.emitFile({
					type: "asset",
					fileName: `github/map-${theme}.svg`,
					source: renderProfileMap(theme),
				});
			}
		},
	};
}

export default defineConfig({
	plugins: [prerender(), ogImageVersion(), githubProfile()],
	build: {
		target: "es2022",
	},
});
