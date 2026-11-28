// 4rtofl の全体像のデータ。円の図・説明欄・流れは、すべてここから作る。
// サイトに出る文は英語で書く。説明は 1 文に収める。
// リポジトリを足すときは projects に 1 件足し、ほかと関わるなら flows にも足す。
// 円の図の上での並び順は、categories の順 → 各カテゴリの中の projects の順（時計回り）。
// 外のもの（Discord など）は、カテゴリの間の、つながる相手に近いところへ自動で置く。

import type { IconName } from "./icons.ts";

export type CategoryId = "agent" | "services" | "apps" | "ops";

export type Status = "active" | "early" | "design";

export interface Category {
	id: CategoryId;
	/** 図と一覧に出す 1 文字の記号 */
	code: string;
	/** 見出し（等幅の大文字で出す） */
	label: string;
}

export interface ProjectLink {
	label: string;
	href: string;
	/** リンクの横に小さく出す補足（リポジトリ名やドメイン） */
	note: string;
}

export interface Project {
	/** URL の # に使う */
	id: string;
	name: string;
	category: CategoryId;
	/** 種類（等幅の大文字で出す） */
	kind: string;
	/** 説明欄に出す 1 文 */
	summary: string;
	/** GitHub でリポジトリを作った日（YYYY-MM-DD）。欄と図の間の目盛りに出す */
	created: string;
	stack: string[];
	runsOn: string[];
	status: Status;
	/** 主に開発している人（members の id。コミットの多い順） */
	members: string[];
	/** 先頭のリンクを、図の点の行き先にする */
	links: ProjectLink[];
}

export interface Member {
	/** GitHub の ID */
	id: string;
	avatar: string;
}

/** 流れに出てくるもの。リポジトリのほか、Discord や GitHub などの外のものも含む */
export interface Actor {
	id: string;
	name: string;
	/** 種類（等幅の大文字で出す） */
	kind: string;
	/** リポジトリなら、その projects の id */
	project?: string;
	/** 図の中心（4rtofl の GitHub）で表すもの */
	hub?: true;
	/** 外のもの（図では輪の外の箱で描く）の 1 文の説明。説明欄に出す */
	about?: string;
	/** 流れの手順と一覧の印に出すアイコン（icons.ts）。書かなければ、リポジトリは repo、外のものは box */
	icon?: IconName;
	links?: ProjectLink[];
}

export interface Stop {
	actor: string;
	/** その場所で起きること（短く） */
	text: string;
	/** 前の場所からここへ来る線に添える、短い説明。始まりの場所へ戻る段は、これがあるときだけ線を引く */
	label?: string;
	/** 横から合流する流れ（in）か、横へ分かれる流れ（out） */
	branch?: { actor: string; text: string; dir: "in" | "out"; label?: string };
}

export interface Flow {
	id: string;
	name: string;
	/** 上から順に起きること */
	stops: Stop[];
}

const GITHUB = "https://github.com/4rtofl";

function repo(name: string): ProjectLink {
	return {
		label: "Repository",
		href: `${GITHUB}/${name}`,
		note: `4rtofl/${name}`,
	};
}

export const org = {
	name: "4rtofl",
	url: "https://4rtofl.org",
	github: GITHUB,
	source: `${GITHUB}/.org`,
	/** 欄と図の間の目盛りの始まり */
	started: "2026-10-01",
};

export const categories: Category[] = [
	{ id: "agent", code: "A", label: "Agent tools" },
	{ id: "services", code: "B", label: "Services" },
	{ id: "apps", code: "C", label: "Apps" },
	{ id: "ops", code: "D", label: "Operations" },
];

