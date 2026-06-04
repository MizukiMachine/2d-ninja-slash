# 開発手順

## 必要環境

- Node.js（`.node-version` を参照）
- npm
- Android ビルドには Android Studio / Gradle と Capacitor CLI

## セットアップ

```bash
npm install
```

## ローカル開発

```bash
npm run dev          # Vite 開発サーバ（Web / Debug Lab）
npm run dev:server   # Colyseus サーバを tsx watch で起動
```

- ゲーム本体: `game.html`
- 調整用 Debug Lab: `index.html`

## 型チェック・テスト

```bash
npm run typecheck    # クライアントとサーバの両 tsconfig を検査
npm test             # vitest run
```

## ビルド

```bash
npm run build        # サーバビルド（build:server）
npm run build:web    # typecheck + Vite ビルド（Web）
npm run build:game   # typecheck + Vite ビルド（ゲーム mode）
npm run deploy:check # test + build + build:game をまとめて検証
```

## Android（Capacitor）

```bash
npm run android:sync          # build:game 後に cap sync
npm run android:run           # build:game + cap sync + cap run
npm run android:open          # Android Studio で開く

# デバッグ / クラウド向けビルドの差分は scripts/ 配下を参照
npm run android:debug:run
npm run android:cloud:run
```

詳しいデプロイ・本番設定は [../DEPLOY.md](../DEPLOY.md) を参照
