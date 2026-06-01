# デプロイ / Android 実行手順

このプロジェクトは3つの配布先を分けて扱う。

- マルチプレイサーバ: Colyseus Cloud
- Webフロントエンド: Render または Vercel
- Androidフロントエンド: CapacitorでビルドしてAndroidエミュレーターへインストール

重要なのは、WebとAndroidのフロントエンドはどちらもビルド時に
`VITE_COLYSEUS_URL=https://<colyseus-cloud-host>` を埋め込むこと。
Colyseus Cloud側で `wss://` の接続URLが表示される場合は、それを使ってもよい。
これを忘れると、フロントエンドが正しい対戦サーバへ接続できない。

## 全体の順番

```text
1. Colyseus Cloudへマルチプレイサーバをデプロイ
        |
        v
2. https://<colyseus-cloud-host>/health を確認
        |
        v
3. そのURLを VITE_COLYSEUS_URL としてWebフロントエンドをビルド/デプロイ
        |
        v
4. WebのURLを CLIENT_ORIGIN としてColyseus Cloud側に設定
        |
        v
5. 同じ VITE_COLYSEUS_URL でAndroidをビルドし、エミュレーターへ入れる
```

## 事前チェック

リリース前にローカルで最低限これを通す。

```bash
npm run deploy:check
```

このコマンドは以下を確認する。

- `npm test`
- `npm run build` ... Colyseusサーバを `build/index.js` に出力
- `npm run build:game` ... Web/Android用のゲーム本体を `dist/` に出力

## 1. Colyseus Cloud（マルチプレイサーバ）

このプロジェクトのサーバ入口は `server/index.ts`。
Colyseus Cloud向けには以下を用意済み。

- `npm run build`: TypeScriptのサーバを `build/index.js` に出力
- `ecosystem.config.cjs`: PM2が `build/index.js` を起動
- `/health`: 稼働中プロセスの確認用エンドポイント
- `CLIENT_ORIGIN` / `CORS_ORIGIN`: WebフロントエンドのCORS許可origin

初回または手動デプロイ:

```bash
npm run deploy:check
npx @colyseus/cloud deploy
```

Colyseus Cloud側の環境変数:

```text
NODE_ENV=production
CLIENT_ORIGIN=https://<web-frontend-host>
```

初回はWebのURLが未確定なので、先に `CLIENT_ORIGIN` を未設定または一時値でデプロイし、
Webデプロイ後に正しいURLへ更新して再デプロイする。

デプロイ後の確認:

```bash
curl https://<colyseus-cloud-host>/health
```

`ok: true`、`service: "2d-ninja-slash-colyseus"`、`room` が返ればサーバは起動している。

## 2A. Render（Webフロントエンド）

Renderを使う場合は `render.yaml` を使う。

設定値:

```text
Build Command: npm ci --include=dev && npm run build:game
Publish Directory: ./dist
VITE_COLYSEUS_URL=https://<colyseus-cloud-host>
```

`render.yaml` には `VITE_COLYSEUS_URL` を手入力するための項目を入れてある。
RenderのBlueprint作成/更新時にColyseus CloudのURLを入れる。

Renderでの流れ:

```text
Render Dashboard
  -> New +
  -> Blueprint
  -> このリポジトリを選択
  -> VITE_COLYSEUS_URL を設定
  -> Apply
```

Web公開後、Colyseus Cloud側の `CLIENT_ORIGIN` をRenderのURLに合わせる。

```text
CLIENT_ORIGIN=https://<render-site>.onrender.com
```

## 2B. Vercel（Webフロントエンド）

Vercelを使う場合は `vercel.json` を使う。

このプロジェクトでは `npm run build` がサーバ用なので、Vercelに任せきると
誤ってColyseusサーバだけをビルドする可能性がある。
そのため `vercel.json` で明示している。

```json
{
  "buildCommand": "npm run build:game",
  "installCommand": "npm ci",
  "outputDirectory": "dist"
}
```

Vercel側の環境変数:

```text
VITE_COLYSEUS_URL=https://<colyseus-cloud-host>
```

Vercelでの流れ:

