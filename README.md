# ip-address-app

Node.js 24 + Express + Docker で、**`127.0.0.1`** と **`0.0.0.0`** にバインドしたサーバーの違いを Linux コマンドで確かめる学習用リポジトリです。

| bind アドレス | コンテナ内から | ホストから (`-p` 経由) |
|---|---|---|
| `127.0.0.1` | 届く | **届かない** |
| `0.0.0.0` | 届く | 届く |

## 前提

- Linux (または WSL2) / Docker Engine + Compose v2
- ローカル実行する場合: Node.js 24 以上、pnpm 10（`corepack enable`）
- 本 README のコマンドは macOS (Docker Desktop) + Linux コンテナ、および macOS ローカルで動作確認済みです。OS 依存で結果が変わる箇所はその都度注記しています。

## 1. 起動

```bash
docker compose up --build -d
```

```bash
docker compose ps
```

`bind-loopback` はコンテナ内の 3000 を `127.0.0.1` で、`bind-all` は `0.0.0.0` で待ち受けます。ホスト側は `3001` と `3002` に公開しています。

## 2. ホストから叩く

```bash
curl -sS -m 3 http://localhost:3002
```

JSON が返ります（`0.0.0.0` なので届く）。

```bash
curl -sS -m 3 http://localhost:3001
```

接続リセットや空の応答で失敗します（`127.0.0.1` はコンテナ自身のループバックのみ。ホストからの転送先 `eth0` では待ち受けていない）。

## 3. コンテナ内から叩く

```bash
docker exec bind-loopback curl -sS -m 3 http://127.0.0.1:3000
```

こちらは成功します。同じサーバーでも「どこから叩くか」で結果が変わることが分かります。

## 4. 待ち受けソケットを見る

```bash
docker exec bind-loopback ss -tlnp
```

```bash
docker exec bind-all ss -tlnp
```

`Local Address:Port` の列を比べます。

- `bind-loopback`: `127.0.0.1:3000`
- `bind-all`: `0.0.0.0:3000`

## 5. コンテナの IP を直接叩く

```bash
docker exec bind-all ip -4 addr show eth0
```

```bash
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' bind-loopback
```

出てきた IP（例 `172.21.0.2`）に対してホストから直接 `curl` したくなりますが、これは **Linux 上でネイティブの Docker Engine を使っている場合のみ**届きます。Docker Desktop (macOS/Windows) は内部的に Linux VM 経由でコンテナを動かしており、コンテナのブリッジネットワークが Mac/Windows のホスト OS からは見えないため、同じコマンドは `Connection timed out` になります（実機で確認済み）。この違い自体が「`0.0.0.0` にバインドしていても、host-container 間のネットワーク構成次第で到達性は変わる」という良い例なので、手元の環境がどちらかを意識して読んでください。

## 6. 後片付け

```bash
docker compose down
```

## ローカル実行 (Docker なし)

```bash
pnpm install
```

```bash
pnpm start:loopback
```

```bash
pnpm start:all
```

別ターミナルで次を実行します。`ss` は iproute2 パッケージのコマンドで macOS には存在しないため、OS に応じて使い分けてください。

Linux / WSL2:

```bash
ss -tlnp | grep -E ':3001|:3002'
```

