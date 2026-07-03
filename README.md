# 手具セット管理

YOKOHAMA ROBINS向けの手具セット管理アプリです。無料運用を最優先に、PWAとして公開する方針です。

## 開発

```bash
pnpm install
pnpm start
```

## 使い方ガイド

初めて使うメンバー・管理者向けの説明は[docs/user-guide.md](docs/user-guide.md)にあります。

## PWAとして公開

本番用のWeb/PWAを書き出します。

```bash
pnpm export:web
```

`dist/`をVercelなどの無料静的ホスティングに公開します。Vercelでは`vercel.json`により、ビルドコマンドと出力先は設定済みです。

スマホでは公開URLを開き、ブラウザの「ホーム画面に追加」からアプリのように起動できます。

## 現在できること

- プロジェクト一覧から編集プロジェクトを選択
- 入場/退場タブの切り替え
- 50m x 40mドリルへのタップ配置とドラッグ移動
- ピンチ/ボタンによる拡大縮小
- 格子点と0.5歩単位へのスナップ
- 手具の色・フォルダー・表示/非表示管理
- 参加者名編集、参加者追加、丸内ラベル管理
- プロジェクト内でのシート/バージョン複製
- 招待ID/リンクコピーの導線
- 統合表示、PDF出力
- PWA manifest、ホーム画面追加、Service Workerによる静的キャッシュ
- Supabase接続口と初期SQLスキーマ

## 無料運用方針

- App Store / Google Play公開は前提にしません。
- Apple Developer Program / Google Play Developer登録は前提にしません。
- GitHub + Vercelなど無料枠のある静的ホスティングで公開します。
- ネイティブAPK/IPA化は必要になった場合の選択肢として扱い、PWAを第一優先にします。

## Supabase

共同編集を本格化する場合は`.env.example`を`.env`にコピーし、以下を設定します。

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

初期スキーマは`supabase/schema.sql`にあります。
