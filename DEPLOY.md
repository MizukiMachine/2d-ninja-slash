# デプロイ手順

このプロジェクトは、静的フロントエンドと Colyseus のリアルタイムバックエンドを分けてデプロイする。

## Colyseus Cloud（対戦サーバ）

Colyseus Cloud 用に以下を用意している。

- `npm run build` ... TypeScript の Colyseus サーバを `build/index.js` に出力する
- `ecosystem.config.cjs` ... PM2 が `build/index.js` を起動する
- `/health` ... デプロイ後に実行中プロセスの状態を確認する
- `CLIENT_ORIGIN` / `CORS_ORIGIN` ... 静的フロントエンドの origin を CORS 許可する

### デプロイ

1. リポジトリを GitHub に push する。
2. Colyseus Cloud でアプリを作成し、このリポジトリを連携する。
3. Build Command はデフォルトの `npm run build` を使う。
4. 環境変数を設定する。
   - `NODE_ENV=production`
   - `CLIENT_ORIGIN=https://<frontend-host>`
   - 任意: `PM2_INSTANCES=<n>`（初回は未設定のまま 1 プロセスで起動する）
5. ローカル CLI からデプロイする場合は `npx @colyseus/cloud deploy` を実行する。
6. デプロイ後、`https://<colyseus-cloud-host>/health` が `ok: true` を返すことを確認する。

フロントエンド側には、ビルド時に `VITE_COLYSEUS_URL=https://<colyseus-cloud-host>` を設定する。

### ローカル確認

```bash
npm run build
npm run start:server
curl http://localhost:2567/health
```

開発中は従来どおり以下で TypeScript のまま起動できる。

```bash
npm run dev:server
```

## Render（ゲーム単体）

`game.html` のゲーム本体（デバッグコンソール無し）を Render の静的サイトとして配信する。

## 仕組み
- `npm run build:game` … `BUILD_TARGET=game` で `game.html` のみをエントリにビルドし、
  出力された `dist/game.html` を `dist/index.html` にリネームする（`vite.config.ts`）。
  → 静的ホスティングのルート `/` でそのままゲームが起動する。
- `public/assets/` は `dist/assets/` へコピーされ、コード内の `/assets/...` 絶対パスでそのまま参照される。
- `npm run build:web` はデバッグコンソール(index.html)とゲーム(game.html)の両方を出力する。
- Render の設定は `render.yaml`（Blueprint）に定義済み。Node バージョンは `.node-version` で固定。

## デプロイ（Blueprint 利用 / 推奨）
1. このリポジトリを GitHub/GitLab に push する。
2. Render ダッシュボード → **New +** → **Blueprint**。
3. リポジトリを連携すると `render.yaml` が読み込まれ、Static Site が作成される。
   - Build Command: `npm install --include=dev && npm run build:game`
   - Publish Directory: `./dist`
4. **Apply** でデプロイ。完了後 `https://2d-ninja-slash.onrender.com` で起動する。

## 手動設定でデプロイする場合（Blueprint を使わない）
Render で **New + → Static Site** を作成し、以下を入力：
- Build Command: `npm install --include=dev && npm run build:game`
- Publish Directory: `dist`

## ローカル確認
```bash
npm run build:game
npm run preview   # http://localhost:4173 で本番ビルドのゲームを確認
```
