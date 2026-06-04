# 月下の忍 - Survival Shinobi

## ゲーム概要

- 月夜の寺院を舞台にした、3レーン制の2D忍者アクション
- Phaser 4 製のブラウザゲームで、Web・Android（Capacitor）の両方で動く
- ひとりで遊ぶ `Sandbox` のサバイバルと、Colyseus サーバ権威型の1対1 `Multiplayer` 対戦を収録
- プレイヤーは上段・中段・下段のレーンを行き来しながら、斬撃・ジャンプで敵を捌く

## ゲームの仕様と挙動

- `MainMenu` から `Start`（シングルプレイ）と `Multiplayer`（対戦）、BGMトグルを選ぶ
- レーンは `upper` / `middle` / `lower` の3本で、アクターのY座標は毎フレーム所属レーンへスナップされる（物理によるY移動はしない）
- 横移動・斬撃・ジャンプ・被弾（hurt）・撃破（dead）のアクションを持つ
- シングルプレイ（`Sandbox`）はラウンド制で、3レーンに散らばって出現する敵を全滅させるとラウンドクリア、HPが尽きるとゲームオーバー表示
  - 敵はプレイヤーの近くには湧かない安全半径を持ち、パトロール／追跡で接近する
- マルチプレイ（`Multiplayer`）はサーバ権威の1対1デュエル
  - HP5・斬撃にはクールダウンと当たり判定の遅延フレームがあり、被弾でノックバック
  - `waiting` → `countdown` → `fighting` → `finished` のフェーズで進行し、勝者と通算 `wins` を保持
  - 切断後20秒以内なら reconnection token で同じ部屋へ復帰でき、失敗時は新しい部屋へ参加
- 画面はランドスケープ `1280x720` とポートレート `720x1280` の2プロファイルに対応
- ゲーム本体（`game.html`）とは別に、調整用の `Debug Lab`（`index.html`）から `Gym` / `LaneEditor` / `Settings` などの開発シーンへ入れる

## 構成

- `src/gameMain.ts` — プレイヤー向けゲーム（`game.html`）のエントリ
- `src/main.ts` — Debug Lab（`index.html`）のエントリ
- `src/app/` — AppContext 生成・DOM配線・デバッグコンソール・設定の入出力
- `src/game/` — Phaser のゲームロジック
  - `src/game/scenes/` — `Boot` `Splash` `MainMenu` `Sandbox` `Multiplayer` `Gym` `LaneEditor` `Settings`
  - `src/game/createGame.ts` — Phaser ゲームインスタンス生成と表示プロファイル
  - `src/game/enemyBehavior.ts` `combatHealth.ts` `playerLaneMovement.ts` — 戦闘・レーン移動ロジック
  - `src/game/effects/` `src/game/audio/` `src/game/assets/` — 演出・サウンド・アセット定義
- `src/net/` — Colyseus クライアント接続とマルチプレイヤーセッション管理
- `src/stores/` — 設定・デバッグの状態ストア
- `server/` — Colyseus サーバ
  - `server/rooms/BattleRoom.ts` `BattleState.ts` — デュエルの部屋ロジックと同期スキーマ
- `public/assets/` — 背景・キャラクタースプライトシートと `index.json` マニフェスト
- `android/` — Capacitor の Android プロジェクト

## 関連ドキュメント

- 開発手順: [docs/development.md](docs/development.md)
- デプロイ手順: [DEPLOY.md](DEPLOY.md)
