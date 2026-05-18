import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PresentationButton } from "@/components/PresentationButton";
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

interface ThreeColsParts {
  /** 左欄內容 */
  left: string;
  /** 中欄內容 */
  middle: string;
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

interface ButtonDirective {
  /** 按鈕文字 */
  label: string;
  /** 按鈕連結 */
  href?: string;
}

type MarkdownSegment =
  | {
      /** 一般 Markdown 內容 */
      type: "markdown";
      /** 片段內容 */
      content: string;
    }
  | {
      /** 按鈕元件 */
      type: "button";
      /** 按鈕設定 */
      button: ButtonDirective;
    };

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
 * 解析 three-cols 內容
 * 使用 `::middle::` 與 `::right::` 分割三欄
 */
function parseThreeCols(markdown: string): ThreeColsParts {
  const [leftRaw, restRaw] = markdown.split(/\n::middle::\n/i);
  const [middleRaw, rightRaw] = (restRaw ?? "").split(/\n::right::\n/i);
  return {
    left: (leftRaw ?? "").replace(/\n::left::\n/gi, "\n").trim(),
    middle: (middleRaw ?? "").trim(),
    right: (rightRaw ?? "").trim(),
  };
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
 * 解析單行按鈕元件語法
 * 支援 `::button[文字]` 與 `::button[文字](連結)`
 */
function parseButtonDirective(line: string): ButtonDirective | undefined {
  const match = line.trim().match(/^::button\[(.+)](?:\((.+)\))?$/);
  if (!match) {
    return undefined;
  }

  return {
    label: match[1]?.trim() ?? "Button",
    href: match[2]?.trim() || undefined,
  };
}

/**
 * 將 Markdown 切成一般內容與簡報元件片段
 */
function parseMarkdownSegments(content: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const markdownBuffer: string[] = [];

  content.split("\n").forEach((line) => {
    const button = parseButtonDirective(line);
    if (!button) {
      markdownBuffer.push(line);
      return;
    }

    const markdownContent = markdownBuffer.join("\n").trim();
    if (markdownContent) {
      segments.push({ type: "markdown", content: markdownContent });
    }
    markdownBuffer.length = 0;
    segments.push({ type: "button", button });
  });

  const restContent = markdownBuffer.join("\n").trim();
  if (restContent) {
    segments.push({ type: "markdown", content: restContent });
  }

  return segments;
}

/**
 * 渲染 Markdown 區塊
 * 統一 remark 設定，避免重複
 */
function MarkdownBlock({ content }: { content: string }) {
  const segments = parseMarkdownSegments(content);
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "button") {
          return (
            <div className="slide-component-row" key={`button-${index}`}>
              <PresentationButton
                href={segment.button.href}
                label={segment.button.label}
              />
            </div>
          );
        }

        return (
          <ReactMarkdown key={`markdown-${index}`} remarkPlugins={[remarkGfm]}>
            {segment.content}
          </ReactMarkdown>
        );
      })}
    </>
  );
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

  if (layout === "three-cols") {
    const { left, middle, right } = parseThreeCols(markdown);
    return (
      <div className={className}>
        <div className="slide-three-cols">
          <div className="slide-two-cols-pane">
            <MarkdownBlock content={left} />
          </div>
          <div className="slide-two-cols-pane">
            <MarkdownBlock content={middle} />
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

  if (layout === "image-top") {
    return (
      <div className={className}>
        <div className="slide-layout-image-shell slide-layout-image-shell-top">
          <div className="slide-layout-image-pane" style={{ backgroundImage: background ? `url("${background}")` : undefined }} />
          <div className="slide-layout-image-content">
            <MarkdownBlock content={markdown} />
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
