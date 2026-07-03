export type GuideMode = "member" | "admin";

export type GuideScreen =
  | "projectList"
  | "main"
  | "participantManager"
  | "sidebar"
  | "projectSettings"
  | "pdf";

export type GuidePlacement = "top" | "bottom" | "center";

export type GuideTargetId =
  | "project-add"
  | "project-action-mode"
  | "project-join-invite-input"
  | "project-join-submit"
  | "project-open"
  | "main-help"
  | "participant-manager-button"
  | "pdf-button"
  | "project-settings-button"
  | "phase-tabs"
  | "view-mode-tabs"
  | "participant-list"
  | "role-select"
  | "drill-canvas"
  | "drill-zoom-buttons"
  | "marker-nudge-controls"
  | "sidebar-role-list"
  | "sidebar-add-role"
  | "participant-manager-invite"
  | "participant-manager-list"
  | "participant-manager-add"
  | "participant-manager-integrate"
  | "project-settings-list"
  | "project-settings-duplicate"
  | "project-settings-pdf"
  | "pdf-target"
  | "pdf-save";

export type GuideStep = {
  id: string;
  mode: GuideMode;
  screen: GuideScreen;
  targetId?: GuideTargetId;
  title: string;
  body: string;
  placement?: GuidePlacement;
  advanceOnTargetPress?: boolean;
  targetActionLabel?: string;
};

export type GuideSection = {
  id: string;
  title: string;
  body: string[];
};

export const memberGuideSteps: GuideStep[] = [
  {
    id: "member-install",
    mode: "member",
    screen: "projectList",
    title: "ホーム画面に追加",
    body: "iPhone / iPadはSafariの共有ボタンから、AndroidはChromeのメニューからホーム画面に追加できます。",
    placement: "center"
  },
  {
    id: "member-project-add",
    mode: "member",
    screen: "projectList",
    targetId: "project-add",
    title: "プロジェクトに参加",
    body: "右下の＋から、招待IDで参加できます。まず＋を押して参加画面を開きます。",
    advanceOnTargetPress: true,
    targetActionLabel: "右下の＋を押してください"
  },
  {
    id: "member-project-action-mode",
    mode: "member",
    screen: "projectList",
    targetId: "project-action-mode",
    title: "招待IDで参加を選ぶ",
    body: "プロジェクト追加では「作成」と「参加」を選べます。今回は参加を押します。",
    advanceOnTargetPress: true,
    targetActionLabel: "「参加」を押してください"
  },
  {
    id: "member-project-join-input",
    mode: "member",
    screen: "projectList",
    targetId: "project-join-invite-input",
    title: "招待IDを入力",
    body: "サンプル招待IDとして YR-2026 を入力します。入力しても最後に元へ戻ります。",
    advanceOnTargetPress: true,
    targetActionLabel: "YR-2026 と入力してください"
  },
  {
    id: "member-project-join-submit",
    mode: "member",
    screen: "projectList",
    targetId: "project-join-submit",
    title: "プロジェクトに参加",
    body: "参加ボタンを押すと、既存のサンプルプロジェクトを開いて練習を始めます。",
    advanceOnTargetPress: true,
    targetActionLabel: "「参加」を押してください"
  },
  {
    id: "member-participant",
    mode: "member",
    screen: "main",
    targetId: "participant-list",
    title: "自分の名前を選ぶ",
    body: "ここから自分の名前を選びます。今は練習なので、どの名前を押しても最後に元へ戻ります。",
    advanceOnTargetPress: true,
    targetActionLabel: "名前を1つ押してください"
  },
  {
    id: "member-role",
    mode: "member",
    screen: "main",
    targetId: "role-select",
    title: "手具画面を開く",
    body: "「変更」を押して、置く手具を選ぶ画面を開いてみましょう。",
    advanceOnTargetPress: true,
    targetActionLabel: "「変更」を押してください"
  },
  {
    id: "member-role-pick",
    mode: "member",
    screen: "sidebar",
    targetId: "sidebar-role-list",
    title: "置く手具を選ぶ",
    body: "手具を1つ押すと選択できます。選んだ手具が次にドリルへ置かれます。",
    advanceOnTargetPress: true,
    targetActionLabel: "手具を1つ押してください"
  },
  {
    id: "member-drill",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "ドリルに配置",
    body: "ドリルをタップして丸を置いてみましょう。チュートリアル終了時にこの練習配置は消えます。",
    advanceOnTargetPress: true,
    targetActionLabel: "ドリルをタップしてください"
  },
  {
    id: "member-zoom-buttons",
    mode: "member",
    screen: "main",
    targetId: "drill-zoom-buttons",
    title: "ボタンで拡大縮小",
    body: "＋と−でドリルシートを拡大縮小できます。ドラッグしづらい時は、まずボタンで倍率を調整します。",
    advanceOnTargetPress: true,
    targetActionLabel: "＋か−を押してください"
  },
  {
    id: "member-zoom-gesture",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "指で拡大縮小",
    body: "スマホでは二本指のピンチアウト / ピンチインでも拡大縮小できます。",
    advanceOnTargetPress: true,
    targetActionLabel: "二本指で拡大縮小してください"
  },
  {
    id: "member-drag-marker",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "丸をドラッグで移動",
    body: "置いた丸を指でドラッグすると移動できます。位置は格子に吸着します。",
    advanceOnTargetPress: true,
    targetActionLabel: "丸をドラッグしてください"
  },
  {
    id: "member-nudge-marker",
    mode: "member",
    screen: "main",
    targetId: "marker-nudge-controls",
    title: "矢印で細かく調整",
    body: "ドラッグが難しい時は、丸を選んだ状態で矢印ボタンを押して位置を調整できます。",
    advanceOnTargetPress: true,
    targetActionLabel: "矢印を1回押してください"
  },
  {
    id: "member-phase",
    mode: "member",
    screen: "main",
    targetId: "phase-tabs",
    title: "入場と退場を切り替える",
    body: "入場と退場は別々に入力します。タブを押して切り替えを試したら完了です。",
    advanceOnTargetPress: true,
    targetActionLabel: "入場 / 退場を押してください"
  },
  {
    id: "member-finished",
    mode: "member",
    screen: "main",
    title: "チュートリアル完了",
    body: "これでチュートリアルは以上です。操作方法でわからないことがあれば、画面上の？ボタンからいつでも見直せます。",
    placement: "center"
  }
];

