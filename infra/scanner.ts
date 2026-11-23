// .env や wp-config.php のような、漏れると困るファイルや管理画面があるかを順に試しに来るアクセスに、
// 中指を立てたアスキーアート（middle-finger.txt）を返す CloudFront Function のコードを作る。
// アートは、中指を立てた男性の線画（フリー素材）を、マスごとに線の形が一番近い文字を選んで変換したもの。
// CloudFront Function は 1 つのスクリプトとして動くので、下の一覧とアートを JSON にして埋め込む。
//
// 試されるパスは数千あるので、1 つずつ並べずに種類で当てる。サイトが配るのは index.html・assets/・github/ と
// ルートの画像だけなので、ここに当たる名前のファイルをサイトに足すと、そのファイルは表示されなくなる。

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 1 つめのフォルダの名前。管理画面・CMS・VPN やルーターの画面・フレームワークのデバッグ画面・サーバーの中のフォルダ */
const DIRS = [
	// 管理画面とデータベースの画面
	"admin",
	"administrator",
	"adminer",
	"phpmyadmin",
	"pma",
	"myadmin",
	"mysql",
	"dbadmin",
	"cpanel",
	"webmail",
	"roundcube",
	// CMS
	"wordpress",
	"wp",
	"joomla",
	"drupal",
	"magento",
	"typo3",
	// プログラムとライブラリの置き場所
	"cgi-bin",
	"vendor",
	"node_modules",
	"phpunit",
	"web-inf",
	"meta-inf",
	// メールと VPN とルーターの画面（Exchange・Fortinet・Palo Alto・Cisco・Pulse Secure・Citrix など）
	"owa",
	"ecp",
	"autodiscover",
	"remote",
	"global-protect",
	"+cscoe+",
	"dana-na",
	"vpn",
	"boaform",
	"gponform",
	"hnap1",
	// Java のサーバーと開発用の画面（Tomcat・Spring Boot・Laravel・Symfony など）
	"manager",
	"jmx-console",
	"solr",
	"jenkins",
	"actuator",
	"druid",
	"nacos",
	"telescope",
	"_ignition",
	"_profiler",
	"debug",
	"console",
	"swagger-ui",
	"graphql",
	"server-status",
	// 設定・バックアップ・サーバーの中のフォルダ
	"config",
	"backup",
	"backups",
	"bak",
	"old",
	"shell",
	"etc",
	"proc",
];

/** ファイル名（どのフォルダの中でも）。秘密の鍵・設定・依存の一覧と、検索エンジンが読みに来るファイル */
const FILES = [
	"credentials",
	"credentials.json",
	"secrets.json",
	"id_rsa",
	"id_dsa",
	"id_ecdsa",
	"id_ed25519",
	"authorized_keys",
	"passwd",
	"shadow",
	"web.config",
	"dockerfile",
	"package.json",
	"composer.json",
	"appsettings.json",
	"firebase.json",
	"serviceaccountkey.json",
	"google-services.json",
	"sftp-config.json",
	"swagger.json",
	"openapi.json",
	"phpinfo",
	"config.js",
	"config.json",
	"aws-config.js",
	"aws.config.js",
	"aws-ses.json",
	"robots.txt",
	"sitemap.xml",
	"sitemap_index.xml",
];

/** サイトでは動かないサーバーのプログラムの拡張子。config.php.bak や index.php~ のように後ろに続いても当てる */
const SCRIPTS =
	/\.(php\d*|phtml|phar|inc|asp|aspx|ashx|asmx|axd|jsp|jspx|do|action|cgi|pl|py|sh|cfm)(\.|~|$)/;

/** バックアップ・データベース・圧縮・ログ・設定・鍵の拡張子 */
const BACKUPS =
	/(\.(bak|backup|old|orig|save|swp|tmp|dist|sql|sqlite3?|db|mdb|dump|tar|tgz|gz|zip|rar|7z|war|log|ini|conf|cfg|pem|key|p12|pfx|jks|ovpn|yml|yaml|toml|env|config|properties|lock)|~)$/;

const ART = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "middle-finger.txt"),
	"utf8",
);

/** 試しに来るパスならアートを返し、それ以外はそのまま S3 に取りに行く viewer request の関数（cloudfront-js-2.0） */
export function scannerFunctionCode(): string {
	return `var DIRS = ${JSON.stringify(DIRS)};
var FILES = ${JSON.stringify(FILES)};
var SCRIPTS = ${SCRIPTS};
var BACKUPS = ${BACKUPS};
var ART = ${JSON.stringify(ART)};

// パーセントエンコードを戻し、小文字にし、\\ を / にし、続いた / を 1 つにしてから、フォルダとファイルの名前に分ける。
// /%2eenv も /.ENV も //.env も、/.env と同じに扱う
function names(uri) {
	var path = uri;
	try {
		path = decodeURIComponent(path);
	} catch (e) {}
	return path.toLowerCase().replace(/\\\\/g, "/").split("/").filter(function (s) {
		return s !== "";
	});
}

function isScan(uri) {
	var n = names(uri);
	if (n.length === 0) {
		return false;
	}
	for (var i = 0; i < n.length; i++) {
		// .env・.git・.aws のような名前と、../ でフォルダを上がるもの。.well-known は証明書の発行などに使うので除く
		if (n[i].charAt(0) === "." && n[i] !== ".well-known") {
			return true;
		}
		// wp-admin・wp-login.php・wp-content など WordPress のもの
		if (n[i].indexOf("wp-") === 0) {
			return true;
		}
	}
	var last = n[n.length - 1];
	return (
		DIRS.indexOf(n[0]) !== -1 ||
		FILES.indexOf(last) !== -1 ||
		SCRIPTS.test(last) ||
		BACKUPS.test(last)
	);
}

function handler(event) {
	if (!isScan(event.request.uri)) {
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
