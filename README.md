# DeckFlow React

DeckFlow React 是一個以 **Markdown 為核心** 的簡報工具，支援編輯、播放、講者三種模式，適合技術分享與內部提案快速製作投影片。

## 功能特色

- Markdown 即時渲染：用 `---` 分頁，編輯後立即看到投影片結果。
- 三種模式：
  - `editor`：編輯器 + 預覽 + 縮圖導覽
  - `present`：全畫面播放
  - `presenter`：目前頁、下一頁、講者備註、計時器
- 快捷鍵操作：`ArrowLeft`、`ArrowRight`、`Space`、`Esc`
- 跨視窗同步：透過 `BroadcastChannel` 同步頁碼
- 主題切換：亮色 / 暗色，並保留使用者偏好
- 檔案工作流：
  - 開啟本機 Markdown
  - 儲存回原檔
  - 另存新檔
  - 不支援 File System Access API 時自動改用下載
- 進階版型與語法：`layout`、`bg`、`align`、`ratio`、`notes`

## 技術棧

- React 19 + TypeScript
- Vite 6
- TanStack Router（檔案式路由）
- TanStack Query
- Zustand（含 persist）
- Tailwind CSS v4
- React Markdown + remark-gfm
- Vitest + Testing Library
- Playwright（E2E）

## 快速開始

```bash
npm install
npm run dev
```

預設開啟：[http://localhost:5173](http://localhost:5173)

## 可用指令

```bash
npm run dev            # 啟動開發伺服器
npm run build          # TypeScript build + Vite build
npm run preview        # 預覽 production build
npm run lint           # ESLint
npm run format         # Prettier（只格式化 src）
npm run test           # Vitest（單次）
npm run test:watch     # Vitest watch
npm run test:coverage  # Vitest coverage
npm run e2e            # Playwright E2E
npm run e2e:ui         # Playwright UI mode
```

## Markdown 語法約定

### 投影片分隔

使用 `---` 分隔投影片。

### 講者備註

使用 `:::notes` 區塊放備註（只在講者模式顯示）：

```md
# Title
:::notes
這是講者備註
```

### 頁面指令（放在每頁開頭）

- `:::bg <url>` 或 `:::background <url>`：背景圖
- `:::align <left|center|right> <top|middle|bottom>`：文字對齊
- `:::layout <layout-name>`：版型
- `:::ratio 35:65`：左右比例（給雙欄 / 圖文版型）

支援版型：

- `default`
- `cover`
- `center`
- `intro`
- `quote`
- `section`
- `statement`
- `fact`
- `end`
- `full`
- `image`
- `image-left`
- `image-right`
- `two-cols`
- `two-cols-header`

### 雙欄分隔語法

`two-cols`：

```md
:::layout two-cols
左欄內容
::right::
右欄內容
```

`two-cols-header`：

```md
:::layout two-cols-header
頁首內容
::left::
左欄內容
::right::
右欄內容
```

## 路由

- `/`：簡報工作區（DeckStudio）
- `/intro`：產品介紹頁

可透過 query string 指定模式：

- `/?mode=editor`
- `/?mode=present`
- `/?mode=presenter`

## 專案結構

```text
src/
  components/
    DeckStudio.tsx
    SlideMarkdown.tsx
  content/
    slides.md
  lib/
    deck.ts
    fileAccess.ts
  routes/
    __root.tsx
    index.tsx
    intro.tsx
  stores/
    deck.ts
    theme.ts
```

## 測試狀態

目前已包含：

- `src/lib/__tests__/deck.test.ts`（解析器邏輯）
- `src/components/__tests__/DeckStudio.test.tsx`（模式切換）

在 `2026-04-23` 本地執行 `npm run test`：**2 個測試檔、8 個測試皆通過**。
