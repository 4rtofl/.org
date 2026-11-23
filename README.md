# 4rtofl.org

4rtofl のリポジトリと、そのつながりを 1 画面にまとめたサイトです。

- 時計の形の図の中心が GitHub の 4rtofl で、カテゴリごとにリポジトリへ線が伸びます。
- Discord・Bobert Agent・Claude などの外のものは、時計の輪の外の、カテゴリの間に箱で置きます。
- つながりの線は、点や流れを選んだときだけ、点の輪と目盛りの輪の間に円弧で描きます。流れを選ぶと点が段ごとに道を進み、点がいる段の線にだけ短い説明が出ます。
- 中心のアイコンを押すと GitHub の 4rtofl を開きます。のせると、全部のリポジトリへの線に中心から光が流れます。
- 左の欄の流れ（Talk・Develop など）にのせると、図にその流れの線と順番の番号が出ます。押すと、手順が出ます。
- 点や箱を押すと、説明とリンクが出ます。
- 左の欄と図の間の目盛りは、上が組織の始まり（2026-10-01）、下が今日の時間の軸です。リポジトリを作った日に長い目盛りが付き、のせるとそのリポジトリが強調されます。
- マウスには、少し遅れてついて動く丸が付きます（押せるものの上で広がり、リポジトリの点には吸い付く）。
- 左の欄は、名前・流れ・メンバーだけにしています。見出し・件数・種類の小さな文字は出しません。サイトに出る文はすべて英語です。

## 動かす

Node.js 24 以上が要ります。

```sh
npm install
npm run dev      # http://localhost:5173 で開く（保存すると表示も変わる）
npm run build    # dist/ に書き出す
npm run check    # Biome と型の検査
```

## リポジトリを足す・直す

中身はすべて [src/data.ts](src/data.ts) にあります。図の配置（角度・線の曲がり方・ラベルの位置・外のものの置き場所）は自動で決まるので、座標を書く必要はありません。サイトに出る文（説明・流れの手順・線に添える説明）は英語で、説明は 1 文で書きます。

- リポジトリを足す: `projects` に 1 件足し、`summary` に 1 文の説明を、`created` に GitHub でリポジトリを作った日を書く。図の上では、`categories` の順、各カテゴリの中では書いた順に時計回りで並ぶ。`members` には、主に開発している人の GitHub の ID を書く
- 流れを足す: `flows` に 1 件足す。`stops` には、上から順に「どこで（`actor`）何が起きるか（`text`）」を書き、前の場所からここへ来る線に添える短い説明を `label` に書く。横から合流するもの・横へ分かれるものは `branch` に書く（`dir` は `in` か `out`）。始まりの場所へ戻る段（返事が届くなど）は、`label` を書いたときだけ線を引き、書かなければ番号だけ付く
- 流れに出てくるものを足す: `actors` に足す。リポジトリなら `project` にその id を書く。書かなければ外のものとして輪の外の箱で描き、`about` の文を説明に出す。`hub: true` のもの（GitHub）は図の中心で表す
- メンバーを足す: `members` に GitHub の ID とアイコンの URL を足す
- カテゴリを足す: `categories` に足し、`CategoryId` の型にも足す

足したあとは `npm run build && npm run og && npm run build` で、リンクを貼ったときの画像（`public/og.png`）も作り直します。`npm run og` は手元の Google Chrome を使います（場所は `CHROME_PATH` で変えられます）。

## 仕組み

| ファイル                       | 役割                                                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/data.ts](src/data.ts)     | 組織・カテゴリ・リポジトリ・メンバー・流れのデータ                                                                                                                            |
| [src/layout.ts](src/layout.ts) | 図の座標を計算する。線はロゴと同じく、平行な束が中心から出て、同じ中心を持つ角で 1 回だけ曲がる。外のものを置く間、つながりの線の高さ、線に添える説明を置く場所もここで決める |
| [src/render.ts](src/render.ts) | データから HTML と SVG を作る。ビルドのときに [vite.config.ts](vite.config.ts) が index.html に埋め込む                                                                       |
| [src/main.ts](src/main.ts)     | 操作（点・箱・流れ・カテゴリ・メンバー・目盛りにのせる・押す、キーボード、マウスについて動く丸、色の切り替え）。HTML に付けた `data-*` 属性だけを読む                         |
| [src/style.css](src/style.css) | 見た目。色はロゴの 2 色（`#f2f1ec` と `#121317`）と、その間の灰色だけ                                                                                                         |
| [src/logo.ts](src/logo.ts)     | ロゴの SVG（GitHub の組織のアイコンを測って描き直したもの）                                                                                                                   |

図と説明は HTML に書き出されるので、JavaScript が動く前から表示されます。幅の広い画面では、ページは動かさずに 1 画面に収め、説明欄だけが長いときに中で動きます。

## 公開

main に push すると、GitHub Actions（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）がビルドして、AWS の S3 と CloudFront に出し直します。欄と図の間の目盛りはビルドした日までを刻むので、毎日 0 時（日本時間）にも作り直します。AWS の側は、[infra/](infra/) の CDK のスタック `OrgSite` が作ります（書き方は Nakamaba に合わせています）。

最初の 1 回だけ、手元から次を行います。

1. AWS の us-east-1 の ACM で、`4rtofl.org` の証明書を発行する。検証方法は「DNS 検証」を選び、出てきた CNAME を Cloudflare に足す
2. 証明書が発行されたら、管理者の権限で手元からデプロイする。`cdk bootstrap` をしていないアカウントでは、先に `npx cdk bootstrap` を実行する

   ```sh
   npm run deploy -- -c publicDomain=4rtofl.org -c publicCertificateArn=<証明書の ARN>
   ```

   GitHub の OIDC の設定がまだ無いアカウントでは、`-c createGitHubOidc=true` も付ける（Nakamaba と同じアカウントなら作ってあるので要らない）

3. 出力された `GitHubDeployRoleArn` を、このリポジトリの Secrets に `AWS_DEPLOY_ROLE_ARN` として登録する。`PUBLIC_DOMAIN`（`4rtofl.org`）と `PUBLIC_CERTIFICATE_ARN`（証明書の ARN）も登録する
4. Cloudflare で、`4rtofl.org` の CNAME を、出力された `DistributionDomainName` に向ける。プロキシは切る（DNS のみ）

Secrets を登録するまでは、GitHub Actions はビルドまでで止まり、デプロイはしません。
