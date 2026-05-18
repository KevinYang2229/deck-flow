import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme";

interface IntroFeature {
  /** 功能名稱 */
  title: string;
  /** 功能描述 */
  description: string;
  /** 分類標籤 */
  badge: string;
}

const introFeatures: IntroFeature[] = [
  {
    title: "Markdown-driven Deck",
    description: "使用 `---` 切分投影片，快速建立技術簡報內容。",
    badge: "內容編排",
  },
  {
    title: "拖曳 / 點擊插入工具",
    description: "版型、指令、元件可分區收合，點擊或拖曳到編輯區插入，並自動全選範本佔位字方便覆寫。",
    badge: "編輯效率",
  },
  {
    title: "版型 = 新投影片",
    description: "插入版型一律建立為當前頁的下一張，不會切碎既有內容；:::notes 重複插入自動附加到既有區塊。",
    badge: "內容守護",
  },
  {
    title: "三欄講者模式",
    description: "目前投影片 / 縮圖導覽 / 下一張預覽 + 講者備註 + 計時器分欄呈現，鍵盤切頁自動同步縮圖。",
    badge: "講者工具",
  },
  {
    title: "倒數計時與警示",
    description: "計時器 / 倒數頁籤切換；剩 5 分鐘琥珀色提示、剩 1 分鐘紅色 pulse + 嗶聲，幫助掌握收尾節奏。",
    badge: "節奏掌控",
  },
  {
    title: "Live Rendering",
    description: "編輯 Markdown 後即時看到投影片渲染結果，含多欄、背景圖、按鈕等版型指令。",
    badge: "即時預覽",
  },
  {
    title: "Keyboard-first",
    description: "方向鍵、空白鍵切頁，Esc 回編輯模式，F 切全螢幕，並自動將縮圖鄰近項目帶入視野。",
    badge: "操作效率",
  },
  {
    title: "跨視窗同步（內容感知）",
    description: "BroadcastChannel 同步頁碼，僅在 markdown 一致的視窗間互通，避免被不同檔案 clamp 拉扯。",
    badge: "多視窗",
  },
  {
    title: "File Workflow",
    description: "可開啟、儲存、另存真實 `.md` 檔案，支援還原為專案預設內容。",
    badge: "檔案整合",
  },
  {
    title: "Theme Toggle",
    description: "內建亮暗主題切換，適配不同展示場景。",
    badge: "視覺體驗",
  },
];

export const Route = createFileRoute("/intro")({
  component: IntroPage,
});

/** 介紹頁面 */
function IntroPage() {
  const isDark = useThemeStore((state) => state.isDark);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const setDark = useThemeStore((state) => state.setDark);

  /** 同步主題 class，避免重整後不一致 */
  useEffect(() => {
    setDark(isDark);
  }, [isDark, setDark]);

  return (
    <div className="hero-glow min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="title-font rounded-lg bg-[var(--color-primary)] px-3 py-1 text-xs font-bold tracking-widest text-white">
              DECKFLOW
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">Product Overview</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="mode-pill" onClick={toggleTheme}>
              {isDark ? "亮色" : "暗色"}
            </button>
            <Link to="/" className="mode-pill mode-pill-active">
              回簡報工具
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <p className="mb-3 inline-flex rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
          Slidev-inspired React Version
        </p>
        <h1 className="title-font text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          DeckFlow 介紹頁
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
          這個路由保留你先前提到的「介紹頁」用途，聚焦產品定位與功能摘要。實際可編輯與播放簡報請使用
          首頁工具模式。
        </p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {introFeatures.map((feature) => (
            <article key={feature.title} className="glass-card rounded-2xl p-5">
              <p className="mb-3 inline-flex rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                {feature.badge}
              </p>
              <h2 className="title-font mb-2 text-lg font-bold">{feature.title}</h2>
              <p className="text-sm leading-6 text-[var(--color-text-muted)]">{feature.description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
