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

預設內容位於 `src/content/slides.md`。每張投影片都是一段 Markdown，並可在每頁開頭加入 DeckFlow 指令控制版型、背景、對齊與比例。

### 投影片分隔

使用 `---` 分隔投影片：

```md
# 第一頁

---

# 第二頁
```

### 講者備註

使用 `:::notes` 區塊放備註（只在講者模式顯示）：

```md
# Title
:::notes
這是講者備註
```

### 頁面指令（放在每頁開頭）

頁面指令必須放在該頁最上方，可以多個並用：

```md
:::layout image-right
:::ratio 45:55
:::align left middle
:::bg https://example.com/image.jpg

## Slide Title

- 重點一
- 重點二
```

可用指令：

- `:::layout <layout-name>`：指定投影片版型
- `:::bg <url>` 或 `:::background <url>`：設定背景圖；圖文版型會用作圖片區塊
- `:::align <left|center|right> <top|middle|bottom>`：設定水平與垂直對齊
- `:::ratio 35:65`：設定左右比例，會正規化為百分比
- `:::image-ratio 35:65` 或 `:::imageRatio 35:65`：`ratio` 的別名
- `::button[文字](連結)`：在簡報中插入按鈕元件

對齊範例：

```md
:::align left top
:::align left middle
:::align left bottom
:::align center middle
:::align right middle
```

未指定時：

- 第一頁預設為 `cover`
- 其他頁預設為 `default`
- 水平對齊預設為 `left`
- 垂直對齊預設為 `middle`

### Layout 清單

支援版型：

- `default`：一般內容頁
- `cover`：封面頁
- `center`：置中內容頁
- `intro`：開場頁
- `quote`：大引言頁
- `section`：章節分隔頁
- `statement`：一句重點頁
- `fact`：數字 / 關鍵事實頁
- `end`：結尾頁
- `full`：滿版內容頁
- `title-content`：大標題 + 內容說明
- `two-cols`：左右兩欄
- `two-cols-header`：上方標題 + 下方兩欄
- `three-cols`：三欄內容
- `cards`：將清單項目排成卡片
- `image-left`：圖片左、內容右
- `image-right`：內容左、圖片右
- `image-top`：圖片上、內容下
- `image`：保留型圖片版型；目前建議優先使用 `image-left`、`image-right`、`image-top`

### 常用 Layout 範例

### 簡報元件

#### Button

在任一頁 Markdown 中加入：

```md
::button[查看範例](https://example.com)
```

沒有連結時也可以只寫：

```md
::button[開始使用]
```

按鈕可以從左側功能清單拖曳到 Markdown 撰寫區。

#### `title-content`

```md
:::layout title-content
:::align left middle

# 摘要

這裡放一段比較完整的說明文字，適合 executive summary、章節開場或決策摘要。

- 重點一
- 重點二
- 重點三
```

#### `two-cols`

使用 `::right::` 分隔左右欄：

```md
:::layout two-cols
:::ratio 45:55

## 左欄

- 問題
- 現況
- 限制

::right::

## 右欄

- 解法
- 價值
- 下一步
```

#### `two-cols-header`

使用 `::left::` 與 `::right::` 分隔頁首、左欄、右欄：

```md
:::layout two-cols-header

## 頁首內容

::left::

### 左欄

- 內容 A

::right::

### 右欄

- 內容 B
```

#### `three-cols`

使用 `::middle::` 與 `::right::` 分隔三欄：

```md
:::layout three-cols

### 01 起草

- 建立故事線

::middle::

### 02 審查

- 檢查內容差異

::right::

### 03 發表

- 播放與講者模式
```

#### `cards`

清單項目會自動排成卡片：

```md
:::layout cards

## 核心能力

- Markdown 簡報撰寫
- 版型指令
- 背景圖支援
- 講者模式
```

#### `image-left` / `image-right`

使用 `:::bg` 設定圖片，`:::ratio` 控制圖文比例：

```md
:::layout image-right
:::ratio 48:52
:::align left middle
:::bg https://example.com/product.jpg

## 產品願景

- 內容放左側
- 圖片放右側
- 適合產品介紹與案例頁
```

```md
:::layout image-left
:::ratio 46:54
:::bg https://example.com/team.jpg

## 使用情境

圖片放左側，內容放右側。
```

#### `image-top`

```md
:::layout image-top
:::bg https://example.com/workspace.jpg

## 場景頁

上方放情境圖，下方保留完整文字區。
```

### 完整頁面範例

```md
:::layout image-right
:::ratio 48:52
:::align left middle
:::bg https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1800&q=80

## 產品願景

DeckFlow 將一份 Markdown 檔案轉換成完整、穩定、可上台播放的簡報體驗。

- 作者專注在內容結構
- Runtime 負責視覺一致性
- 團隊能版本化、審查與重用投影片

:::notes
這裡放講者備註，只會在講者模式顯示。
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

目前本地執行 `npm run test`：**2 個測試檔、9 個測試皆通過**。