export const projects: Project[] = [
	// A. AI エージェントと開発
	{
		id: "dashboard",
		name: "Dashboard",
		category: "agent",
		kind: "Template",
		summary:
			"Shows who holds the ball across worktrees, pull requests and agent sessions.",
		created: "2026-10-06",
		stack: ["Python"],
		runsOn: ["localhost"],
		status: "active",
		members: ["totosuki"],
		links: [repo("Dashboard")],
	},
	{
		id: "uiux-auto-reviewer",
		name: "uiux-auto-reviewer",
		category: "agent",
		kind: "GitHub Action",
		summary:
			"Claude reviews the UI/UX of every pull request and posts a score.",
		created: "2026-11-20",
		stack: ["TypeScript"],
		runsOn: ["GitHub Actions"],
		status: "active",
		members: ["4rna-y"],
		links: [repo("uiux-auto-reviewer")],
	},
	{
		id: "chusai",
		name: "Chusai",
		category: "agent",
		kind: "GitHub Action",
		summary:
			"Merges main into open pull requests. Claude Code fixes conflicts and failing checks.",
		created: "2026-11-25",
		stack: ["TypeScript"],
		runsOn: ["GitHub Actions"],
		status: "active",
		members: ["totosuki"],
		links: [repo("Chusai")],
	},
	{
		id: "gasho-plugins",
		name: "GashoPlugins",
		category: "agent",
		kind: "Plugins",
		summary: "Plugins for Gasho: GitHub, kanban, usage meters and themes.",
		created: "2026-11-14",
		stack: ["TypeScript"],
		runsOn: ["Gasho"],
		status: "active",
		members: ["totosuki", "4rna-y"],
		links: [repo("GashoPlugins")],
	},
	{
		id: "gasho",
		name: "Gasho",
		category: "agent",
		kind: "Dashboard",
		summary: "Every Claude Code session and its Git status, on one screen.",
		created: "2026-11-11",
		stack: ["TypeScript", "React", "Node.js"],
		runsOn: ["Mac", "Ubuntu Server"],
		status: "active",
		members: ["totosuki", "4rna-y"],
		links: [
			repo("Gasho"),
			{
				label: "Website",
				href: "https://nakamaba.4rtofl.org/gasho/",
				note: "nakamaba.4rtofl.org/gasho",
			},
		],
	},
	{
		id: "dopagakix",
		name: "Dopagakix",
		category: "agent",
		kind: "Skill + CLI",
		summary: "Agents report their work as vertical videos with voice.",
		created: "2026-10-06",
		stack: ["TypeScript", "VOICEVOX", "ffmpeg"],
		runsOn: ["Claude Code"],
		status: "active",
		members: ["4rna-y", "totosuki"],
		links: [repo("Dopagakix")],
	},

	// B. メンバーで使うサービス
	{
		id: "nakamaba",
		name: "Nakamaba",
		category: "services",
		kind: "Static hosting",
		summary: "Static hosting for the team. Upload a zip and the page is live.",
		created: "2026-10-31",
		stack: ["TypeScript"],
		runsOn: ["AWS"],
		status: "active",
		members: ["totosuki"],
		links: [
			repo("Nakamaba"),
			{
				label: "Website",
				href: "https://nakamaba.4rtofl.org/",
				note: "nakamaba.4rtofl.org",
			},
		],
	},
	{
		id: "bobert",
		name: "Bobert",
		category: "services",
		kind: "Discord bot",
		summary: "Talk to AI on Discord. /agent hands repository work to an agent.",
		created: "2026-10-22",
		stack: ["TypeScript"],
		runsOn: ["Cloudflare Workers", "Discord"],
		status: "active",
		members: ["4rna-y"],
		links: [repo("Bobert")],
	},
	{
		id: "sigw",
		name: "sigw",
		category: "services",
		kind: "LLM gateway",
		summary: "One gateway for sharing LLM credits across members.",
		created: "2026-11-21",
		stack: ["TypeScript"],
		runsOn: ["Cloudflare Workers"],
		status: "active",
		members: ["4rna-y"],
		links: [
			repo("si-gateway"),
			{
				label: "Portal",
				href: "https://portal.sigw.4rtofl.org/",
				note: "portal.sigw.4rtofl.org",
			},
		],
	},
	{
		id: "daichoo",
		name: "Daichoo",
		category: "services",
		kind: "Discord bot",
		summary: "Commits treats and split bills to a ledger. Settles up monthly.",
		created: "2026-11-13",
		stack: ["TypeScript"],
		runsOn: ["Cloudflare Workers", "Discord", "GitHub"],
		status: "active",
		members: ["4rna-y"],
		links: [repo("Daichoo")],
	},

	// C. アプリと拡張機能
	{
		id: "hitokoto",
		name: "Hitokoto",
		category: "apps",
		kind: "Chrome extension",
		summary: "Select a word, get a one-line explanation from AI.",
		created: "2026-10-22",
		stack: ["JavaScript"],
		runsOn: ["Chrome"],
		status: "active",
		members: ["totosuki"],
		links: [
			repo("Hitokoto"),
			{
				label: "Chrome Web Store",
				href: "https://chromewebstore.google.com/detail/hitokoto/njpihdfpndlahcfbonfbdfcgobkdcdkg",
				// 名前でどこか分かり、ドメインは長くて途中で切れるので、補足は出さない
				note: "",
			},
		],
	},
	{
		id: "konv",
		name: "Konv",
		category: "apps",
		kind: "Chrome extension",
		summary: "Save web images with any name, in any format.",
		created: "2026-11-18",
		stack: ["TypeScript"],
		runsOn: ["Chrome"],
		status: "active",
		members: ["yu1sh"],
		links: [
			repo("Konv"),
			{
				label: "Chrome Web Store",
				href: "https://chromewebstore.google.com/detail/saveimageasanyfile/iindbmfojjjlagdblmkklmlemoodbjmc",
				// 名前でどこか分かり、ドメインは長くて途中で切れるので、補足は出さない
				note: "",
			},
		],
	},
	{
		id: "audipp",
		name: "Audipp",
		category: "apps",
		kind: "Android app",
		summary: "An audio player for Android phones and DAPs.",
		created: "2026-10-21",
		stack: ["Kotlin", "Jetpack Compose"],
		runsOn: ["Android"],
		status: "early",
		members: ["yu1sh"],
		links: [repo("Audipp")],
	},

	// D. 組織の運用
	{
		id: "permission",
		name: "permission",
		category: "ops",
		kind: "Policy",
		summary:
			"Access to GitHub, Discord, Cloudflare and AWS, changed by pull request.",
		created: "2026-11-07",
		stack: [],
		runsOn: ["GitHub"],
		status: "design",
		members: ["4rna-y"],
		links: [repo("permission")],
	},
	{
		id: "org",
		name: ".org",
		category: "ops",
		kind: "Website",
		summary: "This map.",
		created: "2026-11-22",
		stack: ["TypeScript", "Vite"],
		runsOn: ["Cloudflare"],
		status: "early",
		members: ["totosuki"],
		links: [
			repo(".org"),
			{ label: "Website", href: "https://4rtofl.org/", note: "4rtofl.org" },
		],
	},
];

