import { existsSync } from "node:fs";
import { join } from "node:path";
import { App } from "aws-cdk-lib";
import { DIST, SiteStack } from "./stack.ts";

// dist/ の中身をそのまま S3 に置くので、先にビルドしておく
if (!existsSync(join(DIST, "index.html"))) {
	throw new Error("dist/ がありません。先に npm run build を実行する");
}

const app = new App();

// 独自ドメインの値はリポジトリに書かず、デプロイのときに -c で渡す。空文字は未指定として扱う
const publicDomainName = String(app.node.tryGetContext("publicDomain") ?? "");
const publicCertificateArn = String(
	app.node.tryGetContext("publicCertificateArn") ?? "",
);
if (Boolean(publicDomainName) !== Boolean(publicCertificateArn)) {
	throw new Error("publicDomain と publicCertificateArn は両方とも指定する");
}

// GitHub の OIDC の設定がまだ無いアカウントでは、-c createGitHubOidc=true を付けてデプロイする
const createGitHubOidc =
	String(app.node.tryGetContext("createGitHubOidc") ?? "false") === "true";

new SiteStack(app, "OrgSite", {
	env: { region: "ap-northeast-1", account: process.env.CDK_DEFAULT_ACCOUNT },
	// リポジトリで immutable subject が有効なので、OIDC の sub は owner と name に ID が付く
	githubRepository: "4rtofl@338377614/.org@1467712984",
	createGitHubOidc,
	publicDomain: publicDomainName
		? { name: publicDomainName, certificateArn: publicCertificateArn }
		: undefined,
});
