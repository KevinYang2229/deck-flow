import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SlideLayout, SlideRatio } from "@/lib/deck";

interface SlideMarkdownProps {
  /** 需要渲染的 Markdown */
  markdown: string;
  /** 文字縮放級別 */
  compact?: boolean;
  /** 水平對齊模式 */
  alignHorizontal?: "left" | "center" | "right";
  /** 版面配置 */
  layout?: SlideLayout;
  /** 背景圖片 URL（供 image-left/right/image 使用） */
  background?: string;
  /** 左右欄比例（百分比） */
  ratio?: SlideRatio;
}

interface TwoColsParts {
  /** 左欄內容 */
  left: string;
  /** 右欄內容 */
  right: string;
}

interface TwoColsHeaderParts {
  /** 頁首內容 */
  header: string;
  /** 左欄內容 */
  left: string;
  /** 右欄內容 */
  right: string;
}

/**
 * 解析 two-cols 內容
 * 使用 `::right::` 分割左右欄
 */
function parseTwoCols(markdown: string): TwoColsParts {
  const [leftRaw, rightRaw] = markdown.split(/\n::right::\n/i);
  const left = (leftRaw ?? "").replace(/\n::left::\n/gi, "\n").trim();
  const right = (rightRaw ?? "").trim();
  return { left, right };
}

/**
 * 解析 two-cols-header 內容
 * 使用 `::left::` 與 `::right::` 分割區塊
 */
function parseTwoColsHeader(markdown: string): TwoColsHeaderParts {
  const [headerRaw, bodyRaw] = markdown.split(/\n::left::\n/i);
  const [leftRaw, rightRaw] = (bodyRaw ?? "").split(/\n::right::\n/i);
  return {
    header: (headerRaw ?? "").trim(),
    left: (leftRaw ?? "").trim(),
    right: (rightRaw ?? "").trim(),
  };
}

/**
 * 渲染 Markdown 區塊
 * 統一 remark 設定，避免重複
 */
function MarkdownBlock({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}

/**
 * Markdown 投影片渲染器
 * 負責將投影片內容渲染為可閱讀畫面
 */
export function SlideMarkdown({
  markdown,
  compact = false,
  alignHorizontal = "left",
  layout = "default",
  background,
  ratio,
}: SlideMarkdownProps) {
  const className = [
    "slide-markdown",
    compact ? "slide-markdown-compact" : "",
    alignHorizontal === "center" ? "slide-markdown-align-center" : "",
    alignHorizontal === "right" ? "slide-markdown-align-right" : "",
    `slide-layout-${layout}`,
  ]
    .filter(Boolean)
    .join(" ");

  if (layout === "two-cols") {
    const { left, right } = parseTwoCols(markdown);
    return (
      <div className={className}>
        <div
          className="slide-two-cols"
          style={ratio ? { gridTemplateColumns: `${ratio.left}% ${ratio.right}%` } : undefined}
        >
          <div className="slide-two-cols-pane">
            <MarkdownBlock content={left} />
          </div>
          <div className="slide-two-cols-pane">
            <MarkdownBlock content={right} />
          </div>
        </div>
      </div>
    );
  }

  if (layout === "two-cols-header") {
    const { header, left, right } = parseTwoColsHeader(markdown);
    return (
      <div className={className}>
        <div className="slide-two-cols-header">
          <div className="slide-two-cols-header-top">
            <MarkdownBlock content={header} />
          </div>
          <div
            className="slide-two-cols-header-bottom"
            style={ratio ? { gridTemplateColumns: `${ratio.left}% ${ratio.right}%` } : undefined}
          >
            <div className="slide-two-cols-pane">
              <MarkdownBlock content={left} />
            </div>
            <div className="slide-two-cols-pane">
              <MarkdownBlock content={right} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (layout === "image-left" || layout === "image-right") {
    const media = (
      <div className="slide-layout-image-pane" style={{ backgroundImage: background ? `url("${background}")` : undefined }} />
    );
    const content = (
      <div className="slide-layout-image-content">
        <MarkdownBlock content={markdown} />
      </div>
    );

    return (
      <div className={className}>
        <div
          className="slide-layout-image-shell"
          style={ratio ? { gridTemplateColumns: `${ratio.left}% ${ratio.right}%` } : undefined}
        >
          {layout === "image-left" ? (
            <>
              {media}
              {content}
            </>
          ) : (
            <>
              {content}
              {media}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <MarkdownBlock content={markdown} />
    </div>
  );
}