export const members: Member[] = [
	{
		id: "4rna-y",
		avatar: "https://avatars.githubusercontent.com/u/142487969?v=4&s=96",
	},
	{
		id: "totosuki",
		avatar: "https://avatars.githubusercontent.com/u/116938397?v=4&s=96",
	},
	{
		id: "yu1sh",
		avatar: "https://avatars.githubusercontent.com/u/86245490?v=4&s=96",
	},
];

export const actors: Actor[] = [
	{
		id: "discord",
		name: "Discord",
		kind: "Server",
		icon: "discord",
		about: "Where the team talks. Most flows start and end here.",
	},
	{ id: "bobert", name: "Bobert", kind: "Discord bot", project: "bobert" },
	{
		id: "bobert-agent",
		name: "Bobert Agent",
		kind: "Managed Agents",
		icon: "agent",
		about: "Started from /agent. Works on any 4rtofl repository in a sandbox.",
		links: [repo("Bobert")],
	},
	{ id: "sigw", name: "sigw", kind: "LLM gateway", project: "sigw" },
	{ id: "daichoo", name: "Daichoo", kind: "Discord bot", project: "daichoo" },
	{
		id: "github",
		name: "GitHub",
		kind: "4rtofl",
		hub: true,
		icon: "github",
		links: [{ label: "GitHub", href: GITHUB, note: "github.com/4rtofl" }],
	},
	{
		id: "uiux-auto-reviewer",
		name: "uiux-auto-reviewer",
		kind: "GitHub Action",
		project: "uiux-auto-reviewer",
	},
	{ id: "chusai", name: "Chusai", kind: "GitHub Action", project: "chusai" },
	{
		id: "dopagakix",
		name: "Dopagakix",
		kind: "Skill + CLI",
		project: "dopagakix",
	},
	{
		id: "nakamaba",
		name: "Nakamaba",
		kind: "Static hosting",
		project: "nakamaba",
	},
	{
		id: "claude",
		name: "Claude",
		kind: "Anthropic",
		icon: "claude",
		about:
			"Claude Code on members' machines and in Chusai, and the models behind Bobert and the reviewer.",
	},
	{ id: "gasho", name: "Gasho", kind: "Dashboard", project: "gasho" },
	{
		id: "gasho-plugins",
		name: "GashoPlugins",
		kind: "Plugins",
		project: "gasho-plugins",
	},
];

