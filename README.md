# 月下の忍 - Survival Shinobi

3レーン制の2D忍者アクションゲーム。Phaser 4 製で、Web と Android（Capacitor）で動く

## ゲーム概要

- 上段・中段・下段の3レーンを移動しながら、斬撃とジャンプで敵を捌く
- ひとりで遊ぶサバイバル（`Sandbox`）と、Colyseus サーバ権威型の1対1対戦（`Multiplayer`）を収録
- 画面はランドスケープ／ポートレートの両対応

## 構成

- `src/game/` — Phaser のゲームロジック（`scenes/` にシーン一式）
- `src/net/` — Colyseus クライアント接続
- `src/app/` — エントリ配線とデバッグツール
- `server/` — Colyseus サーバ（`rooms/` に対戦の部屋ロジック）
- `public/assets/` — 背景・スプライトとマニフェスト
- `android/` — Capacitor の Android プロジェクト

## 関連ドキュメント

- 開発手順: [docs/development.md](docs/development.md)
- デプロイ手順: [DEPLOY.md](DEPLOY.md)
