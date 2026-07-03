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
    body: "追加メニューを開きます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "＋をタップ"
  },
  {
    id: "member-project-action-mode",
    mode: "member",
    screen: "projectList",
    targetId: "project-action-mode",
    title: "参加方法",
    body: "招待IDで入ります。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "参加をタップ"
  },
  {
    id: "member-project-join-input",
    mode: "member",
    screen: "projectList",
    targetId: "project-join-invite-input",
    title: "招待ID",
    body: "サンプルIDを入力します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "YRCG2025 と入力"
  },
  {
    id: "member-project-join-submit",
    mode: "member",
    screen: "projectList",
    targetId: "project-join-submit",
    title: "参加する",
    body: "入力したIDで開きます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "参加をタップ"
  },
  {
    id: "member-participant",
    mode: "member",
    screen: "main",
    targetId: "participant-list",
    title: "名前を選ぶ",
    body: "自分のシートに切り替えます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "自分の名前をタップ"
  },
  {
    id: "member-role",
    mode: "member",
    screen: "main",
    targetId: "role-select",
    title: "手具を選ぶ",
    body: "手具リストを開きます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "変更をタップ"
  },
  {
    id: "member-role-pick",
    mode: "member",
    screen: "sidebar",
    targetId: "sidebar-role-list",
    title: "置く手具を選ぶ",
    body: "置きたい手具にします。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "手具をタップ"
  },
  {
    id: "member-drill",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "配置する",
    body: "ドリル上に丸を置きます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "ドリルをタップ"
  },
  {
    id: "member-zoom-buttons",
    mode: "member",
    screen: "main",
    targetId: "drill-zoom-buttons",
    title: "ボタンで拡大縮小",
    body: "ボタンでも大きさを変えられます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "＋または−をタップ"
  },
  {
    id: "member-zoom-gesture",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "二本指で拡大縮小",
    body: "指でも大きさを変えられます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "二本指で操作"
  },
  {
    id: "member-drag-marker",
    mode: "member",
    screen: "main",
    targetId: "drill-canvas",
    title: "丸を動かす",
    body: "置いた丸はドラッグできます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "丸をドラッグ"
  },
  {
    id: "member-nudge-marker",
    mode: "member",
    screen: "main",
    targetId: "marker-nudge-controls",
    title: "矢印で調整",
    body: "細かい位置合わせに使います。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "矢印を1回タップ"
  },
  {
    id: "member-step-toggle",
    mode: "member",
    screen: "main",
    targetId: "marker-step-toggle",
    title: "移動幅を変える",
    body: "0.5歩にするとさらに細かく動きます。",
    placement: "top",
    advanceOnTargetPress: true,
    targetActionLabel: "1歩 / 0.5歩をタップ"
  },
  {
    id: "member-phase",
    mode: "member",
    screen: "main",
    targetId: "phase-tabs",
    title: "入場と退場を切り替える",
    body: "両方のシートを入力します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "入場 / 退場をタップ"
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
    body: "追加メニューから作成できます。",
    placement: "top"
  },
  {
    id: "admin-project-open",
    mode: "admin",
    screen: "projectList",
    targetId: "project-open",
    title: "プロジェクトを開く",
    body: "管理するプロジェクトに入ります。",
    placement: "screen-bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "開くをタップ"
  },
  {
    id: "admin-participant-button",
    mode: "admin",
    screen: "main",
    targetId: "participant-manager-button",
    title: "参加者管理",
    body: "参加者画面を開きます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "人型アイコンをタップ"
  },
  {
    id: "admin-invite",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-invite",
    title: "招待IDを共有",
    body: "IDを共有するとメンバーが参加できます。",
    placement: "bottom"
  },
  {
    id: "admin-participants",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-list",
    title: "参加者を整える",
    body: "名前、丸の文字、削除をここで管理します。",
    placement: "bottom"
  },
  {
    id: "admin-add-participant",
    mode: "admin",
    screen: "participantManager",
    targetId: "participant-manager-add",
    title: "参加者を追加",
    body: "下の欄から増やせます。",
    placement: "screen-top"
  },
  {
    id: "admin-role-select",
    mode: "admin",
    screen: "main",
    targetId: "role-select",
    title: "手具管理",
    body: "手具リストを開きます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "変更をタップ"
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
    title: "表示切替",
    body: "目アイコンで出す / 隠すを変えます。",
    placement: "bottom"
  },
  {
    id: "admin-integrated",
    mode: "admin",
    screen: "main",
    targetId: "view-mode-tabs",
    title: "統合表示",
    body: "全員の配置を重ねて確認します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "統合表示をタップ"
  },
  {
    id: "admin-pdf",
    mode: "admin",
    screen: "main",
    targetId: "pdf-button",
    title: "PDF出力",
    body: "印刷や保存の設定に進みます。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "PDFアイコンをタップ"
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
    body: "シートやプロジェクト名を管理します。",
    placement: "bottom",
    advanceOnTargetPress: true,
    targetActionLabel: "歯車をタップ"
  },
  {
    id: "admin-versions",
    mode: "admin",
    screen: "projectSettings",
    targetId: "project-settings-duplicate",
    title: "シートを更新版にする",
    body: "大会ごとにシートをコピーできます。",
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
