import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 主題狀態介面 */
interface ThemeState {
  /** 當前是否為深色模式 */
  isDark: boolean;
  /** 切換深淺色主題 */
  toggle: () => void;
  /** 設定特定主題 */
  setDark: (isDark: boolean) => void;
}

/**
 * 主題 Store
 * 使用 persist middleware 將深淺色設定儲存至 localStorage
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () =>
        set((state) => {
          const next = !state.isDark;
          document.documentElement.classList.toggle("dark", next);
          return { isDark: next };
        }),
      setDark: (isDark) =>
        set(() => {
          document.documentElement.classList.toggle("dark", isDark);
          return { isDark };
        }),
    }),
    { name: "theme-storage" },
  ),
);
