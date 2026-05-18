import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react';
import { Link } from '@tanstack/react-router';
import { SlideMarkdown } from '@/components/SlideMarkdown';
import { clamp, parseDeckMarkdown } from '@/lib/deck';
import defaultDeckMarkdown from '@/content/slides.md?raw';
import {
  downloadMarkdown,
  isFsApiSupported,
  openMarkdownFile,
  saveAsMarkdownFile,
  saveToExistingFile,
  type FileHandleLike,
} from '@/lib/fileAccess';
import type { SlideLayout } from '@/lib/deck';
import { type DeckMode, useDeckStore } from '@/stores/deck';
import { useThemeStore } from '@/stores/theme';

/**
 * 將秒數格式化成 `mm:ss`
 * 用於講者模式計時器顯示
 */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * 判斷版型是否使用獨立圖片區塊
 * 用於停用背景遮罩並移除投影片內距
 */
function isImagePanelLayout(layout: SlideLayout | undefined): boolean {
  return (
    layout === 'image-left' ||
    layout === 'image-right' ||
    layout === 'image-top'
  );
}

interface LayoutTemplate {
  /** 顯示名稱 */
  label: string;
  /** 插入編輯器的 Markdown 範本 */
  markdown: string;
}

interface MarkdownTool extends LayoutTemplate {
  /** 工具分類 */
  group: '版型' | '指令' | '元件';
  /** 插入後預先選取的字串，方便使用者立即覆寫 */
  placeholder?: string;
}

type VerticalAlignment = 'top' | 'middle' | 'bottom';

interface VerticalAlignmentOption {
  /** 顯示名稱 */
  label: string;
  /** 垂直對齊值 */
  value: VerticalAlignment;
}

const markdownTools: MarkdownTool[] = [
  {
    label: '標題內容',
    group: '版型',
    markdown: ':::layout title-content\n\n## 標題\n\n補充說明文字\n',
    placeholder: '標題',
  },
  {
    label: '三欄',
    group: '版型',
    markdown:
      ':::layout three-cols\n\n### 左欄\n\n- 重點一\n\n::middle::\n\n### 中欄\n\n- 重點二\n\n::right::\n\n### 右欄\n\n- 重點三\n',
    placeholder: '左欄',
  },
  {
    label: '卡片',
    group: '版型',
    markdown:
      ':::layout cards\n\n## 卡片清單\n\n- 第一個項目\n- 第二個項目\n- 第三個項目\n',
    placeholder: '卡片清單',
  },
  {
    label: '上圖下文',
    group: '版型',
    markdown:
      ':::layout image-top\n:::bg https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1400&q=80\n\n## 上圖下文\n\n這裡放主要內容。\n',
    placeholder:
      'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: '背景圖',
    group: '指令',
    markdown: ':::bg https://example.com/image.jpg\n',
    placeholder: 'https://example.com/image.jpg',
  },
  {
    label: '比例',
    group: '指令',
    markdown: ':::ratio 45:55\n',
    placeholder: '45:55',
  },
  {
    label: '講者備註',
    group: '指令',
    markdown: '\n:::notes\n這裡放講者備註。\n',
    placeholder: '這裡放講者備註。',
  },
  {
    label: '按鈕',
    group: '元件',
    markdown: '::button[了解更多](https://example.com)\n',
    placeholder: '了解更多',
  },
];

const verticalAlignmentOptions: VerticalAlignmentOption[] = [
  { label: '靠上', value: 'top' },
  { label: '置中', value: 'middle' },
  { label: '靠下', value: 'bottom' },
];

/**
 * 取得指定投影片第一個標題在 Markdown 原文中的位置
 * 找不到標題時退回該投影片起始位置
 */
function getSlideMarkdownOffset(markdown: string, slideIndex: number): number {
  const separatorPattern = /\n-{3,}\n/g;
  let slideStart = 0;
  let slideEnd = markdown.length;
  let currentIndex = 0;
  let match = separatorPattern.exec(markdown);

  while (match) {
    if (currentIndex === slideIndex) {
      slideEnd = match.index;
      break;
    }
    currentIndex += 1;
    slideStart = match.index + match[0].length;
    match = separatorPattern.exec(markdown);
  }

  const slideMarkdown = markdown.slice(slideStart, slideEnd);
  const headingMatch = /^#{1,6}\s+/m.exec(slideMarkdown);
  if (!headingMatch) {
    return slideStart;
  }

  return slideStart + headingMatch.index;
}

/**
 * 取得指定位置所在行的結尾位置
 * 用於定位後選取整行標題，讓目前游標位置更明顯
 */
function getLineEndOffset(markdown: string, offset: number): number {
  const lineEnd = markdown.indexOf('\n', offset);
  return lineEnd === -1 ? markdown.length : lineEnd;
}

/**
 * 取得指定行在文字中的起始 offset
 * 用於拖曳工具到指定列時插入內容
 */
function getLineStartOffset(text: string, lineIndex: number): number {
  if (lineIndex <= 0) {
    return 0;
  }

  let currentLine = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '\n') {
      continue;
    }
    currentLine += 1;
    if (currentLine === lineIndex) {
      return index + 1;
    }
  }

  return text.length;
}

/**
 * 若插入內容為 :::notes 區塊且當前投影片已有備註，
 * 改為附加一行到既有備註區塊尾端，避免產生重複的 :::notes
 */
function resolveNotesAppending(
  value: string,
  insertPos: number,
  snippet: string,
  placeholder?: string,
): { insertPos: number; snippet: string; placeholder?: string } | null {
  if (!/:::\s*notes/i.test(snippet)) {
    return null;
  }

  const before = value.slice(0, insertPos);
  const after = value.slice(insertPos);
  const matches = Array.from(before.matchAll(/\n-{3,}\n/g));
  const lastSeparator = matches[matches.length - 1];
  const slideStart = lastSeparator
    ? lastSeparator.index + lastSeparator[0].length
    : 0;
  const nextSeparatorOffset = after.search(/\n-{3,}\n/);
  const slideEnd =
    nextSeparatorOffset === -1 ? value.length : insertPos + nextSeparatorOffset;
  const chunk = value.slice(slideStart, slideEnd);
  if (!/:::\s*notes/i.test(chunk)) {
    return null;
  }

  const newLine = placeholder ?? '這裡放講者備註。';
  const trailingNewline = value[slideEnd - 1] === '\n' ? '' : '\n';
  return {
    insertPos: slideEnd,
    snippet: `${trailingNewline}${newLine}\n`,
    placeholder: newLine,
  };
}

