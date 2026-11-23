// .env や wp-config.php のような、漏れると困るファイルがあるかを順に試しに来るアクセスに、
// 中指を立てたアスキーアート（middle-finger.txt）を返す CloudFront Function のコードを作る。
// アートは、中指を立てた男性の線画（フリー素材）を、マスごとに線の形が一番近い文字を選んで変換したもの。
// CloudFront Function は 1 つのスクリプトとして動くので、パスの一覧とアートを JSON にして埋め込む。

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 2026-11-23 の Cloudflare のログで、45.148.10.62（オランダ）から試されていたパス。
 * 照らし合わせる前に、パーセントエンコードを戻し、小文字にし、続いた / を 1 つにし、末尾の / を取るので、
 * /%2eenv や /%2f%2eenv も /.env として扱う。
 */
export const SCANNED_PATHS = [
	"/.aws/credentials",
	"/.env",
	"/.env.aws",
	"/.env.backup",
	"/.env.bak",
	"/.env.dev",
	"/.env.local",
	"/.env.old",
	"/.env.php",
	"/.env.php.bak",
	"/.env.prod",
	"/.env.save",
	"/.env.tmp",
	"/.env.txt",
	"/.git/config",
	"/.stripe",
	"/api/.env",
	"/aws-config.js",
	"/aws-ses.json",
	"/aws.config.js",
	"/backend/.env",
	"/config.js",
	"/config.json.save",
	"/config.php",
	"/config.php.bak",
	"/phpinfo.php",
	"/stripe/.env",
	"/test.php",
	// この 2 つは、今は Cloudflare が 403 で止めていて CloudFront まで届かない
	"/wp-config.php",
	"/wp-config.php.old",
];

const ART = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "middle-finger.txt"),
	"utf8",
);

/** 一覧のパスならアートを返し、それ以外はそのまま S3 に取りに行く viewer request の関数（cloudfront-js-2.0） */
export function scannerFunctionCode(): string {
	return `var PATHS = ${JSON.stringify(SCANNED_PATHS)};
var ART = ${JSON.stringify(ART)};

function handler(event) {
	var path = event.request.uri;
	try {
		path = decodeURIComponent(path);
	} catch (e) {}
	path = path.toLowerCase().replace(/\\/{2,}/g, "/").replace(/\\/+$/, "");
	if (PATHS.indexOf(path) === -1) {
		return event.request;
	}
	return {
		statusCode: 404,
		statusDescription: "Not Found",
		headers: {
			"content-type": { value: "text/plain; charset=utf-8" },
			"cache-control": { value: "no-store" },
			"x-content-type-options": { value: "nosniff" },
		},
		body: { encoding: "text", data: ART },
	};
}
`;
}