macOS:

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':3001|:3002'
```

`127.0.0.1:3001` と `*:3002`（＝ `0.0.0.0:3002`）のように、待ち受けアドレスの違いが確認できます。

### 起動中のプロセスを確認・停止する

`pnpm start:loopback` / `pnpm start:all` はフォアグラウンドで動くので通常は `Ctrl+C` で止まりますが、バックグラウンドで起動したまま忘れる（AI エージェントが裏で起動したまま止めてくれない、など）と `3000`〜`3002` が使われたままになり、次の起動が `EADDRINUSE` で失敗します。その場合は以下で確認・停止してください。

どのプロセスがポートを使っているか確認（macOS / Linux 共通、`lsof` が必要）:

```bash
lsof -nP -iTCP:3000,3001,3002 -sTCP:LISTEN
```

PID だけ取得して停止する:

```bash
kill $(lsof -ti tcp:3000,3001,3002)
```

通常の `kill` で終了しない場合は強制終了します:

```bash
kill -9 $(lsof -ti tcp:3000,3001,3002)
```

`lsof` が無い Linux 環境では `fuser` でも同じことができます。

```bash
fuser -k 3000/tcp 3001/tcp 3002/tcp
```

Docker 版（`bind-loopback` / `bind-all`）を使っている場合は、ホスト側の `3000`〜`3002` は専有されません。コンテナを止めたいときは上記ではなく [6. 後片付け](#6-後片付け) の `docker compose down` を使ってください。

## レスポンスの見方

```json
{
  "boundHost": "0.0.0.0",
  "port": 3000,
  "serverSeenLocalAddress": "172.21.0.2",
  "clientRemoteAddress": "192.168.65.1"
}
```

- `boundHost`: `listen()` に渡したアドレス
- `serverSeenLocalAddress`: 実際に接続を受けた側のアドレス
- `clientRemoteAddress`: 接続元。ホスト経由だと Docker ブリッジのゲートウェイ IP になる

## IPv4 アドレスが 4 つの 10 進数に分かれている理由と読み方

`172.21.0.2` のような表記は **ドット付き10進表記 (dotted-decimal notation)** と呼ばれます。IPv4 アドレスの実体は 32 ビットの整数で、人間が 32 桁の 2 進数をそのまま読み書きするのは現実的ではありません。そこで 8 ビット（1 オクテット、最大値 255）ごとに区切り、各オクテットを 10 進数に変換して `.` でつないだのがこの表記です（[RFC 791](https://datatracker.ietf.org/doc/html/rfc791)）。4 分割になっているのは、初期の IPv4（クラスフルアドレッシング）でネットワーク部とホスト部の境界をオクテット単位に揃えていた名残で、CIDR 移行後も表記はそのまま使われ続けています。

読み方の例として `172.21.0.2` を 2 進数に展開すると次のようになります。

```
172      . 21       . 0        . 2
10101100 . 00010101 . 00000000 . 00000010
```

このリポジトリの出力と絡めて、オクテットの意味を押さえておくと役立ちます。

- **`127.0.0.0/8`（例: `127.0.0.1`）**: 丸ごとループバック用に予約されており、常に「自分自身」を指します。`127.0.0.2` などもすべて自ホストを指す点に注意してください。
- **`10.0.0.0/8`・`172.16.0.0/12`・`192.168.0.0/16`**: [RFC 1918](https://datatracker.ietf.org/doc/html/rfc1918) で定義されたプライベートアドレス範囲。Docker のブリッジネットワークが割り当てる `172.x.x.x` もこの範囲内です（他にも予約済みレンジがあり、一覧は下記 IANA レジストリ参照）。
- **`0.0.0.0`**: 特定の1台を指すアドレスではなく、「このホストが持つすべての IPv4 インターフェースを意味する」特殊な値です。`listen()` の bind アドレスとして使うと全インターフェースで待ち受け、ルーティングテーブル上の `0.0.0.0/0` はデフォルトルートを意味します。宛先として使うことはできません。
- **`/24` などの CIDR 表記**: 同じ4オクテットのうち先頭何ビットをネットワーク部とみなすかを表します。

## クラウドで実際に環境構築するときの選び方

このリポジトリで再現した「`127.0.0.1` はコンテナ外から届かない／`0.0.0.0` は届く」という構図は、本番のクラウド環境でもそのまま問題になります。ロードバランサーやオーケストレーターのヘルスチェックは、アプリと**別のネットワーク名前空間（＝別ホスト相当）**から接続してくるため、`bind-loopback` コンテナに対する `curl` と同じことが起きます。

- **コンテナ/クラウドにデプロイするアプリは `0.0.0.0`（IPv6 なら `::`）にバインドするのが基本**です。`127.0.0.1` にバインドすると、ロードバランサーやオーケストレーターからのヘルスチェックが届かず、「ローカルでは動くのに本番だけヘルスチェックに失敗する」という典型的な事故になります。
  - Google Cloud Run はコンテナが `0.0.0.0` の `$PORT` でリッスンすることを**契約として要求**しており、`127.0.0.1` でリッスンすると起動に失敗します。
  - AWS ECS + Application Load Balancer も、ALB はコンテナの外側から接続するため `0.0.0.0` でリッスンしないとヘルスチェックが unhealthy になり、タスクが再起動を繰り返します。
  - Kubernetes の liveness/readiness probe は Pod の IP アドレス宛てに送信されるため、`127.0.0.1` のみのバインドでは失敗します。
- **「外部に公開したくない」をバインドアドレスで制御しない**こと。`0.0.0.0` でリッスンしていても、セキュリティグループ／ファイアウォールルール／Kubernetes の NetworkPolicy／`docker-compose.yml` の `ports` を公開しない、などでアクセス制御するのが本来の境界です。バインドアドレスはあくまで「OS のソケットがどの NIC で待ち受けるか」の設定でしかありません。
- **`127.0.0.1` が適切な例外**は、同じコンテナ/Pod 内のサイドカーだけがアクセスするメトリクス用ポートなど、「そのプロセス自身または同じネットワーク名前空間内からしかアクセスされない」ことが設計上保証されている場合です。

判断に迷ったら、「このポートに外部（ロードバランサー・オーケストレーター・別ホスト）からアクセスする必要があるか？」を自問してください。Yes なら `0.0.0.0`、No（同一プロセス/同一名前空間内専用）なら `127.0.0.1` で問題ありません。

## 参考リンク

- [RFC 791 – Internet Protocol](https://datatracker.ietf.org/doc/html/rfc791) — IPv4 アドレス形式の原典
- [RFC 1918 – Address Allocation for Private Internets](https://datatracker.ietf.org/doc/html/rfc1918) — プライベートアドレス範囲の定義
- [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry) — `127.0.0.0/8` など予約済みアドレスの一覧
- [Docker docs: Networking overview](https://docs.docker.com/engine/network/) — ブリッジネットワークとコンテナ IP の割り当て
- [Node.js docs: net (Server#listen)](https://nodejs.org/api/net.html) — `listen(port, host)` の挙動
- [Google Cloud Run: Container runtime contract](https://cloud.google.com/run/docs/container-contract) — `0.0.0.0` + `$PORT` でリッスンする要件
- [Kubernetes docs: Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/) — probe が Pod IP 宛てに送られる仕組み
- [AWS ECS docs: Use an Application Load Balancer for Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/alb.html) / [ALB ヘルスチェックの調整](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/load-balancer-healthcheck.html)

## ファイル構成

```
.
├── server.js            # HOST / PORT 環境変数で bind 先を切り替える Express サーバー
├── Dockerfile           # node:24-slim + iproute2 / curl
├── docker-compose.yml   # 127.0.0.1 版と 0.0.0.0 版を同時起動
└── package.json
```
