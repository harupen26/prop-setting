# 手具セット管理アプリ 引き継ぎメモ

最終更新: 2026-07-02

## 目的

新体操などの手具セット位置を、50m x 40m のドリル上で管理するスマホ向けアプリです。
30人前後の参加者が、それぞれ入場シートと退場シートに自分の手具位置を置き、管理者が全員分を統合して確認・PDF出力できることを目標にしています。

アプリ内表示は日本語、デザインは白基調でシンプルにする方針です。

## 技術構成

- Expo + React Native + TypeScript
- React Native Web 対応
- SVG描画: `react-native-svg`
- ローカル保存: `@react-native-async-storage/async-storage`
- PDF出力: `expo-print`, `expo-sharing`
- Supabase: 接続口と初期SQLのみ用意済み
- テスト: Vitest

## 起動方法

```bash
pnpm install
pnpm start
```

Webで確認する場合:

```bash
pnpm web
```

または静的出力:

```bash
pnpm exec expo export --platform web
```

## 確認コマンド

```bash
pnpm typecheck
pnpm test
pnpm exec expo export --platform web
```

## 主なファイル

- `App.tsx`
  - 全体画面、入場/退場タブ、参加者切替、統合表示切替、PDF出力呼び出し
- `src/components/DrillCanvas.tsx`
  - 50m x 40m ドリルの描画、格子線、手具丸の表示、タップ配置、ドラッグ移動、重なり表示
- `src/components/SidebarDrawer.tsx`
  - 手具サイドバー、フォルダー、表示/非表示、手具追加、色選択
- `src/components/AdminPanel.tsx`
  - 参加者名、共有リンク表示、統合、PDF出力、大会複製
- `src/state/appReducer.ts`
  - アプリ状態更新ロジック
- `src/selectors.ts`
  - 表示対象マーカー、手具表示状態などの取得
- `src/domain/grid.ts`
  - 40m x 50m 座標系、吸着、格子描画用の座標計算、重なりオフセット
- `src/domain/labels.ts`
  - 丸内ラベルの最大4文字処理、名前から表示名を作る処理
- `src/domain/pdf.ts`
  - A4縦PDF、入場/退場の上下2面出力
- `src/data/seed.ts`
  - 初期参加者、手具、フォルダー、サンプルマーカー
- `supabase/schema.sql`
  - Supabase用の初期テーブル案

## 現在できていること

- 入場/退場をタブで切り替えられる
- 参加者ごとに編集できる
- 手具を選択してドリル上に丸を置ける
- 丸をドラッグして移動できる
- 配置は細かいスナップ単位に吸着する
- 手具フォルダーを作れる
- 手具ごと、フォルダーごとに表示/非表示を切り替えられる
- 参加者名を変えると丸内ラベルも変わる
- 重なった丸は保存座標を変えず、表示だけ少しずらす
- PDF出力の土台がある
- Supabase設定用の `.env.example` と `supabase/schema.sql` がある

## 参考PDFに合わせて調整済みの点

`src/domain/grid.ts` を中心に、次の方針でドリルを描画しています。

- 全体は横50m、縦40m
- 5mを16分割相当のスナップ座標で扱う
- 中央30m x 30mの黒い枠を描画
- 5mごとの黒い十字を描画
- 中心から縦横に黒い線を伸ばす
- 格子点は薄い青色
- 緑ガイド線は30m x 30mより外側に薄めに表示

## まだ未完成・次に直すべきこと

直近のユーザー要望として、次の4点は未実装です。

1. 丸内文字がまだ大きく、丸からはみ出すことがある
   - `src/components/DrillCanvas.tsx` の `SvgText` の `fontSize` と `yOffset` を小さくする
   - PDF側も必要なら `src/domain/pdf.ts` の文字サイズを合わせる

2. 統合表示で他の参加者シートが十分に統合表示されない
   - `src/selectors.ts` の `getVisibleMarkers` が `integratedParticipantIdsByCompetition` に依存している
   - 短期対応として、`viewMode === "master"` のときは現在大会の全参加者マーカーを表示するのがよい

3. 一つの手具が一つのシートに複数配置できてしまう
   - `src/state/appReducer.ts` の `placeMarker` で、同じ `competitionId + participantId + phase + roleId` の既存マーカーを削除してから新規配置する
   - これにより同じ手具を再配置したときは「追加」ではなく「置き換え」になる

4. 手具追加時の自由色選択がない
   - `src/components/SidebarDrawer.tsx` の既存パレットの最後に `+` の丸ボタンを追加する
   - 押したらカラーパレットまたはHEX入力を開き、任意色を `newRoleColor` に反映する

## Supabase・共有機能の現状

まだ本番用の共同編集は完成していません。

現在は以下の状態です。

- Supabaseクライアント初期化ファイルはある
- `.env.example` はある
- `supabase/schema.sql` はある
- 参加者ごとの `token` は初期データにある
- 管理画面に共有リンク風の表示はある

ただし、次は未完成です。

- 秘密リンクから該当参加者だけを開くルーティング
- Supabaseへの保存・読み込み
- リアルタイム同期
- 権限制御
- 提出状況の永続化

まずはローカル版のUI/操作感を固め、その後 Supabase 同期を入れるのがよいです。

## GitHubへ移す手順

このPCでは 2026-07-02 時点で `gh` コマンドが未インストール、かつ `git remote` が未設定でした。
そのため、この環境だけではGitHubへ直接pushできません。

GitHubで空のリポジトリを作ったあと、次を実行してください。

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git branch -M main
git push -u origin main
```

SSHを使う場合:

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git branch -M main
git push -u origin main
```

## 新しいCodexへの依頼文

次の文をそのまま渡すと作業再開しやすいです。

```text
このリポジトリはExpo + React Native + TypeScriptの手具セット管理アプリです。
まず `HANDOFF.md` を読んで現状を把握してください。

優先して直したいこと:
1. 丸内文字が大きくて丸に入り切っていないので、DrillCanvasとPDFの文字サイズを調整してください。
2. 統合表示で全参加者の入場/退場マーカーが見えるようにしてください。
3. 同じ参加者・同じ入場/退場シートでは、一つの手具を一つだけ配置できるようにしてください。再配置時は既存マーカーを置き換えてください。
4. 手具追加の色選択で、既存パレットに加えて `+` 丸ボタンから自由色を選べるようにしてください。

変更後は `pnpm typecheck`, `pnpm test`, `pnpm exec expo export --platform web` を実行し、可能ならブラウザで表示確認してください。
アプリ内UIは日本語のまま、白基調でシンプルにしてください。
```

