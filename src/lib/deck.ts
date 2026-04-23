/** 支援的投影片布局 */
export type SlideLayout =
  | "default"
  | "cover"
  | "center"
  | "intro"
  | "quote"
  | "section"
  | "statement"
  | "fact"
  | "end"
  | "full"
  | "image"
  | "image-left"
  | "image-right"
  | "two-cols"
  | "two-cols-header";

/** 左右比例定義 */
export interface SlideRatio {
  /** 左側比例（百分比） */
  left: number;
  /** 右側比例（百分比） */
  right: number;
}

/** 投影片資料結構 */
export interface DeckSlide {
  /** 投影片唯一識別 */
  id: number;
  /** 投影片主要 Markdown 內容 */
  content: string;
  /** 講者備註 */
  notes: string;
  /** 投影片標題 */
  title: string;
  /** 投影片背景圖 URL */
  background?: string;
  /** 水平對齊 */
  alignHorizontal: "left" | "center" | "right";
  /** 垂直對齊 */
  alignVertical: "top" | "middle" | "bottom";
  /** 版面配置 */
  layout: SlideLayout;
  /** 左右欄比例 */
  ratio?: SlideRatio;
}

/**
 * 將數值限制在指定範圍
 * 用於避免頁碼超出陣列邊界
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 擷取投影片標題
 * 優先使用第一個 Markdown 標題，否則退回第一行文字
 */
export function extractSlideTitle(markdown: string): string {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
  if (heading) {
    return heading.replace(/^#{1,6}\s+/, "").trim();
  }

  return lines[0] ?? "Untitled Slide";
}

/**
 * 將完整 Markdown 解析為投影片陣列
 * 使用 `---` 分隔投影片，使用 `:::notes` 區隔講者備註
 */
export function parseDeckMarkdown(markdown: string): DeckSlide[] {
  const normalized = markdown.trim();
  if (!normalized) {
    return [
      {
        id: 1,
        content: "# Empty Deck",
        notes: "",
        title: "Empty Deck",
        alignHorizontal: "left",
        alignVertical: "top",
        layout: "cover",
      },
    ];
  }

  const chunks = normalized
    .split(/\n-{3,}\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return [
      {
        id: 1,
        content: "# Empty Deck",
        notes: "",
        title: "Empty Deck",
        alignHorizontal: "left",
        alignVertical: "top",
        layout: "cover",
      },
    ];
  }

  return chunks.map((chunk, index) => {
    const parts = chunk.split(/\n:::\s*notes\s*\n/i);
    const rawContent = parts[0]?.trim() ?? "";
    const notes = parts[1]?.trim() ?? "";
    const { content, background, alignHorizontal, alignVertical, layout, ratio } = extractSlideDirectives(
      rawContent,
      index === 0 ? "cover" : "default",
    );

    return {
      id: index + 1,
      content,
      notes,
      title: extractSlideTitle(content),
      background,
      alignHorizontal,
      alignVertical,
      layout,
      ratio,
    };
  });
}

/**
 * 解析投影片頂部指令
 * 支援：
 * - `:::bg URL`
 * - `:::background URL`
 * - `:::align left|center|right top|middle|bottom`
 */
function extractSlideDirectives(content: string, defaultLayout: SlideLayout): {
  content: string;
  background?: string;
  alignHorizontal: "left" | "center" | "right";
  alignVertical: "top" | "middle" | "bottom";
  layout: SlideLayout;
  ratio?: SlideRatio;
} {
  const lines = content.split("\n");
  let background: string | undefined;
  let alignHorizontal: "left" | "center" | "right" = "left";
  let alignVertical: "top" | "middle" | "bottom" = "top";
  let layout: SlideLayout = defaultLayout;
  let ratio: SlideRatio | undefined;

  while (true) {
    const firstMeaningfulIndex = lines.findIndex((line) => line.trim().length > 0);
    if (firstMeaningfulIndex < 0) {
      break;
    }

    const firstLine = lines[firstMeaningfulIndex]!.trim();
    const backgroundMatch = firstLine.match(/^:::\s*(?:bg|background)\s+(.+)$/i);
    if (backgroundMatch) {
      background = backgroundMatch[1]?.trim() || undefined;
      lines.splice(firstMeaningfulIndex, 1);
      continue;
    }

    const alignMatch = firstLine.match(
      /^:::\s*align\s+(left|center|right)\s+(top|middle|bottom)$/i,
    );
    if (alignMatch) {
      alignHorizontal = alignMatch[1]!.toLowerCase() as "left" | "center" | "right";
      alignVertical = alignMatch[2]!.toLowerCase() as "top" | "middle" | "bottom";
      lines.splice(firstMeaningfulIndex, 1);
      continue;
    }

    const layoutMatch = firstLine.match(
      /^:::\s*layout\s+(default|cover|center|intro|quote|section|statement|fact|end|full|image|image-left|image-right|two-cols|two-cols-header)$/i,
    );
    if (layoutMatch) {
      layout = layoutMatch[1]!.toLowerCase() as SlideLayout;
      lines.splice(firstMeaningfulIndex, 1);
      continue;
    }

    const ratioMatch = firstLine.match(/^:::\s*(?:ratio|image-ratio|imageRatio)\s+(\d{1,3})\s*:\s*(\d{1,3})$/i);
    if (ratioMatch) {
      const leftRaw = Number(ratioMatch[1]);
      const rightRaw = Number(ratioMatch[2]);
      const parsed = parseRatio(leftRaw, rightRaw);
      if (parsed) {
        ratio = parsed;
      }
      lines.splice(firstMeaningfulIndex, 1);
      continue;
    }

    break;
  }

  return { content: lines.join("\n").trim(), background, alignHorizontal, alignVertical, layout, ratio };
}

/**
 * 正規化左右比例為百分比
 * 例如 35:65 -> { left: 35, right: 65 }
 */
function parseRatio(left: number, right: number): SlideRatio | undefined {
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
    return undefined;
  }

  const total = left + right;
  return {
    left: (left / total) * 100,
    right: (right / total) * 100,
  };
}