export const adminGuideSteps: GuideStep[] = [
  {
    id: "admin-project-add",
    mode: "admin",
    screen: "projectList",
    targetId: "project-add",
    title: "プロジェクト作成",
    body: "右下の＋からプロジェクトを作成します。招待IDは自分で設定するか自動作成できます。"
  },
  {
    id: "admin-project-open",
    mode: "admin",
    screen: "projectList",
    targetId: "project-open",
    title: "プロジェクトを開く",
    body: "プロジェクトを開いて、参加者・手具・シートを管理する画面に入ってみましょう。",
    advanceOnTargetPress: true,
    targetActionLabel: "「開く」を押してください"
  },
  {
    id: "admin-participant-button",
    mode: "admin",
    screen: "main",
    targetId: "participant-manager-button",
    title: "参加者管理",
    body: "人型アイコンから参加者管理を開きます。実際に押して画面を開いてみましょう。",
    advanceOnTargetPress: true,
    targetActionLabel: "人型アイコンを押してください"
  },
  {
    id: "admin-invite",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-invite",
    title: "招待IDを共有",
    body: "招待IDや招待リンクをコピーしてメンバーに共有します。"
  },
  {
    id: "admin-participants",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-list",
    title: "参加者を整える",
    body: "参加者名、丸の中に出す文字、削除をここで管理します。削除時は確認が入ります。"
  },
  {
    id: "admin-add-participant",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-add",
    title: "参加者を追加",
    body: "新しい参加者名を入力して追加できます。"
  },
  {
    id: "admin-role-select",
    mode: "admin",
    screen: "main",
    targetId: "role-select",
    title: "手具を管理",
    body: "「変更」から手具画面を開き、手具の選択や追加を行います。実際に開いてみましょう。",
    advanceOnTargetPress: true,
    targetActionLabel: "「変更」を押してください"
  },
  {
    id: "admin-add-role",
    mode: "admin",
    screen: "sidebar",
    targetId: "sidebar-add-role",
    title: "手具を追加",
    body: "手具名、色、フォルダーを設定して追加します。自由色もここから選べます。"
  },
  {
    id: "admin-role-visibility",
    mode: "admin",
    screen: "sidebar",
    targetId: "sidebar-role-list",
    title: "表示 / 非表示を切り替える",
    body: "手具やフォルダーの目アイコンを押すと、ドリル上に表示するかどうかを切り替えられます。"
  },
  {
    id: "admin-integrated",
    mode: "admin",
    screen: "main",
    targetId: "view-mode-tabs",
    title: "統合表示",
    body: "統合表示に切り替えると、全員分の丸を重ねて確認できます。タブを押して切り替えてみましょう。",
    advanceOnTargetPress: true,
    targetActionLabel: "統合表示を押してください"
  },
  {
    id: "admin-pdf",
    mode: "admin",
    screen: "main",
    targetId: "pdf-button",
    title: "PDF出力",
    body: "PDFアイコンから印刷用の出力設定を開きます。実際に押して設定画面を見てみましょう。",
    advanceOnTargetPress: true,
    targetActionLabel: "PDFアイコンを押してください"
  },
  {
    id: "admin-pdf-options",
    mode: "admin",
    screen: "pdf",
    targetId: "pdf-target",
    title: "出力対象を選ぶ",
    body: "統合表示か参加者別、入場か退場か両方かを選んで保存します。"
  },
  {
    id: "admin-settings",
    mode: "admin",
    screen: "main",
    targetId: "project-settings-button",
    title: "プロジェクト設定",
    body: "歯車アイコンから、プロジェクト名やシートのバージョンを管理します。実際に開いてみましょう。",
    advanceOnTargetPress: true,
    targetActionLabel: "歯車アイコンを押してください"
  },
  {
    id: "admin-versions",
    mode: "admin",
    screen: "projectSettings",
    targetId: "project-settings-duplicate",
    title: "シートを更新版にする",
    body: "県大会、関東大会、全国大会のようにコピー作成してアップデートできます。不要な更新版は削除できます。"
  }
];

