import { defineConfig, type Plugin } from "vite";
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

export default defineConfig({
	plugins: [prerender()],
	build: {
		target: "es2022",
	},
});
