# ip-address-app

Node.js 24 + Express + Docker で、**`127.0.0.1`** と **`0.0.0.0`** にバインドしたサーバーの違いを Linux コマンドで確かめる学習用リポジトリです。

| bind アドレス | コンテナ内から | ホストから (`-p` 経由) |
|---|---|---|
| `127.0.0.1` | 届く | **届かない** |
| `0.0.0.0` | 届く | 届く |

## 前提

- Linux (または WSL2) / Docker Engine + Compose v2
- ローカル実行する場合: Node.js 24 以上、pnpm 10（`corepack enable`）

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

出てきた IP（例 `172.18.0.2`）に対して、ホストから叩きます。

```bash
curl -sS -m 3 http://172.18.0.2:3000
```

`bind-loopback` は拒否され、`bind-all` は応答します（Linux ホストの場合。Docker Desktop では直接届かないことがあります）。

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

別ターミナルで次を実行します。

```bash
ss -tlnp | grep -E '3001|3002'
```

## レスポンスの見方

```json
{
  "boundHost": "0.0.0.0",
  "port": 3000,
  "serverSeenLocalAddress": "172.18.0.2",
  "clientRemoteAddress": "172.18.0.1"
}
```

- `boundHost`: `listen()` に渡したアドレス
- `serverSeenLocalAddress`: 実際に接続を受けた側のアドレス
- `clientRemoteAddress`: 接続元。ホスト経由だと Docker ブリッジのゲートウェイ IP になる

## ファイル構成

```
.
├── server.js            # HOST / PORT 環境変数で bind 先を切り替える Express サーバー
├── Dockerfile           # node:24-slim + iproute2 / curl
├── docker-compose.yml   # 127.0.0.1 版と 0.0.0.0 版を同時起動
└── package.json
```
