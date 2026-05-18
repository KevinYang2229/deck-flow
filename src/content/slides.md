:::bg https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1800&q=80

# DeckFlow

為技術團隊打造的 Markdown 優先簡報 Runtime

- 用純文字維護簡報內容
- 用 React 呈現專業播放體驗
- 用版本控制管理每一次簡報變更

:::notes
開場先定義 DeckFlow：它不是另一個投影片編輯器，而是讓技術團隊把簡報納入日常開發流程的 runtime。

---

:::layout title-content
:::align left middle

# 摘要

DeckFlow 讓團隊用 Markdown 建立、審查、播放與維護簡報。它把簡報從「難以追蹤的二進位檔」轉成「可以審查、可以自動化、可以長期維護的內容資產」。

- 適合技術分享、產品展示、內部簡報與專案報告
- 支援版型指令、背景圖、講者備註與播放模式
- 未來可延伸到匯出、協作、AI 生成與文件同步

:::notes
這頁給主管或決策者快速理解價值：省時間、降低維護成本，讓內容可以被工程流程管理。

---

:::layout quote
:::align left middle

> 技術簡報應該和它所說明的軟體一樣，能被維護、審查與重用。

:::notes
用一句話建立觀點：技術簡報本質上也是產品文件，應該能被維護、審查與重用。

---

:::layout two-cols
:::ratio 45:55
:::align left middle

## 現有痛點

- 投影片檔案難以比較差異與審查
- 技術內容經常和文件、程式碼不同步
- 複製既有簡報會累積過時資訊
- 團隊很難建立一致的簡報風格
- 分享前最後一刻才發現格式跑掉

::right::

## 為什麼重要

- 簡報是對外溝通與內部決策的重要介面
- 技術團隊需要快速、準確、可追溯的內容流程
- 內容越常更新，傳統簡報工具的維護成本越高
- 沒有穩定格式，講者會把時間花在排版而不是思考

:::notes
左右欄先說痛點，再說為什麼這個痛點值得解。這裡不要急著講功能，先讓觀眾認同問題。

---

:::layout image-right
:::ratio 48:52
:::align left middle
:::bg https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1800&q=80

## 產品願景

DeckFlow 將一份 Markdown 檔案轉換成完整、穩定、可上台播放的簡報體驗。

- 作者專注在內容結構
- Runtime 負責視覺一致性
- 團隊能版本化、審查與重用投影片
- 講者能使用全螢幕與講者模式

:::notes
這頁用 image-right 讓視覺更像正式產品簡報。核心訊息是：輸入是 Markdown，輸出是可上台的簡報。

---

:::layout cards
:::align left middle

## 核心能力

- Markdown 簡報撰寫
- 版型指令
- 背景圖支援
- 自訂欄位比例
- 講者備註
- 講者模式
- 全螢幕播放
- 多視窗同步

:::notes
cards layout 適合快速掃描功能集合。不要逐項講太久，只要建立能力地圖。

---

:::layout section
:::align center middle

# 撰寫模型

語法簡單，結構穩定，輸出專業。

:::notes
進入產品機制說明。這裡是章節轉場。

---

:::layout image-left
:::ratio 46:54
:::align left middle
:::bg https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1800&q=80

## 像寫文件一樣寫簡報

每張投影片都由 Markdown 區塊組成。你可以先寫出敘事，再逐步加入版型、背景圖、比例與備註。

- `---` 分隔投影片
- `:::layout` 選擇版型
- `:::align` 控制位置
- `:::notes` 保存講者提示

:::notes
強調漸進式使用：使用者不必一開始就學完整語法，可以先寫 Markdown，再慢慢加指令。

---

## Markdown 指令範例

```md
:::layout image-right
:::ratio 48:52
:::align left middle
:::bg https://example.com/team.jpg

## 產品願景

- 用 Markdown 撰寫
- 用 React 播放
- 用 Git 版本管理

:::notes
說明產品工作流程。
```