interface TextareaDropPosition {
  /** 插入列的起始 offset */
  offset: number;
  /** 插入提示線在 textarea 內的 top */
  lineTop: number;
}

/**
 * 依照滑鼠位置計算 textarea 中的拖放列
 * 避免瀏覽器原生 drop caret 在上下拖曳時位置不一致
 */
function getTextareaDropPosition(
  textarea: HTMLTextAreaElement,
  clientY: number,
): TextareaDropPosition {
  const rect = textarea.getBoundingClientRect();
  const style = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight) || 24;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const scrollAdjustedY =
    clientY - rect.top + textarea.scrollTop - paddingTop;
  const lineIndex = Math.max(0, Math.floor(scrollAdjustedY / lineHeight));
  const lineTop = lineIndex * lineHeight + paddingTop - textarea.scrollTop;

  return {
    offset: getLineStartOffset(textarea.value, lineIndex),
    lineTop: Math.max(paddingTop, lineTop),
  };
}

/**
 * 產生投影片背景樣式
 * 有背景圖時套用遮罩以維持文字可讀性
 */
function createSlideStyle(options: {
  layout: SlideLayout | undefined;
  background: string | undefined;
  alignHorizontal: 'left' | 'center' | 'right' | undefined;
  alignVertical: 'top' | 'middle' | 'bottom' | undefined;
}): CSSProperties {
  const { layout, background, alignHorizontal, alignVertical } = options;
  const justifyContent =
    alignVertical === 'middle'
      ? 'center'
      : alignVertical === 'bottom'
        ? 'flex-end'
        : 'flex-start';
  const textAlign = alignHorizontal === 'right' ? 'right' : 'left';

  const style: CSSProperties = {
    justifyContent,
    textAlign,
  };

  if (
    alignVertical === 'middle' &&
    !isImagePanelLayout(layout) &&
    layout !== 'full'
  ) {
    style.paddingBottom = 'clamp(1rem, 6svh, 4rem)';
  }

  if (!background || isImagePanelLayout(layout)) {
    return style;
  }

  style.backgroundImage = `linear-gradient(160deg, rgba(2, 8, 26, 0.65), rgba(7, 18, 42, 0.45)), url("${background}")`;
  style.backgroundSize = 'cover';
  style.backgroundPosition = 'center';
  return style;
}

/**
 * 產生投影片內容層樣式
 * 水平置中時固定內容寬度，保留視覺平衡
 */
function createSlideContentStyle(
  layout: SlideLayout | undefined,
  alignHorizontal: 'left' | 'center' | 'right' | undefined,
): CSSProperties | undefined {
  if (layout === 'full') {
    return { width: '100%' };
  }
  if (isImagePanelLayout(layout)) {
    return { width: '100%', maxWidth: '100%' };
  }
  if (
    alignHorizontal === 'center' ||
    alignHorizontal === 'left' ||
    alignHorizontal === undefined
  ) {
    return { maxWidth: '76rem', marginInline: 'auto', width: '100%' };
  }
  if (alignHorizontal === 'right') {
    return { marginLeft: 'auto', width: '100%' };
  }
  return undefined;
}

interface DeckSyncMessage {
  /** 訊息型別 */
  type: 'deck-sync';
  /** 發送視窗識別 */
  source: string;
  /** 同步資料 */
  payload: {
    activeIndex: number;
    /** 用來識別內容是否相同，避免不同 markdown 視窗互相 clamp */
    markdownLength: number;
  };
}

/**
 * 主簡報工作區
 * 提供編輯、播放、講者三種模式
 */
