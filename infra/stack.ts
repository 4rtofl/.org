// サイトを置く S3 と、配る CloudFront と、main への push でデプロイするための GitHub Actions のロール。
// 書き方は Nakamaba（4rtofl/Nakamaba の infra/stack.ts）に合わせている。

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	Aws,
	aws_certificatemanager as acm,
	CfnOutput,
	aws_cloudfront as cloudfront,
	Duration,
	aws_iam as iam,
	aws_cloudfront_origins as origins,
	RemovalPolicy,
	Stack,
	type StackProps,
	aws_s3 as s3,
	aws_s3_deployment as s3deploy,
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import { scannerRequestCode, scannerResponseCode } from "./scanner.ts";

/** npm run build が書き出すフォルダ */
export const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

const GITHUB_OIDC_HOST = "token.actions.githubusercontent.com";

export interface SiteStackProps extends StackProps {
	/** main への push でデプロイする GitHub のリポジトリ。OIDC の sub の `repo:` に続く表記 */
	githubRepository: string;
	/** GitHub の OIDC の設定をこのスタックで作るか。アカウントに 1 つだけ作れるので、ほかのスタック（Nakamaba など）が作っていれば false にする */
	createGitHubOidc: boolean;
	/** 独自ドメインと、us-east-1 にあるその ACM 証明書の ARN。undefined なら cloudfront.net だけで配る */
	publicDomain?: { name: string; certificateArn: string } | undefined;
}

export class SiteStack extends Stack {
	constructor(scope: Construct, id: string, props: SiteStackProps) {
		super(scope, id, props);

		const bucket = new s3.Bucket(this, "SiteBucket", {
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			encryption: s3.BucketEncryption.S3_MANAGED,
			enforceSSL: true,
			removalPolicy: RemovalPolicy.RETAIN,
		});

		// .env などを探しに来るアクセスを、アスキーアートのページ（public/nice-try.html）に読み替え、404 で返す（scanner.ts）
		const scannerRequest = new cloudfront.Function(this, "ScannerRequest", {
			code: cloudfront.FunctionCode.fromInline(scannerRequestCode()),
			runtime: cloudfront.FunctionRuntime.JS_2_0,
		});
		const scannerResponse = new cloudfront.Function(this, "ScannerStatus", {
			code: cloudfront.FunctionCode.fromInline(scannerResponseCode()),
			runtime: cloudfront.FunctionRuntime.JS_2_0,
		});

		const { publicDomain } = props;
		const distribution = new cloudfront.Distribution(this, "Distribution", {
			comment: "4rtofl.org",
			...(publicDomain && {
				domainNames: [publicDomain.name],
				certificate: acm.Certificate.fromCertificateArn(
					this,
					"Certificate",
					publicDomain.certificateArn,
				),
			}),
			defaultRootObject: "index.html",
			httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
			defaultBehavior: {
				origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
				cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
				responseHeadersPolicy:
					cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
				compress: true,
				functionAssociations: [
					{
						function: scannerRequest,
						eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
					},
					{
						function: scannerResponse,
						eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
					},
				],
			},
			// OAC では、S3 に無いファイルへのアクセスが 403 で返る。ページは 1 枚なので、図を 404 で返す
			errorResponses: [
				{
					httpStatus: 403,
					responseHttpStatus: 404,
					responsePagePath: "/index.html",
					ttl: Duration.seconds(10),
				},
			],
		});

		// ビルドした dist/ を置く。名前に中身のハッシュが付く assets/ は 1 年残し、ほかは開くたびに新しいかを確かめさせる
		const assets = new s3deploy.BucketDeployment(this, "DeployAssets", {
			sources: [s3deploy.Source.asset(join(DIST, "assets"))],
			destinationBucket: bucket,
			destinationKeyPrefix: "assets/",
			cacheControl: [
				s3deploy.CacheControl.fromString("public, max-age=31536000, immutable"),
			],
			// 古い index.html を開いたままの人が読み込むので、前のファイルは消さない
			prune: false,
		});
		const pages = new s3deploy.BucketDeployment(this, "DeployPages", {
			sources: [
				s3deploy.Source.asset(DIST, { exclude: ["assets", "assets/**"] }),
			],
			destinationBucket: bucket,
			// assets/ は上で置くので、ここでは消さない
			exclude: ["assets/*"],
			cacheControl: [
				s3deploy.CacheControl.fromString("public, max-age=0, must-revalidate"),
			],
			distribution,
			distributionPaths: ["/*"],
		});
		pages.node.addDependency(assets);

		const githubOidcArn = props.createGitHubOidc
			? new iam.OidcProviderNative(this, "GitHubOidc", {
					url: `https://${GITHUB_OIDC_HOST}`,
					clientIds: ["sts.amazonaws.com"],
				}).oidcProviderArn
			: `arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:oidc-provider/${GITHUB_OIDC_HOST}`;
		const deployRole = new iam.Role(this, "GitHubDeployRole", {
			assumedBy: new iam.WebIdentityPrincipal(githubOidcArn, {
				StringEquals: {
					[`${GITHUB_OIDC_HOST}:aud`]: "sts.amazonaws.com",
					[`${GITHUB_OIDC_HOST}:sub`]: `repo:${props.githubRepository}:ref:refs/heads/main`,
				},
			}),
			maxSessionDuration: Duration.hours(1),
		});
		// デプロイは、cdk bootstrap が作ったロールを借りて行う（ファイルを置くのも CloudFormation が行う）
		deployRole.addToPolicy(
			new iam.PolicyStatement({
				actions: ["sts:AssumeRole"],
				resources: [
					`arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:role/cdk-hnb659fds-*-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
				],
			}),
		);

		new CfnOutput(this, "SiteUrl", {
			value: `https://${publicDomain?.name ?? distribution.distributionDomainName}`,
		});
		// Cloudflare で、独自ドメインの CNAME をこの名前に向ける
		new CfnOutput(this, "DistributionDomainName", {
			value: distribution.distributionDomainName,
		});
		new CfnOutput(this, "GitHubDeployRoleArn", { value: deployRole.roleArn });
	}
}