這種格式可以直接被 Git 追蹤，也能被 AI、腳本或文件系統產生。

:::notes
這頁展示具體語法，讓觀眾知道整套系統沒有黑盒，都是簡單可讀的文字。

---

:::layout three-cols
:::align left middle

### 01 起草

- 快速寫出故事線
- 先整理結論與證據
- 用備註保存講者思路

::middle::

### 02 審查

- 用 Pull Request 檢查內容
- 比對每次修改差異
- 讓設計與工程共同維護

::right::

### 03 發表

- 播放模式上台展示
- 講者模式輔助節奏
- 多視窗同步頁碼

:::notes
三欄說明工作流程，讓產品價值從功能轉為實際使用流程。

---

:::layout title-content
:::align left middle

# 為可重複溝通而設計

DeckFlow 的價值不只在建立一份簡報，而是在建立一套可重複使用的溝通流程。當內容變動頻繁，穩定的結構比手工排版更重要。

- 產品週會：快速整理進度與決策
- 技術分享：保留程式碼、架構與講者脈絡
- 客戶簡報：用一致版型呈現不同客戶內容
- 專案回顧：把過程、數據、結論留在版本歷史

:::notes
這頁把使用者情境講清楚，讓觀眾知道它不只適用單一 demo。

---

:::layout image-top
:::align left middle
:::bg https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80

## 使用情境：產品 Review

產品團隊每週需要同步進度、風險與下一步。DeckFlow 可以把 review deck 變成專案 repo 的一部分，讓每次會議留下可追蹤紀錄。

- PM 更新產品脈絡與決策
- Designer 補充使用者情境與畫面
- Engineer 維護技術限制與交付狀態

:::notes
image-top 用來講案例。這頁的重點是讓觀眾想像真實會議使用方式。

---

:::layout two-cols
:::ratio 50:50
:::align left middle

## 導入前

- 簡報內容散落在個人檔案
- 最終版本靠檔名辨識
- 內容審查缺乏標準流程
- 重複簡報需要大量手動整理

::right::

## 導入後

- 單一 Markdown 作為內容來源
- Git history 記錄所有調整
- Layout 保持一致視覺品質
- 範本可以快速產生新簡報

:::notes
這頁直接對比 adoption 前後，適合產品說服或內部導入討論。

---

:::layout fact
:::align left middle

# 單一來源

一份 Markdown 同時支援編輯、預覽、播放與講者備註。

:::notes
fact layout 用單一關鍵數字或概念打穿記憶點。這裡強調 single source of truth。

---

:::layout section
:::align center middle

# 產品路線圖

從本機撰寫，走向團隊規模的簡報工作流。

:::notes
進入 roadmap 章節。

---

:::layout cards
:::align left middle

## 規劃中的能力

- 匯出 PDF
- Mermaid 圖表
- 主題預設
- 投影片範本
- AI 草稿生成
- 可重用元件
- 雲端協作
- 內容分析

:::notes
這頁讓產品看起來有延展性，也能讓觀眾想像後續投資方向。

---

:::layout three-cols
:::align left middle

### 近期

- 穩定版型系統
- 改善匯出流程
- 補齊範本庫

::middle::

### 中期

- 加入圖表與資料元件
- 支援主題切換
- 建立團隊共享範本

::right::

### 長期

- AI 輔助產生草稿
- 雲端協作與評論
- 簡報內容分析

:::notes
用三欄分期 roadmap。這頁適合和投資、產品規劃或內部優先順序討論連接。

---

:::layout statement
:::align left middle

## DeckFlow 讓團隊少花時間排版，多花時間把訊息講清楚。

:::notes
statement layout 適合收束產品價值。可以放慢語速，讓觀眾記住核心承諾。

---

:::layout end
:::align center middle

# 謝謝

用團隊已經信任的工作流程，打造更清楚、更可維護的簡報。

:::notes
結尾接 QA、demo 或導入討論。