```text
Vercel Dashboard
  -> Add New Project
  -> このリポジトリを選択
  -> Environment Variables に VITE_COLYSEUS_URL を追加
  -> Deploy
```

Web公開後、Colyseus Cloud側の `CLIENT_ORIGIN` をVercelのURLに合わせる。

```text
CLIENT_ORIGIN=https://<vercel-project>.vercel.app
```

## 3. Androidエミュレーター（Cloudサーバ接続）

Colyseus Cloudへ接続するAndroidビルドは、このコマンドを使う。

```bash
VITE_COLYSEUS_URL=https://<colyseus-cloud-host> npm run android:cloud:run
```

このコマンドは以下を順番に実行する。

```text
npm run build:android:cloud
  -> VITE_COLYSEUS_URL が https:// または wss:// で指定されているか確認
  -> npm run build:game で dist/ を作成

npx cap sync android
  -> dist/ のWebゲームを Androidプロジェクトへ同期

npx cap run android
  -> GradleでAPKを作成
  -> adbでエミュレーターへインストール
  -> アプリを起動
```

対象エミュレーターを確認する。

```bash
npx cap run android --list
```

対象を明示して起動する。

```bash
VITE_COLYSEUS_URL=https://<colyseus-cloud-host> npm run android:cloud:run -- --target <device-id>
```

## 4. Androidエミュレーター（ローカルサーバ接続）

ローカルでColyseusサーバも動かす場合はこちら。

ターミナル1:

```bash
npm run dev:server
```

ターミナル2:

```bash
npm run android:debug:run
```

`android:debug:run` はAndroidエミュレーターからホストPCを指す
`http://10.0.2.2:2567` を自動で `VITE_COLYSEUS_URL` に入れる。

## 5. WSL2でエミュレーターが見えない場合

このプロジェクトをWSL2で扱い、Android Studio/EmulatorがWindows側にある場合、
Linux側の `adb` ではエミュレーターが見えないことがある。

まず確認する。

```bash
adb devices
```

何も出ない場合は、Windowsの `adb.exe` を使ってインストールする。

```bash
VITE_COLYSEUS_URL=https://<colyseus-cloud-host> npm run android:cloud:sync
cd android
./gradlew assembleDebug
cd ..

ADB_WIN=$(powershell.exe -NoProfile -Command '$env:LOCALAPPDATA + "\Android\Sdk\platform-tools\adb.exe"' | tr -d '\r')
ADB=$(wslpath -u "$ADB_WIN")
APK_WIN=$(wslpath -w "$PWD/android/app/build/outputs/apk/debug/app-debug.apk")

"$ADB" devices -l
"$ADB" install -r "$APK_WIN"
"$ADB" shell am start -n com.mizuki2.ninjaslash/.MainActivity
```

## 6. 接続先の早見表

| 実行対象 | 使うコマンド/設定 | Colyseus接続先 |
| --- | --- | --- |
| ローカルWeb開発 | `npm run dev` + `npm run dev:server` | `http://localhost:2567` |
| Render Web本番 | `render.yaml` | `VITE_COLYSEUS_URL=https://<colyseus-cloud-host>` |
| Vercel Web本番 | `vercel.json` | `VITE_COLYSEUS_URL=https://<colyseus-cloud-host>` |
| Android + ローカルサーバ | `npm run android:debug:run` | `http://10.0.2.2:2567` |
| Android + Colyseus Cloud | `VITE_COLYSEUS_URL=... npm run android:cloud:run` | `https://<colyseus-cloud-host>` |

## 7. よくあるミス

- Cloudにpushしていないローカル変更は、Colyseus Cloud/Render/Vercelには反映されない。
- Web/Androidのビルド時に `VITE_COLYSEUS_URL` を入れ忘れると、対戦サーバに接続できない。
- Vercelで `npm run build` を使うと、このプロジェクトではサーバだけがビルドされる。
- Androidで `npx cap sync android` を忘れると、エミュレーターに古いWebゲームが入る。
- Colyseus Cloudの `CLIENT_ORIGIN` がWeb公開URLと違うと、CORSで接続に失敗する。
- WSL2ではLinux `adb` とWindows `adb.exe` を混ぜると、デバイス一覧が食い違う。
