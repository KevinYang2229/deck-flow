import { create } from "zustand";
import defaultDeckMarkdown from "@/content/slides.md?raw";

export type DeckMode = "editor" | "present" | "presenter";

/** 簡報狀態介面 */
interface DeckState {
  /** Markdown 原始內容 */
  markdown: string;
  /** 目前投影片索引（從 0 開始） */
  activeIndex: number;
  /** 目前工作模式 */
  mode: DeckMode;
  /** 更新 Markdown 內容 */
  setMarkdown: (markdown: string) => void;
  /** 更新目前投影片索引 */
  setActiveIndex: (index: number) => void;
  /** 更新工作模式 */
  setMode: (mode: DeckMode) => void;
}

/** 簡報 Store */
export const useDeckStore = create<DeckState>()((set) => ({
  markdown: defaultDeckMarkdown,
  activeIndex: 0,
  mode: "editor",
  setMarkdown: (markdown) => set(() => ({ markdown })),
  setActiveIndex: (index) => set(() => ({ activeIndex: index })),
  setMode: (mode) => set(() => ({ mode })),
}));
