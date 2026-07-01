# 手具セット管理

Expo + React Native + TypeScript の手具セット管理アプリです。

## 起動

```bash
pnpm install
pnpm start
```

## 現在できること

- 入場/退場タブの切り替え
- 50m x 40mドリルへのタップ配置とドラッグ移動
- 格子点と中間へのスナップ
- 手具の色・フォルダー・表示/非表示管理
- 参加者ごとの丸内ラベル管理
- 統合表示、大会複製、PDF出力
- Supabase接続口と初期SQLスキーマ

## Supabase

`.env.example` を `.env` にコピーし、以下を設定します。

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

初期スキーマは `supabase/schema.sql` にあります。