export function DeckStudio() {
  const markdown = useDeckStore((state) => state.markdown);
  const activeIndex = useDeckStore((state) => state.activeIndex);
  const mode = useDeckStore((state) => state.mode);
  const setMarkdown = useDeckStore((state) => state.setMarkdown);
  const setActiveIndex = useDeckStore((state) => state.setActiveIndex);
  const setMode = useDeckStore((state) => state.setMode);
  const isDark = useThemeStore((state) => state.isDark);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const setDark = useThemeStore((state) => state.setDark);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setTimerRunning] = useState(false);
  const [timerTab, setTimerTab] = useState<'stopwatch' | 'countdown'>(
    'stopwatch',
  );
  const [countdownInitialSeconds, setCountdownInitialSeconds] = useState(
    5 * 60,
  );
  const [countdownRemaining, setCountdownRemaining] = useState(5 * 60);
  const [isCountdownRunning, setCountdownRunning] = useState(false);
  const previousCountdownRef = useRef(5 * 60);
  const [isModeInitialized, setIsModeInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditorDropActive, setIsEditorDropActive] = useState(false);
  const [collapsedToolGroups, setCollapsedToolGroups] = useState<
    Record<string, boolean>
  >({});
  const [editorDropLineTop, setEditorDropLineTop] = useState<number | null>(
    null,
  );
  const presentRootRef = useRef<HTMLDivElement | null>(null);
  const presenterThumbsRef = useRef<HTMLDivElement | null>(null);
  const editorThumbsRef = useRef<HTMLDivElement | null>(null);
  const previousSlideIndexRef = useRef(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [currentFileHandle, setCurrentFileHandle] =
    useState<FileHandleLike | null>(null);
  const [currentFileName, setCurrentFileName] = useState(
    'src/content/slides.md',
  );
  const [fileStatus, setFileStatus] = useState('');
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const isApplyingRemoteSyncRef = useRef(false);
  const syncSourceRef = useRef(
    `deckflow-${Math.random().toString(36).slice(2)}`,
  );

  const slides = useMemo(() => parseDeckMarkdown(markdown), [markdown]);
  /** 依分類整理 Markdown 工具，讓側欄可分區呈現 */
  const groupedMarkdownTools = useMemo(() => {
    const order: MarkdownTool['group'][] = ['版型', '指令', '元件'];
    return order
      .map((group) => ({
        group,
        items: markdownTools.filter((tool) => tool.group === group),
      }))
      .filter((entry) => entry.items.length > 0);
  }, []);
  const safeIndex = clamp(activeIndex, 0, Math.max(slides.length - 1, 0));
  const activeSlide = slides[safeIndex];
  const nextSlide = slides[safeIndex + 1] ?? null;

  /** 首次進入時根據 URL query 設定模式 */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeFromQuery = params.get('mode');
    if (
      modeFromQuery === 'present' ||
      modeFromQuery === 'presenter' ||
      modeFromQuery === 'editor'
    ) {
      setMode(modeFromQuery);
    }
    setIsModeInitialized(true);
  }, [setMode]);

  /** 同步主題 class，避免重整後樣式狀態不一致 */
  useEffect(() => {
    setDark(isDark);
  }, [isDark, setDark]);

  /** 維持索引落在合法範圍 */
  useEffect(() => {
    if (safeIndex !== activeIndex) {
      setActiveIndex(safeIndex);
    }
  }, [activeIndex, safeIndex, setActiveIndex]);

  /** 同步模式到 URL，便於分享特定模式連結 */
  useEffect(() => {
    if (!isModeInitialized) {
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('mode', mode);
    window.history.replaceState({}, '', nextUrl);
  }, [isModeInitialized, mode]);

  /** 建立跨視窗即時同步通道 */
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof BroadcastChannel === 'undefined'
    ) {
      return;
    }

    const channel = new BroadcastChannel('deckflow-live-sync');
    syncChannelRef.current = channel;

    /**
     * 接收遠端視窗同步訊息
     * 只同步頁碼，避免影響各視窗自己的模式狀態
     */
    function handleMessage(event: MessageEvent<DeckSyncMessage>): void {
      const message = event.data;
      if (!message || message.type !== 'deck-sync') {
        return;
      }
      if (message.source === syncSourceRef.current) {
        return;
      }
      // 不同視窗載入不同 markdown 時不互相同步，避免被 clamp 來回拉扯
      if (
        message.payload.markdownLength !== useDeckStore.getState().markdown.length
      ) {
        return;
      }

      isApplyingRemoteSyncRef.current = true;
      setActiveIndex(message.payload.activeIndex);
    }

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      syncChannelRef.current = null;
    };
  }, [setActiveIndex]);

  /** 發送頁碼到其他視窗 */
  useEffect(() => {
    if (!syncChannelRef.current) {
      return;
    }

    if (isApplyingRemoteSyncRef.current) {
      isApplyingRemoteSyncRef.current = false;
      return;
    }

    const message: DeckSyncMessage = {
      type: 'deck-sync',
      source: syncSourceRef.current,
      payload: { activeIndex, markdownLength: markdown.length },
    };
    syncChannelRef.current.postMessage(message);
  }, [activeIndex, markdown.length]);

  /** 鍵盤控制：左右鍵、空白鍵切頁，Esc 回編輯模式 */
  useEffect(() => {
    /**
     * 處理鍵盤控制事件
     * 僅在非輸入欄位焦點時觸發切頁
     */
    function onKeydown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT';
      if (isTyping && mode === 'editor') {
        return;
      }

      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        setActiveIndex(clamp(safeIndex + 1, 0, Math.max(slides.length - 1, 0)));
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex(clamp(safeIndex - 1, 0, Math.max(slides.length - 1, 0)));
      }

      if (event.key === 'Escape') {
        if (document.fullscreenElement) {
          return;
        }
        setMode('editor');
      }
    }

    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('keydown', onKeydown);
    };
  }, [mode, safeIndex, setActiveIndex, setMode, slides.length]);

  /**
   * 切換投影片時自動捲動目前模式的縮圖導覽
   * 鍵盤上下頁同樣會觸發，並把下一張帶入視野（最後一張則捲自己）
   */
  useEffect(() => {
    const container =
      mode === 'presenter'
        ? presenterThumbsRef.current
        : mode === 'editor'
          ? editorThumbsRef.current
          : null;
    if (!container) {
      return;
    }
    const target = container.querySelector<HTMLElement>(
      `[data-thumb-index="${safeIndex}"]`,
    );
    if (!target) {
      return;
    }
    // 依切換方向把前/後一張縮圖帶入視野，避免到頭尾時看不到鄰近項目
    const direction = safeIndex >= previousSlideIndexRef.current ? 1 : -1;
    previousSlideIndexRef.current = safeIndex;
    const lookahead =
      direction === 1
        ? ((target.nextElementSibling as HTMLElement | null) ?? target)
        : ((target.previousElementSibling as HTMLElement | null) ?? target);
    lookahead.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [mode, safeIndex]);

  /** 講者計時器 */
  useEffect(() => {
    if (!isTimerRunning) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isTimerRunning]);

  /**
   * 倒數跨過 5 分鐘門檻時嗶一聲提醒講者
   * 使用 WebAudio 短促 sine 音，避免額外靜態檔
   */
  useEffect(() => {
    const previous = previousCountdownRef.current;
    previousCountdownRef.current = countdownRemaining;
    /** 跨過指定門檻時嗶聲（frequency 越高越急促） */
    function beep(frequency: number, duration: number): void {
      try {
        const AudioCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtor) {
          return;
        }
        const ctx = new AudioCtor();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + duration,
        );
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + duration);
        oscillator.onended = () => {
          void ctx.close();
        };
      } catch {
        // 忽略不支援 AudioContext 的環境
      }
    }
    if (previous > 300 && countdownRemaining <= 300 && countdownRemaining > 0) {
      beep(880, 0.6);
    }
    if (previous > 60 && countdownRemaining <= 60 && countdownRemaining > 0) {
      // 一分鐘警示連嗶兩聲，提示更急
      beep(1320, 0.35);
      window.setTimeout(() => {
        beep(1320, 0.35);
      }, 450);
    }
  }, [countdownRemaining]);

  /** 倒數計時器 */
  useEffect(() => {
    if (!isCountdownRunning) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCountdownRemaining((prev) => {
        if (prev <= 1) {
          setCountdownRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isCountdownRunning]);

  /** 切換工作模式 */
  function handleModeChange(nextMode: DeckMode): void {
    setMode(nextMode);
  }

  /** 切換到上一張 */
  function handlePrevSlide(): void {
    setActiveIndex(clamp(safeIndex - 1, 0, Math.max(slides.length - 1, 0)));
  }

  /** 切換到下一張 */
  function handleNextSlide(): void {
    setActiveIndex(clamp(safeIndex + 1, 0, Math.max(slides.length - 1, 0)));
  }

  /** 從縮圖切換投影片，並同步捲動 Markdown 編輯器到對應頁面 */
  function handleSelectSlideFromThumbnail(index: number): void {
    setActiveIndex(index);

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const offset = getSlideMarkdownOffset(markdown, index);
    const lineEndOffset = getLineEndOffset(markdown, offset);
    window.requestAnimationFrame(() => {
      const style = window.getComputedStyle(editor);
      const lineHeight = Number.parseFloat(style.lineHeight) || 24;
      const lineIndex = markdown.slice(0, offset).split('\n').length - 1;
      const targetTop = Math.max(0, lineIndex * lineHeight);

      editor.focus({ preventScroll: true });
      editor.setSelectionRange(offset, lineEndOffset);
      editor.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
  }

  /** 重置計時器 */
  function handleResetTimer(): void {
    setElapsedSeconds(0);
    setTimerRunning(false);
  }

  /** 重置倒數計時器到設定的初始秒數 */
  function handleResetCountdown(): void {
    setCountdownRunning(false);
    setCountdownRemaining(countdownInitialSeconds);
  }

  /**
   * 調整倒數計時器初始時間
   * 停止計時並同步重置剩餘秒數
   */
  function handleAdjustCountdownInitial(
    field: 'minutes' | 'seconds',
    value: number,
  ): void {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const currentMinutes = Math.floor(countdownInitialSeconds / 60);
    const currentSeconds = countdownInitialSeconds % 60;
    const nextMinutes = field === 'minutes' ? safeValue : currentMinutes;
    const nextSecondsRaw = field === 'seconds' ? Math.min(safeValue, 59) : currentSeconds;
    const nextTotal = nextMinutes * 60 + nextSecondsRaw;
    setCountdownInitialSeconds(nextTotal);
    setCountdownRemaining(nextTotal);
    setCountdownRunning(false);
  }

  /** 切換全螢幕（針對播放模式容器） */
  async function toggleFullscreen(): Promise<void> {
    const target = presentRootRef.current ?? document.documentElement;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await target.requestFullscreen();
    }
  }

  /** 監聽全螢幕狀態變化，同步按鈕顯示 */
  useEffect(() => {
    function handleChange(): void {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
    };
  }, []);

  /** F 鍵在播放模式切換全螢幕 */
  useEffect(() => {
    if (mode !== 'present') {
      return;
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        void toggleFullscreen();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [mode]);

  /** 開啟指定模式新視窗 */
  function openModeWindow(nextMode: DeckMode): void {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', nextMode);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  /** 開啟本機 Markdown 檔案 */
  async function handleOpenMarkdownFile(): Promise<void> {
    try {
      const file = await openMarkdownFile();
      setCurrentFileHandle(file.handle);
      setCurrentFileName(file.name);
      setMarkdown(file.content);
      setActiveIndex(0);
      setFileStatus(`已載入：${file.name}`);
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : '開啟檔案失敗');
    }
  }

  /** 儲存到目前已開啟的本機檔案 */
  async function handleSaveCurrentFile(): Promise<void> {
    if (!currentFileHandle) {
      setFileStatus('尚未開啟本機檔案，請先按「開啟 md」');
      return;
    }

    try {
      await saveToExistingFile(currentFileHandle, markdown);
      setFileStatus(`已儲存：${currentFileName}`);
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : '儲存失敗');
    }
  }

  /** 另存新檔 */
  async function handleSaveAsFile(): Promise<void> {
    try {
      if (isFsApiSupported()) {
        await saveAsMarkdownFile(markdown);
        setFileStatus('已另存新檔');
        return;
      }

      downloadMarkdown(markdown, 'slides.md');
      setFileStatus('瀏覽器不支援檔案 API，已改用下載方式');
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : '另存失敗');
    }
  }

  /** 還原為專案中的 slides.md 預設內容 */
  function handleResetToProjectMarkdown(): void {
    setMarkdown(defaultDeckMarkdown);
    setActiveIndex(0);
    setCurrentFileHandle(null);
    setCurrentFileName('src/content/slides.md');
    setFileStatus('已還原為專案檔案 src/content/slides.md');
  }

  /**
   * 套用插入後的游標位置或預選範圍
   * 有 placeholder 時自動全選該段，方便立即覆寫
   */
  function applyInsertedSelection(
    editor: HTMLTextAreaElement,
    insertionStart: number,
    insertedText: string,
    previousScrollTop: number,
    placeholder?: string,
  ): void {
    window.requestAnimationFrame(() => {
      editor.focus({ preventScroll: true });
      const placeholderIndex = placeholder
        ? insertedText.indexOf(placeholder)
        : -1;
      if (placeholder && placeholderIndex >= 0) {
        const start = insertionStart + placeholderIndex;
        editor.setSelectionRange(start, start + placeholder.length);
      } else {
        const cursorPosition = insertionStart + insertedText.length;
        editor.setSelectionRange(cursorPosition, cursorPosition);
      }
      editor.scrollTop = previousScrollTop;
    });
  }

  /**
   * 將版型範本插入為「目前投影片的下一張」
   * 避免把版型塞進既有投影片中而破壞原本內容
   */
  function handleInsertLayoutTemplate(
    template: string,
    placeholder?: string,
  ): void {
    const editor = editorRef.current;
    const trimmedTemplate = template.replace(/^\s+|\s+$/g, '');
    if (markdown.trim().length === 0) {
      setMarkdown(trimmedTemplate);
      if (editor) {
        applyInsertedSelection(editor, 0, trimmedTemplate, 0, placeholder);
      }
      return;
    }

    // 以目前投影片為基準，在它結尾後新增一張
    const separatorPattern = /\n-{3,}\n/g;
    let slideEnd = markdown.length;
    let nextSlideStart = markdown.length;
    let currentIndex = 0;
    let match = separatorPattern.exec(markdown);
    while (match) {
      if (currentIndex === safeIndex) {
        slideEnd = match.index;
        nextSlideStart = match.index + match[0].length;
        break;
      }
      currentIndex += 1;
      match = separatorPattern.exec(markdown);
    }

    const beforeSlide = markdown.slice(0, slideEnd).replace(/\s+$/g, '');
    const afterSlide = markdown.slice(nextSlideStart).replace(/^\s+/g, '');
    const tail = afterSlide.length > 0 ? `\n\n---\n\n${afterSlide}` : '';
    const insertText = `\n\n---\n\n${trimmedTemplate}`;
    const insertStart = beforeSlide.length;
    const nextMarkdown = `${beforeSlide}${insertText}${tail}`;
    const previousScrollTop = editor?.scrollTop ?? 0;
    setMarkdown(nextMarkdown);
    setActiveIndex(safeIndex + 1);
    if (editor) {
      applyInsertedSelection(
        editor,
        insertStart,
        insertText,
        previousScrollTop,
        placeholder,
      );
    }
  }

  /** 在 Markdown 編輯器目前游標位置插入片段 */
  function insertMarkdownAtCursor(snippet: string, placeholder?: string): void {
    const editor = editorRef.current;
    if (!editor) {
      setMarkdown(`${markdown}${snippet}`);
      return;
    }

    const selectionStart = editor.selectionStart;
    const selectionEnd = editor.selectionEnd;
    const previousScrollTop = editor.scrollTop;
    const appended = resolveNotesAppending(
      markdown,
      selectionStart,
      snippet,
      placeholder,
    );
    const insertStart = appended ? appended.insertPos : selectionStart;
    const insertEnd = appended ? appended.insertPos : selectionEnd;
    const insertText = appended ? appended.snippet : snippet;
    const finalPlaceholder = appended ? appended.placeholder : placeholder;
    const nextMarkdown =
      markdown.slice(0, insertStart) + insertText + markdown.slice(insertEnd);
    setMarkdown(nextMarkdown);
    applyInsertedSelection(
      editor,
      insertStart,
      insertText,
      previousScrollTop,
      finalPlaceholder,
    );
  }

  /** 拖曳功能列項目時，保存要插入的 Markdown */
  function handleToolDragStart(
    event: DragEvent<HTMLButtonElement>,
    tool: MarkdownTool,
  ): void {
    const dropText =
      tool.group === '版型'
        ? `\n\n---\n\n${tool.markdown.trim()}\n\n---\n\n`
        : tool.markdown;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', dropText);
    event.dataTransfer.setData('application/x-deckflow-markdown', dropText);
    if (tool.placeholder) {
      event.dataTransfer.setData(
        'application/x-deckflow-placeholder',
        tool.placeholder,
      );
    }
    if (tool.group === '版型') {
      event.dataTransfer.setData(
        'application/x-deckflow-layout',
        tool.markdown,
      );
    }
  }

  /** 拖曳工具列片段進入編輯區時提供高亮提示 */
  function handleEditorDragOver(event: DragEvent<HTMLTextAreaElement>): void {
    if (event.dataTransfer.types.includes('application/x-deckflow-markdown')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setIsEditorDropActive(true);
      const { lineTop } = getTextareaDropPosition(
        event.currentTarget,
        event.clientY,
      );
      setEditorDropLineTop(lineTop);
    }
  }

  /** 將拖曳工具插入到目前提示列 */
  function handleEditorDrop(event: DragEvent<HTMLTextAreaElement>): void {
    const snippet =
      event.dataTransfer.getData('application/x-deckflow-markdown') ||
      event.dataTransfer.getData('text/plain');
    if (!snippet) {
      setIsEditorDropActive(false);
      setEditorDropLineTop(null);
      return;
    }

    event.preventDefault();
    const layoutTemplate =
      event.dataTransfer.getData('application/x-deckflow-layout') || '';
    const placeholder =
      event.dataTransfer.getData('application/x-deckflow-placeholder') ||
      undefined;
    if (layoutTemplate) {
      // 版型一律新增為下一張投影片，不切碎既有內容
      handleInsertLayoutTemplate(layoutTemplate, placeholder);
      setIsEditorDropActive(false);
      setEditorDropLineTop(null);
      return;
    }
    const { offset } = getTextareaDropPosition(
      event.currentTarget,
      event.clientY,
    );
    const currentValue = event.currentTarget.value;
    // 記錄拖放當下的捲動位置，避免 focus/setSelectionRange 把畫面捲到游標
    const previousScrollTop = event.currentTarget.scrollTop;
    const appended = resolveNotesAppending(
      currentValue,
      offset,
      snippet,
      placeholder,
    );
    const insertStart = appended ? appended.insertPos : offset;
    const insertText = appended ? appended.snippet : snippet;
    const finalPlaceholder = appended ? appended.placeholder : placeholder;
    const nextMarkdown =
      currentValue.slice(0, insertStart) +
      insertText +
      currentValue.slice(insertStart);
    setMarkdown(nextMarkdown);

    const editor = editorRef.current;
    if (editor) {
      applyInsertedSelection(
        editor,
        insertStart,
        insertText,
        previousScrollTop,
        finalPlaceholder,
      );
    }

    setIsEditorDropActive(false);
    setEditorDropLineTop(null);
  }

  /** 更新目前投影片的垂直對齊指令 */
  function handleUpdateVerticalAlignment(
    nextVertical: VerticalAlignment,
  ): void {
    const chunks = markdown.split(/\n-{3,}\n/g);
    const currentChunk = chunks[safeIndex];
    if (!currentChunk) {
      return;
    }

    const nextHorizontal = activeSlide?.alignHorizontal ?? 'left';
    const cleanedChunk = currentChunk
      .replace(
        /^[ \t]*:::\s*align\s+(left|center|right)\s+(top|middle|bottom)[ \t]*\r?\n?/gim,
        '',
      )
      .trimStart();

    chunks[safeIndex] = `:::align ${nextHorizontal} ${nextVertical}\n${cleanedChunk}`;
    // 各塊統一去除兩端空白後再以固定分隔符重組，避免每次點擊累加空行
    const normalized = chunks.map((chunk) => chunk.replace(/^\s+|\s+$/g, ''));
    const nextMarkdown = normalized.join('\n\n---\n\n');
    setMarkdown(nextMarkdown);

    // 將編輯器游標移到該頁的 :::align 行，讓使用者看到剛操作的設定
    const separator = '\n\n---\n\n';
    let slideOffset = 0;
    for (let index = 0; index < safeIndex; index += 1) {
      slideOffset += normalized[index].length + separator.length;
    }
    const alignLine = `:::align ${nextHorizontal} ${nextVertical}`;
    const lineOffset = nextMarkdown.indexOf(alignLine, slideOffset);
    if (lineOffset >= 0) {
      focusEditorAtLine(lineOffset, lineOffset + alignLine.length);
    }
  }

  /**
   * 把編輯器游標移到指定區間並捲到對應的行
   * 用於操作版型 / 對齊等指令時自動定位
   */
  function focusEditorAtLine(start: number, end: number): void {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    window.requestAnimationFrame(() => {
      const style = window.getComputedStyle(editor);
      const lineHeight = Number.parseFloat(style.lineHeight) || 24;
      const lineIndex = editor.value.slice(0, start).split('\n').length - 1;
      const targetTop = Math.max(0, lineIndex * lineHeight);
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(start, end);
      editor.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
  }

  const progressPercent =
    slides.length > 1 ? (safeIndex / (slides.length - 1)) * 100 : 0;

  return (
    <div className="hero-glow flex h-[100svh] flex-col overflow-hidden">
      <header className="z-20 shrink-0 border-b border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="title-font rounded-lg bg-[var(--color-primary)] px-3 py-1 text-xs font-bold tracking-widest text-white">
              DECKFLOW
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              React Slide Runtime
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`mode-pill ${mode === 'editor' ? 'mode-pill-active' : ''}`}
              onClick={() => {
                handleModeChange('editor');
              }}
            >
              編輯模式
            </button>
            <button
              type="button"
              className={`mode-pill ${mode === 'present' ? 'mode-pill-active' : ''}`}
              onClick={() => {
                handleModeChange('present');
              }}
            >
              播放模式
            </button>
            <button
              type="button"
              className={`mode-pill ${mode === 'presenter' ? 'mode-pill-active' : ''}`}
              onClick={() => {
                handleModeChange('presenter');
              }}
            >
              講者模式
            </button>
            <button type="button" className="mode-pill" onClick={toggleTheme}>
              {isDark ? '亮色' : '暗色'}
            </button>
            <Link to="/intro" className="mode-pill">
              介紹頁
            </Link>
          </div>
        </div>
      </header>

      {mode === 'editor' && (
        <main className="app-scrollbar mx-auto grid min-h-0 w-full max-w-[100rem] flex-1 gap-4 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 xl:grid-cols-[160px_1fr_2fr_160px] xl:overflow-hidden">
          <aside className="glass-card flex min-h-[18rem] flex-col overflow-hidden rounded-2xl p-3 xl:min-h-0">
            <div className="mb-3 shrink-0">
              <h2 className="title-font text-lg font-bold">功能清單</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                點擊使用，或拖曳到 Markdown 撰寫區。
              </p>
            </div>
            <div className="app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-primary-soft)]"
                  aria-expanded={!collapsedToolGroups['垂直排列']}
                  onClick={() => {
                    setCollapsedToolGroups((prev) => ({
                      ...prev,
                      ['垂直排列']: !prev['垂直排列'],
                    }));
                  }}
                >
                  <span>垂直排列</span>
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    className={`shrink-0 transition-transform duration-200 ${collapsedToolGroups['垂直排列'] ? '-rotate-90' : ''}`}
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {!collapsedToolGroups['垂直排列'] && (
                  <div className="mt-2 grid gap-2">
                    {verticalAlignmentOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`control-btn text-left ${activeSlide?.alignVertical === option.value ? 'control-btn-primary' : ''}`}
                        onClick={() => {
                          handleUpdateVerticalAlignment(option.value);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {groupedMarkdownTools.map((entry) => (
                <div key={entry.group}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-primary-soft)]"
                    aria-expanded={!collapsedToolGroups[entry.group]}
                    onClick={() => {
                      setCollapsedToolGroups((prev) => ({
                        ...prev,
                        [entry.group]: !prev[entry.group],
                      }));
                    }}
                  >
                    <span>{entry.group}</span>
                    <svg
                      aria-hidden
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      className={`shrink-0 transition-transform duration-200 ${collapsedToolGroups[entry.group] ? '-rotate-90' : ''}`}
                    >
                      <path
                        d="M4 6l4 4 4-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {!collapsedToolGroups[entry.group] && (
                  <div className="mt-2 grid gap-2">
                    {entry.items.map((tool) => (
                      <button
                        key={`${tool.group}-${tool.label}`}
                        type="button"
                        draggable
                        className="control-btn cursor-grab text-left active:cursor-grabbing"
                        title={`點擊新增，或拖曳「${tool.label}」到撰寫區`}
                        onClick={() => {
                          if (tool.group === '版型') {
                            handleInsertLayoutTemplate(
                              tool.markdown,
                              tool.placeholder,
                            );
                            return;
                          }
                          insertMarkdownAtCursor(
                            tool.markdown,
                            tool.placeholder,
                          );
                        }}
                        onDragEnd={() => {
                          setIsEditorDropActive(false);
                        }}
                        onDragStart={(event) => {
                          handleToolDragStart(event, tool);
                        }}
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          <section className="glass-card flex min-h-[32rem] flex-col overflow-hidden rounded-2xl p-4 lg:min-h-0">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between">
              <h2 className="title-font text-lg font-bold">
                {currentFileName}
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                以 `---` 分頁，`:::notes` 備註，`:::bg URL` 背景圖，`:::align
                center middle` 對齊，`:::layout cover` 版型，`:::ratio 35:65`
                比例；可用快捷插入通用版型
              </span>
            </div>
            <div className="mb-3 flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                className="control-btn"
                onClick={handleOpenMarkdownFile}
              >
                開啟
              </button>
              <button
                type="button"
                className="control-btn"
                onClick={handleSaveCurrentFile}
              >
                儲存
              </button>
              <button
                type="button"
                className="control-btn"
                onClick={handleSaveAsFile}
              >
                另存
              </button>
              <button
                type="button"
                className="control-btn"
                onClick={handleResetToProjectMarkdown}
              >
                還原專案檔
              </button>
            </div>
            <p className="mb-3 shrink-0 text-xs text-[var(--color-text-muted)]">
              {fileStatus ||
                '預設來源：src/content/slides.md（可直接在 IDE 修改）'}
            </p>
            <label htmlFor="deck-editor" className="sr-only">
              投影片 Markdown 編輯器
            </label>
            <div className="relative min-h-[18rem] flex-1 lg:min-h-0">
              <textarea
                ref={editorRef}
                id="deck-editor"
                className={`app-scrollbar h-full min-h-[18rem] w-full resize-none overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm leading-6 caret-[var(--color-primary)] ring-[var(--color-primary)] transition outline-none selection:bg-[var(--color-primary)] selection:text-white focus:ring-2 lg:min-h-0 ${isEditorDropActive ? 'border-[var(--color-primary)] ring-2' : ''}`}
                value={markdown}
                wrap="off"
                onDragLeave={() => {
                  setIsEditorDropActive(false);
                  setEditorDropLineTop(null);
                }}
                onDragOver={handleEditorDragOver}
                onDrop={handleEditorDrop}
                onChange={(event) => {
                  setMarkdown(event.target.value);
                }}
              />
              {isEditorDropActive && editorDropLineTop !== null && (
                <div
                  className="pointer-events-none absolute right-3 left-3 z-10 h-0.5 rounded-full bg-[var(--color-primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary-soft)_80%,transparent)]"
                  style={{ top: editorDropLineTop }}
                >
                  <span className="absolute -top-3 left-0 rounded bg-[var(--color-primary)] px-2 py-0.5 text-[0.68rem] font-bold text-white">
                    插入到這一列
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="glass-card flex min-h-[28rem] flex-col overflow-hidden rounded-2xl p-4 lg:min-h-0">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <h2 className="title-font text-lg font-bold">
                {activeSlide?.title ?? 'Untitled Slide'}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {safeIndex + 1} / {slides.length}
              </p>
            </div>
            <article
              className={`slide-frame min-h-0 flex-1 cursor-pointer overflow-hidden ${isImagePanelLayout(activeSlide?.layout) ? 'slide-frame-image-layout' : ''}`}
              title="點擊後在 Markdown 編輯器定位到此頁標題"
              onClick={() => {
                handleSelectSlideFromThumbnail(safeIndex);
              }}
              style={createSlideStyle({
                layout: activeSlide?.layout,
                background: activeSlide?.background,
                alignHorizontal: activeSlide?.alignHorizontal,
                alignVertical: activeSlide?.alignVertical,
              })}
            >
              <div
                style={createSlideContentStyle(
                  activeSlide?.layout,
                  activeSlide?.alignHorizontal,
                )}
              >
                <SlideMarkdown
                  markdown={activeSlide?.content ?? '# Empty Slide'}
                  alignHorizontal={activeSlide?.alignHorizontal}
                  layout={activeSlide?.layout}
                  background={activeSlide?.background}
                  ratio={activeSlide?.ratio}
                />
              </div>
            </article>
            <div className="mt-3 shrink-0">
              <div className="h-1.5 rounded-full bg-[var(--color-primary-soft)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="control-btn"
                  onClick={handlePrevSlide}
                >
                  上一張
                </button>
                <button
                  type="button"
                  className="control-btn control-btn-primary"
                  onClick={handleNextSlide}
                >
                  下一張
                </button>
                <button
                  type="button"
                  className="control-btn"
                  onClick={() => {
                    openModeWindow('present');
                  }}
                >
                  新視窗播放
                </button>
                <button
                  type="button"
                  className="control-btn"
                  onClick={() => {
                    openModeWindow('presenter');
                  }}
                >
                  新視窗講者
                </button>
                <button
                  type="button"
                  className="control-btn"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('mode', 'editor');
                    window.navigator.clipboard
                      .writeText(url.toString())
                      .catch(() => {});
                  }}
                >
                  複製連結
                </button>
              </div>
            </div>
          </section>

          <section className="glass-card flex min-h-[22rem] flex-col overflow-hidden rounded-2xl p-3 lg:min-h-0">
            <h2 className="title-font mb-2 shrink-0 px-1 text-lg font-bold">
              縮圖導覽
            </h2>
            <div
              ref={editorThumbsRef}
              className="app-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pt-1 pb-1"
            >
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  data-thumb-index={index}
                  className={`thumb-card ${index === safeIndex ? 'thumb-card-active' : ''}`}
                  onClick={(event) => {
                    handleSelectSlideFromThumbnail(index);
                    // 點到的不是最後一張時，把下一張也帶入視野；最後一張僅捲動自己
                    const target =
                      event.currentTarget.nextElementSibling ??
                      event.currentTarget;
                    target.scrollIntoView({
                      block: 'nearest',
                      behavior: 'smooth',
                    });
                  }}
                >
                  <p className="mb-1 text-xs font-semibold text-[var(--color-primary)]">
                    #{index + 1}
                  </p>
                  <p className="thumb-title text-left text-sm font-semibold text-[var(--color-text)]">
                    {slide.title}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </main>
      )}

      {mode === 'present' && (
        <main
          ref={presentRootRef}
          className={`mx-auto flex min-h-0 flex-1 flex-col bg-[var(--color-bg)] ${isFullscreen ? 'h-screen w-screen max-w-none p-0' : 'w-full max-w-[96rem] px-4 py-5 sm:px-6 lg:px-8'}`}
        >
          <article
            className={`slide-frame mx-auto flex w-full flex-1 ${isFullscreen ? 'slide-frame-fullscreen max-w-none' : 'max-w-[84rem]'} ${isImagePanelLayout(activeSlide?.layout) ? 'slide-frame-image-layout' : ''}`}
            style={createSlideStyle({
              layout: activeSlide?.layout,
              background: activeSlide?.background,
              alignHorizontal: activeSlide?.alignHorizontal,
              alignVertical: activeSlide?.alignVertical,
            })}
          >
            <div
              style={createSlideContentStyle(
                activeSlide?.layout,
                activeSlide?.alignHorizontal,
              )}
            >
              <SlideMarkdown
                markdown={activeSlide?.content ?? '# Empty Slide'}
                alignHorizontal={activeSlide?.alignHorizontal}
                layout={activeSlide?.layout}
                background={activeSlide?.background}
                ratio={activeSlide?.ratio}
              />
            </div>
          </article>
          {!isFullscreen && (
            <footer className="mt-4">
              <div className="mb-2 h-1.5 rounded-full bg-[var(--color-primary-soft)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="control-btn"
                    onClick={handlePrevSlide}
                  >
                    上一張
                  </button>
                  <button
                    type="button"
                    className="control-btn control-btn-primary"
                    onClick={handleNextSlide}
                  >
                    下一張
                  </button>
                  <button
                    type="button"
                    className="control-btn"
                    onClick={() => {
                      void toggleFullscreen();
                    }}
                    title="快捷鍵 F"
                  >
                    {isFullscreen ? '離開全螢幕' : '全螢幕'}
                  </button>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {safeIndex + 1} / {slides.length}
                </p>
              </div>
            </footer>
          )}
        </main>
      )}

      {mode === 'presenter' && (
        <main className="mx-auto grid min-h-0 w-full max-w-[100rem] flex-1 gap-4 overflow-hidden px-4 py-5 sm:px-6 lg:grid-cols-[2fr_180px_1fr] lg:px-8">
          <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl p-4">
            <h2 className="title-font mb-3 shrink-0 text-lg font-bold">目前投影片</h2>
            <article
              className={`slide-frame min-h-0 flex-1 overflow-hidden ${isImagePanelLayout(activeSlide?.layout) ? 'slide-frame-image-layout' : ''}`}
              style={createSlideStyle({
                layout: activeSlide?.layout,
                background: activeSlide?.background,
                alignHorizontal: activeSlide?.alignHorizontal,
                alignVertical: activeSlide?.alignVertical,
              })}
            >
              <div
                style={createSlideContentStyle(
                  activeSlide?.layout,
                  activeSlide?.alignHorizontal,
                )}
              >
                <SlideMarkdown
                  markdown={activeSlide?.content ?? '# Empty Slide'}
                  compact
                  alignHorizontal={activeSlide?.alignHorizontal}
                  layout={activeSlide?.layout}
                  background={activeSlide?.background}
                  ratio={activeSlide?.ratio}
                />
              </div>
            </article>
            <div className="mt-3 flex shrink-0 gap-2">
              <button
                type="button"
                className="control-btn"
                onClick={handlePrevSlide}
              >
                上一張
              </button>
              <button
                type="button"
                className="control-btn control-btn-primary"
                onClick={handleNextSlide}
              >
                下一張
              </button>
            </div>
          </section>
          <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl p-3">
            <h2 className="title-font mb-2 shrink-0 px-1 text-lg font-bold">縮圖導覽</h2>
            <div
              ref={presenterThumbsRef}
              className="app-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pt-1 pb-1"
            >
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  data-thumb-index={index}
                  className={`thumb-card ${index === safeIndex ? 'thumb-card-active' : ''}`}
                  onClick={(event) => {
                    setActiveIndex(index);
                    // 點到的不是最後一張時，把下一張也帶入視野；最後一張僅捲動自己
                    const target =
                      event.currentTarget.nextElementSibling ??
                      event.currentTarget;
                    target.scrollIntoView({
                      block: 'nearest',
                      behavior: 'smooth',
                    });
                  }}
                >
                  <p className="mb-1 text-xs font-semibold text-[var(--color-primary)]">
                    #{index + 1}
                  </p>
                  <p className="thumb-title text-left text-sm font-semibold text-[var(--color-text)]">
                    {slide.title}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="grid min-h-0 gap-4 overflow-hidden lg:grid-rows-[1.15fr_0.75fr_auto]">
            <article className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl p-4">
              <h2 className="title-font mb-3 shrink-0 text-lg font-bold">下一張預覽</h2>
              <div
                className={`slide-frame min-h-0 flex-1 overflow-hidden ${isImagePanelLayout(nextSlide?.layout) ? 'slide-frame-image-layout' : ''}`}
                style={createSlideStyle({
                  layout: nextSlide?.layout,
                  background: nextSlide?.background,
                  alignHorizontal: nextSlide?.alignHorizontal,
                  alignVertical: nextSlide?.alignVertical,
                })}
              >
                {nextSlide ? (
                  <div
                    style={createSlideContentStyle(
                      nextSlide.layout,
                      nextSlide.alignHorizontal,
                    )}
                  >
                    <SlideMarkdown
                      markdown={nextSlide.content}
                      compact
                      alignHorizontal={nextSlide.alignHorizontal}
                      layout={nextSlide.layout}
                      background={nextSlide.background}
                      ratio={nextSlide.ratio}
                    />
                  </div>
                ) : (
                  <p>已是最後一張</p>
                )}
              </div>
            </article>

            <article className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl p-4">
              <h2 className="title-font mb-3 shrink-0 text-lg font-bold">講者備註</h2>
              <p className="app-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 text-sm leading-6 whitespace-pre-wrap text-[var(--color-text-muted)]">
                {activeSlide?.notes || '本頁無備註'}
              </p>
            </article>

            <article className="glass-card shrink-0 rounded-2xl p-4">
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  className={`mode-pill ${timerTab === 'stopwatch' ? 'mode-pill-active' : ''}`}
                  onClick={() => {
                    setTimerTab('stopwatch');
                  }}
                >
                  計時器
                </button>
                <button
                  type="button"
                  className={`mode-pill ${timerTab === 'countdown' ? 'mode-pill-active' : ''}`}
                  onClick={() => {
                    setTimerTab('countdown');
                  }}
                >
                  倒數
                </button>
              </div>
              {timerTab === 'stopwatch' && (
                <>
                  <p className="title-font text-4xl font-bold">
                    {formatDuration(elapsedSeconds)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="control-btn"
                      onClick={() => {
                        setTimerRunning((prev) => !prev);
                      }}
                    >
                      {isTimerRunning ? '暫停' : '開始'}
                    </button>
                    <button
                      type="button"
                      className="control-btn"
                      onClick={handleResetTimer}
                    >
                      重置
                    </button>
                  </div>
                </>
              )}
              {timerTab === 'countdown' && (
                <>
                  <p
                    className={`title-font text-4xl font-bold ${
                      countdownRemaining === 0
                        ? 'text-[var(--color-primary)]'
                        : countdownRemaining <= 60
                          ? 'animate-pulse text-red-500'
                          : countdownRemaining <= 300
                            ? 'animate-pulse text-amber-500'
                            : ''
                    }`}
                  >
                    {formatDuration(countdownRemaining)}
                  </p>
                  <p
                    className={`mt-1 min-h-[1.125rem] text-xs font-semibold ${
                      countdownRemaining === 0 && countdownInitialSeconds > 0
                        ? 'text-[var(--color-primary)]'
                        : countdownRemaining > 0 && countdownRemaining <= 60
                          ? 'text-red-500'
                          : countdownRemaining > 60 && countdownRemaining <= 300
                            ? 'text-amber-500'
                            : 'opacity-0'
                    }`}
                    aria-live="polite"
                  >
                    {countdownRemaining === 0 && countdownInitialSeconds > 0 ? (
                      '時間到'
                    ) : countdownRemaining > 0 && countdownRemaining <= 60 ? (
                      <>⚠ 剩下不到 1 分鐘，立刻收尾</>
                    ) : countdownRemaining > 60 && countdownRemaining <= 300 ? (
                      <>⚠ 剩下不到 5 分鐘，準備收尾</>
                    ) : (
                      '佔位'
                    )}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                    <label className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        className="w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-[var(--color-text)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={Math.floor(countdownInitialSeconds / 60)}
                        onChange={(event) => {
                          handleAdjustCountdownInitial(
                            'minutes',
                            Number(event.target.value),
                          );
                        }}
                      />
                      分
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-[var(--color-text)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={countdownInitialSeconds % 60}
                        onChange={(event) => {
                          handleAdjustCountdownInitial(
                            'seconds',
                            Number(event.target.value),
                          );
                        }}
                      />
                      秒
                    </label>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="control-btn"
                      disabled={countdownInitialSeconds === 0}
                      onClick={() => {
                        if (countdownRemaining === 0) {
                          setCountdownRemaining(countdownInitialSeconds);
                        }
                        setCountdownRunning((prev) => !prev);
                      }}
                    >
                      {isCountdownRunning ? '暫停' : '開始'}
                    </button>
                    <button
                      type="button"
                      className="control-btn"
                      onClick={handleResetCountdown}
                    >
                      重置
                    </button>
                  </div>
                </>
              )}
            </article>
          </section>
        </main>
      )}
    </div>
  );
}
