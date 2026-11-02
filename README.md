# ip-address-app

Docker + Express (Node.js) で **`127.0.0.1`** と **`0.0.0.0`** にバインドしたサーバーの通信の違いを確認できるミニデモです。

## 何が分かる？

| バインドアドレス | コンテナ内部 | コンテナ外部（ホスト） |
|---|---|---|
| `127.0.0.1` | アクセス可能 | **アクセス不可** (Connection refused) |
| `0.0.0.0` | アクセス可能 | アクセス可能 |

Docker のポートマッピング (`-p 3001:3001`) はコンテナの外側からパケットを転送しますが、コンテナ内のプロセスが `127.0.0.1` にしかバインドしていない場合、外部からの接続は拒否されます。

## 必要なもの

- Docker & Docker Compose
- Node.js 20+ & pnpm（ローカル実行する場合）

## クイックスタート (Docker)

```bash
# コンテナをビルド & 起動
docker compose up --build -d

# 0.0.0.0 にバインドしたサーバー → 成功する
curl http://localhost:3002

# 127.0.0.1 にバインドしたサーバー → Connection refused になる
curl http://localhost:3001

# 後片付け
docker compose down
```

## ローカル実行

```bash
pnpm install

# 127.0.0.1 バインド (ポート 3001)
pnpm start:localhost

# 0.0.0.0 バインド (ポート 3002)
pnpm start:all
```

ローカルで実行した場合はどちらも `curl http://localhost:<port>` でアクセスできます（Docker のネットワーク分離が無いため）。

## ファイル構成

```
.
├── server-localhost.js      # 127.0.0.1 にバインドするサーバー
├── server-allinterfaces.js  # 0.0.0.0 にバインドするサーバー
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## なぜ違いが生まれるのか

- **`127.0.0.1`** はループバックインターフェースのみをリッスンします。Docker コンテナ内では、ホストとコンテナのループバックは別物なので、ポートフォワーディングしても外から到達できません。
- **`0.0.0.0`** はすべてのネットワークインターフェースをリッスンするため、Docker のポートマッピング経由でホストから到達可能になります。
