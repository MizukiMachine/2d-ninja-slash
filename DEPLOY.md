# Render デプロイ手順（ゲーム単体）

`game.html` のゲーム本体（デバッグコンソール無し）を Render の静的サイトとして配信する。

## 仕組み
- `npm run build:game` … `BUILD_TARGET=game` で `game.html` のみをエントリにビルドし、
  出力された `dist/game.html` を `dist/index.html` にリネームする（`vite.config.ts`）。
  → 静的ホスティングのルート `/` でそのままゲームが起動する。
- `public/assets/` は `dist/assets/` へコピーされ、コード内の `/assets/...` 絶対パスでそのまま参照される。
- 通常の `npm run build` は従来どおりデバッグコンソール(index.html)とゲーム(game.html)の両方を出力する（開発用、変更なし）。
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