export const flows: Flow[] = [
	{
		id: "talk",
		name: "Talk",
		stops: [
			{ actor: "discord", text: "Mention Bobert" },
			{ actor: "bobert", label: "mention", text: "Reads the thread" },
			{
				actor: "sigw",
				label: "LLM call",
				text: "Picks a member's key and logs the cost",
			},
			{ actor: "claude", label: "member keys", text: "Writes the reply" },
			{ actor: "discord", text: "The reply arrives" },
		],
	},
	{
		id: "agent",
		name: "Develop",
		stops: [
			{ actor: "discord", text: "/agent, then pick a repository" },
			{
				actor: "bobert",
				label: "/agent",
				text: "Starts a Managed Agents session",
			},
			{
				actor: "bobert-agent",
				label: "session",
				text: "Edits the code in a sandbox and pushes",
			},
			{
				actor: "github",
				label: "pull request",
				text: "Opens a pull request on any 4rtofl repository",
			},
			{
				actor: "bobert",
				label: "self-update",
				text: "If the repository was Bobert, it redeploys itself",
			},
		],
	},
	{
		id: "video",
		name: "Video",
		stops: [
			{ actor: "discord", text: "Ask Bobert to make a video" },
			{
				actor: "bobert",
				label: "make a video",
				text: "Writes a script and checks it",
			},
			{
				actor: "dopagakix",
				label: "script",
				text: "Renders it with voice and captions",
				branch: {
					actor: "claude",
					label: "video-report",
					text: "Claude Code reports its own work by video, too",
					dir: "in",
				},
			},
			{ actor: "discord", text: "The video arrives" },
		],
	},
	{
		id: "publish",
		name: "Publish",
		stops: [
			{ actor: "discord", text: "Ask in the agent's channel" },
			{
				actor: "bobert-agent",
				label: "ask",
				text: "Builds the page and uploads it",
			},
			{
				actor: "nakamaba",
				label: "upload",
				text: "Live at /<page>/",
				branch: {
					actor: "claude",
					label: "plugin",
					text: "Claude Code can publish, too",
					dir: "in",
				},
			},
			{ actor: "discord", label: "new page", text: "A new-page notice" },
		],
	},
	{
		id: "settle",
		name: "Settle",
		stops: [
			{ actor: "discord", text: "/ogori or /warikan" },
			{
				actor: "daichoo",
				label: "/ogori · /warikan",
				text: "Commits it to the ledger",
				branch: {
					actor: "sigw",
					label: "AI costs",
					text: "Adds last month's AI costs",
					dir: "in",
				},
			},
			{ actor: "discord", text: "Who owes whom, every month" },
		],
	},
	{
		id: "local",
		name: "Local",
		stops: [
			{ actor: "claude", text: "Claude Code works on Mac and Ubuntu Server" },
			{
				actor: "gasho",
				label: "live session",
				text: "Streams each session to one screen",
				branch: {
					actor: "gasho-plugins",
					label: "plugins",
					text: "Adds GitHub, kanban and themes",
					dir: "in",
				},
			},
			{
				actor: "github",
				label: "git status",
				text: "Shows Git and GitHub status alongside",
			},
		],
	},
	{
		id: "review",
		name: "Review",
		stops: [
			{
				actor: "github",
				text: "A pull request opens on Gasho or GashoPlugins",
			},
			{
				actor: "uiux-auto-reviewer",
				label: "every PR",
				text: "Reads the diff and the description",
			},
			{ actor: "claude", label: "score", text: "Posts a score and notes" },
		],
	},
	{
		id: "resolve",
		name: "Resolve",
		stops: [
			{
				actor: "github",
				text: "A pull request is merged on Gasho or GashoPlugins",
			},
			{
				actor: "chusai",
				label: "push to main",
				text: "Merges main into each open pull request",
			},
			{
				actor: "claude",
				label: "conflict",
				text: "Claude Code resolves conflicts and fixes failing checks",
				branch: {
					actor: "sigw",
					label: "API calls",
					text: "Calls go through sigw, which logs the cost",
					dir: "in",
				},
			},
			{ actor: "chusai", text: "Runs the checks again" },
			{
				actor: "github",
				label: "push",
				text: "Pushes to the pull request with a comment",
				branch: {
					actor: "uiux-auto-reviewer",
					label: "new commit",
					text: "Runs again on the new commit",
					dir: "out",
				},
			},
		],
	},
];

export const statusLabel: Record<Status, string> = {
	active: "Active",
	early: "Early",
	design: "Design",
};
