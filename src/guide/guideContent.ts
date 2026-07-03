export type GuideMode = "member" | "admin";

export type GuideScreen =
  | "projectList"
  | "main"
  | "participantManager"
  | "sidebar"
  | "projectSettings"
  | "pdf";

export type GuidePlacement = "top" | "bottom" | "center" | "screen-top" | "screen-bottom";

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
  | "marker-step-toggle"
  | "marker-nudge-controls"
  | "sidebar-role-list"
  | "sidebar-role-visibility"
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
    body: "SafariやChromeからホーム画面に追加できます。",
    placement: "center"
  },
  {
    id: "member-project-add",
    mode: "member",
    screen: "projectList",
    targetId: "project-add",
    title: "プロジェクトに参加",
    body: "右下の＋を押します。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "＋を押してください"
  },
  {
    id: "member-project-action-mode",
    mode: "member",
    screen: "projectList",
    targetId: "project-action-mode",
    title: "招待IDで参加を選ぶ",
    body: "今回は「参加」を選びます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "「参加」を押してください"
  },
  {
    id: "member-project-join-input",
    mode: "member",
    screen: "projectList",
    targetId: "project-join-invite-input",
    title: "招待IDを入力",
    body: "YRCG2025 と入力します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "YRCG2025 と入力してください"
  },
  {
    id: "member-project-join-submit",
    mode: "member",
    screen: "projectList",
    targetId: "project-join-submit",
    title: "プロジェクトに参加",
    body: "参加を押して開きます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "「参加」を押してください"
  },
  {
    id: "member-participant",
    mode: "member",
    screen: "main",
    targetId: "participant-list",
    title: "自分の名前を選ぶ",
    body: "自分の名前を押します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "名前を1つ押してください"
  },
  {
    id: "member-role",
    mode: "member",
    screen: "main",
    targetId: "role-select",
    title: "手具画面を開く",
    body: "「変更」で手具を選びます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "「変更」を押してください"
  },
  {
    id: "member-role-pick",
    mode: "member",
    screen: "sidebar",
    targetId: "sidebar-role-list",
    title: "置く手具を選ぶ",
    body: "手具を1つ押します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "手具を1つ押してください"
  },
  {
    id: "member-drill",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "ドリルに配置",
    body: "ドリルをタップして丸を置きます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "ドリルをタップしてください"
  },
  {
    id: "member-zoom-buttons",
    mode: "member",
    screen: "main",
    targetId: "drill-zoom-buttons",
    title: "ボタンで拡大縮小",
    body: "＋と−で大きさを変えます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "＋か−を押してください"
  },
  {
    id: "member-zoom-gesture",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "指で拡大縮小",
    body: "二本指でも大きさを変えられます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "二本指で拡大縮小してください"
  },
  {
    id: "member-drag-marker",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "丸をドラッグで移動",
    body: "丸を指で動かします。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "丸をドラッグしてください"
  },
  {
    id: "member-nudge-marker",
    mode: "member",
    screen: "main",
    targetId: "marker-nudge-controls",
    title: "矢印で細かく調整",
    body: "ドリルを見ながら矢印で動かします。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "矢印を1回押してください"
  },
  {
    id: "member-step-toggle",
    mode: "member",
    screen: "main",
    targetId: "marker-step-toggle",
    title: "0.5歩に切り替える",
    body: "細かく動かしたい時は0.5歩にできます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "1歩 / 0.5歩を押してください"
  },
  {
    id: "member-phase",
    mode: "member",
    screen: "main",
    targetId: "phase-tabs",
    title: "入場と退場を切り替える",
    body: "入場と退場を切り替えます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "入場 / 退場を押してください"
  },
  {
    id: "member-finished",
    mode: "member",
    screen: "main",
    targetId: "main-help",
    title: "チュートリアル完了",
    body: "迷ったら上の？ボタンから見直せます。",
    placement: "bottom"
  }
];

export const adminGuideSteps: GuideStep[] = [
  {
    id: "admin-project-add",
    mode: "admin",
    screen: "projectList",
    targetId: "project-add",
    title: "プロジェクト作成",
    body: "右下の＋から作成します。",
    placement: "top"
  },
  {
    id: "admin-project-open",
    mode: "admin",
    screen: "projectList",
    targetId: "project-open",
    title: "プロジェクトを開く",
    body: "プロジェクトを開きます。",
    placement: "screen-bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "「開く」を押してください"
  },
  {
    id: "admin-participant-button",
    mode: "admin",
    screen: "main",
    targetId: "participant-manager-button",
    title: "参加者管理",
    body: "人型アイコンを押します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "人型アイコンを押してください"
  },
  {
    id: "admin-invite",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-invite",
    title: "招待IDを共有",
    body: "招待IDをコピーして共有します。",
    placement: "bottom"
  },
  {
    id: "admin-participants",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-list",
    title: "参加者を整える",
    body: "名前、丸の文字、削除を管理します。",
    placement: "bottom"
  },
  {
    id: "admin-add-participant",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-add",
    title: "参加者を追加",
    body: "名前を入力して追加します。",
    placement: "screen-top"
  },
  {
    id: "admin-role-select",
    mode: "admin",
    screen: "main",
    targetId: "role-select",
    title: "手具を管理",
    body: "「変更」で手具画面を開きます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "「変更」を押してください"
  },
  {
    id: "admin-add-role",
    mode: "admin",
    screen: "sidebar",
    targetId: "sidebar-add-role",
    title: "手具を追加",
    body: "名前、色、フォルダーを設定します。",
    placement: "screen-top"
  },
  {
    id: "admin-role-visibility",
    mode: "admin",
    screen: "sidebar",
    targetId: "sidebar-role-visibility",
    title: "表示 / 非表示を切り替える",
    body: "目アイコンで表示を切り替えます。",
    placement: "bottom"
  },
  {
    id: "admin-integrated",
    mode: "admin",
    screen: "main",
    targetId: "view-mode-tabs",
    title: "統合表示",
    body: "全員分を重ねて見ます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "統合表示を押してください"
  },
  {
    id: "admin-pdf",
    mode: "admin",
    screen: "main",
    targetId: "pdf-button",
    title: "PDF出力",
    body: "PDF設定を開きます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "PDFアイコンを押してください"
  },
  {
    id: "admin-pdf-options",
    mode: "admin",
    screen: "pdf",
    targetId: "pdf-target",
    title: "出力対象を選ぶ",
    body: "誰のシートを出すか選びます。",
    placement: "bottom"
  },
  {
    id: "admin-settings",
    mode: "admin",
    screen: "main",
    targetId: "project-settings-button",
    title: "プロジェクト設定",
    body: "歯車アイコンを押します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "歯車アイコンを押してください"
  },
  {
    id: "admin-versions",
    mode: "admin",
    screen: "projectSettings",
    targetId: "project-settings-duplicate",
    title: "シートを更新版にする",
    body: "大会ごとにコピーして更新できます。",
    placement: "bottom"
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
