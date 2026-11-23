// scanner.ts が作る 2 つの CloudFront Function のコードを Node で動かし、
// 試しに来るパスはアートのページに読み替えて 404 で返し、サイトのファイルはそのまま返すことを確かめる。

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
	ART_PATH,
	scannerRequestCode,
	scannerResponseCode,
} from "./scanner.ts";

type Handler<T> = (event: unknown) => T;
function load<T>(code: string): Handler<T> {
	const context = vm.createContext({});
	vm.runInContext(code, context);
	return context.handler as Handler<T>;
}
const onRequest = load<{ uri: string }>(scannerRequestCode());
const onResponse = load<{ statusCode: number }>(scannerResponseCode());

/** viewer request で読み替えたあとの uri と、viewer response で返す状態コードから、何を返すかを決める */
function answer(uri: string): "art" | "site" {
	const request = onRequest({
		request: { uri, method: "GET", headers: {} },
	});
	const response = onResponse({
		request,
		response: { statusCode: 200, statusDescription: "OK", headers: {} },
	});
	if (request.uri === ART_PATH && response.statusCode === 404) {
		return "art";
	}
	assert.equal(request.uri, uri, `${uri} の読み替え方が中途半端`);
	assert.equal(response.statusCode, 200, `${uri} の状態コードが中途半端`);
	return "site";
}

test("CloudFront Function の上限の 10 KB に収まる", () => {
	assert.ok(Buffer.byteLength(scannerRequestCode()) <= 10240);
	assert.ok(Buffer.byteLength(scannerResponseCode()) <= 10240);
});

test("アートのページが public/ にある", () => {
	const root = join(dirname(fileURLToPath(import.meta.url)), "..");
	assert.ok(existsSync(join(root, "public", ART_PATH)));
});

test("viewer response が、読み替える前の uri を受け取っても 404 にする", () => {
	const response = onResponse({
		request: { uri: "/.env", method: "GET", headers: {} },
		response: { statusCode: 200, statusDescription: "OK", headers: {} },
	});
	assert.equal(response.statusCode, 404);
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
