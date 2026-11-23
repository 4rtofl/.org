// scanner.ts が作る CloudFront Function のコードを Node で動かし、
// 試しに来るパスにはアートを返し、サイトのファイルはそのまま S3 に取りに行くことを確かめる。

import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { scannerFunctionCode } from "./scanner.ts";

const code = scannerFunctionCode();
const context = vm.createContext({});
vm.runInContext(code, context);
const handler = context.handler as (event: unknown) => { statusCode?: number };
const answer = (uri: string) =>
	handler({ request: { uri, method: "GET", headers: {} } }).statusCode === 404
		? "art"
		: "site";

test("CloudFront Function の上限の 10 KB に収まる", () => {
	assert.ok(Buffer.byteLength(code) <= 10240);
});

test("2026-11-23 の Cloudflare のログで試されていたパスにアートを返す", () => {
	for (const uri of [
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
		"/.stripe/",
		"/%2eenv",
		"/%2f%2eenv",
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
		"/wp-config.php",
		"/wp-config.php.old",
	]) {
		assert.equal(answer(uri), "art", uri);
	}
});

test("ほかによく試されるパスにもアートを返す", () => {
	for (const uri of [
		"/.ENV",
		"/.git/HEAD",
		"/.DS_Store",
		"/.vscode/sftp.json",
		"/.ssh/id_rsa",
		"/..%2f..%2fetc/passwd",
		"/..%5c..%5cwindows/win.ini",
		"/wp-login.php",
		"/wp-admin/",
		"/blog/wp-includes/wlwmanifest.xml",
		"/xmlrpc.php",
		"/index.php",
		"/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
		"/phpmyadmin/",
		"/cgi-bin/luci",
		"/actuator/env",
		"/owa/auth/logon.aspx",
		"/remote/login",
		"/boaform/admin/formLogin",
		"/backup.zip",
		"/db.sql",
		"/storage/logs/laravel.log",
		"/docker-compose.yml",
		"/server.key",
		"/index.html~",
		"/robots.txt",
		"/sitemap.xml",
	]) {
		assert.equal(answer(uri), "art", uri);
	}
});

test("サイトが配るファイルと、ふつうのパスはそのまま S3 に取りに行く", () => {
	for (const uri of [
		"/",
		"/index.html",
		"/favicon.svg",
		"/apple-touch-icon.png",
		"/og.png",
		"/github/map-light.svg",
		"/github/map-dark.svg",
		"/assets/index-BHUtZ0C7.js",
		"/assets/index-Cb8G-b39.css",
		"/assets/geist-latin-wght-normal-BgDaEnEv.woff2",
		"/.well-known/acme-challenge/token",
		"/.well-known/security.txt",
		"/members",
		"/%E0%A4%A",
	]) {
		assert.equal(answer(uri), "site", uri);
	}
});