export const helpSections: GuideSection[] = [
  {
    id: "install",
    title: "ホーム画面に追加",
    body: [
      "iPhone / iPadはSafariで開き、共有ボタンから「ホーム画面に追加」を選びます。",
      "AndroidはChromeで開き、メニューから「ホーム画面に追加」または「アプリをインストール」を選びます。"
    ]
  },
  {
    id: "member-flow",
    title: "メンバーの基本操作",
    body: [
      "招待IDで参加し、プロジェクトを開きます。",
      "自分の名前を選び、手具を選択してドリルをタップします。",
      "丸はドラッグ、拡大縮小、矢印キーで調整できます。入場と退場の両方を入力します。"
    ]
  },
  {
    id: "admin-flow",
    title: "管理者の基本操作",
    body: [
      "プロジェクトを作成し、招待IDをメンバーに共有します。",
      "参加者、手具、統合表示、PDF出力、シートの更新版を管理します。",
      "大会ごとにシートをコピー作成すると、過去版を残しながら更新できます。"
    ]
  },
  {
    id: "faq",
    title: "困ったとき",
    body: [
      "丸を動かしづらい時は、丸を選択して下の矢印キーで調整してください。",
      "手具が見えない時は、手具画面で目アイコンが非表示になっていないか確認してください。",
      "古い画面が残る時は、ホーム画面アプリを閉じて開き直すか、Safari / Chromeで再読み込みしてください。"
    ]
  }
];

export function getGuideSteps(mode: GuideMode): GuideStep[] {
  return mode === "member" ? memberGuideSteps : adminGuideSteps;
}
