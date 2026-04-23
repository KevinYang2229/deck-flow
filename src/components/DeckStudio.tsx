import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
 * 產生投影片背景樣式
 * 有背景圖時套用遮罩以維持文字可讀性
 */
function createSlideStyle(
  options: {
    layout: SlideLayout | undefined;
    background: string | undefined;
    alignHorizontal: 'left' | 'center' | 'right' | undefined;
    alignVertical: 'top' | 'middle' | 'bottom' | undefined;
  },
): CSSProperties {
  const { layout, background, alignHorizontal, alignVertical } = options;
  const justifyContent =
    alignVertical === 'middle'
      ? 'center'
      : alignVertical === 'bottom'
        ? 'flex-end'
        : 'flex-start';
  const textAlign =
    alignHorizontal === 'center'
      ? 'center'
      : alignHorizontal === 'right'
        ? 'right'
        : 'left';

  const style: CSSProperties = {
    justifyContent,
    textAlign,
  };

  if (!background || layout === 'image-left' || layout === 'image-right') {
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
  if (layout === 'full' || layout === 'cover') {
    return { width: '100%' };
  }
  if (layout === 'image-left' || layout === 'image-right') {
    return { width: '100%', maxWidth: '100%' };
  }
  if (alignHorizontal === 'center') {
    return { maxWidth: '56rem', marginInline: 'auto', width: '100%' };
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
  const [isModeInitialized, setIsModeInitialized] = useState(false);
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
      payload: { activeIndex },
    };
    syncChannelRef.current.postMessage(message);
  }, [activeIndex]);

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
        setMode('editor');
      }
    }

    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('keydown', onKeydown);
    };
  }, [mode, safeIndex, setActiveIndex, setMode, slides.length]);

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

  /** 重置計時器 */
  function handleResetTimer(): void {
    setElapsedSeconds(0);
    setTimerRunning(false);
  }

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

  const progressPercent =
    slides.length > 1 ? (safeIndex / (slides.length - 1)) * 100 : 0;

  return (
    <div className="hero-glow min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
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
        <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_1.2fr_280px] lg:px-8">
          <section className="glass-card rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between">
              <h2 className="title-font text-lg font-bold">
                {currentFileName}
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                以 `---` 分頁，`:::notes` 備註，`:::bg URL` 背景圖，`:::align
                center middle` 對齊，`:::layout cover` 版型，`:::ratio 35:65`
                比例
              </span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="control-btn"
                onClick={handleOpenMarkdownFile}
              >
                開啟 Markdown
              </button>
              <button
                type="button"
                className="control-btn"
                onClick={handleSaveCurrentFile}
              >
                儲存 Markdown
              </button>
              <button
                type="button"
                className="control-btn"
                onClick={handleSaveAsFile}
              >
                另存 Markdown
              </button>
              <button
                type="button"
                className="control-btn"
                onClick={handleResetToProjectMarkdown}
              >
                還原專案檔
              </button>
            </div>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              {fileStatus ||
                '預設來源：src/content/slides.md（可直接在 IDE 修改）'}
            </p>
            <label htmlFor="deck-editor" className="sr-only">
              投影片 Markdown 編輯器
            </label>
            <textarea
              id="deck-editor"
              className="h-[70svh] w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm leading-6 ring-[var(--color-primary)] transition outline-none focus:ring-2"
              value={markdown}
              onChange={(event) => {
                setMarkdown(event.target.value);
              }}
            />
          </section>

          <section className="glass-card rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="title-font text-lg font-bold">
                {activeSlide?.title ?? 'Untitled Slide'}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {safeIndex + 1} / {slides.length}
              </p>
            </div>
            <article
              className={`slide-frame min-h-[54svh] ${activeSlide?.layout === 'image-left' || activeSlide?.layout === 'image-right' ? 'slide-frame-image-layout' : ''}`}
              style={createSlideStyle(
                {
                  layout: activeSlide?.layout,
                  background: activeSlide?.background,
                  alignHorizontal: activeSlide?.alignHorizontal,
                  alignVertical: activeSlide?.alignVertical,
                },
              )}
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
            <div className="mt-3">
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

          <section className="glass-card rounded-2xl p-3">
            <h2 className="title-font mb-2 px-1 text-lg font-bold">縮圖導覽</h2>
            <div className="max-h-[74svh] space-y-2 overflow-y-auto pr-1">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`thumb-card ${index === safeIndex ? 'thumb-card-active' : ''}`}
                  onClick={() => {
                    setActiveIndex(index);
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
        <main className="mx-auto flex min-h-[calc(100svh-58px)] max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <article
            className={`slide-frame mx-auto flex w-full max-w-5xl flex-1 ${activeSlide?.layout === 'image-left' || activeSlide?.layout === 'image-right' ? 'slide-frame-image-layout' : ''}`}
            style={createSlideStyle(
              {
                layout: activeSlide?.layout,
                background: activeSlide?.background,
                alignHorizontal: activeSlide?.alignHorizontal,
                alignVertical: activeSlide?.alignVertical,
              },
            )}
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
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {safeIndex + 1} / {slides.length}
              </p>
            </div>
          </footer>
        </main>
      )}

      {mode === 'presenter' && (
        <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <section className="glass-card rounded-2xl p-4">
            <h2 className="title-font mb-3 text-lg font-bold">目前投影片</h2>
            <article
              className={`slide-frame min-h-[42svh] ${activeSlide?.layout === 'image-left' || activeSlide?.layout === 'image-right' ? 'slide-frame-image-layout' : ''}`}
              style={createSlideStyle(
                {
                  layout: activeSlide?.layout,
                  background: activeSlide?.background,
                  alignHorizontal: activeSlide?.alignHorizontal,
                  alignVertical: activeSlide?.alignVertical,
                },
              )}
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
            <div className="mt-3 flex gap-2">
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

          <section className="space-y-4">
            <article className="glass-card rounded-2xl p-4">
              <h2 className="title-font mb-3 text-lg font-bold">下一張預覽</h2>
              <div
                className={`slide-frame min-h-52 ${nextSlide?.layout === 'image-left' || nextSlide?.layout === 'image-right' ? 'slide-frame-image-layout' : ''}`}
                style={createSlideStyle(
                  {
                    layout: nextSlide?.layout,
                    background: nextSlide?.background,
                    alignHorizontal: nextSlide?.alignHorizontal,
                    alignVertical: nextSlide?.alignVertical,
                  },
                )}
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

            <article className="glass-card rounded-2xl p-4">
              <h2 className="title-font mb-3 text-lg font-bold">講者備註</h2>
              <p className="min-h-20 text-sm leading-6 whitespace-pre-wrap text-[var(--color-text-muted)]">
                {activeSlide?.notes || '本頁無備註'}
              </p>
            </article>

            <article className="glass-card rounded-2xl p-4">
              <h2 className="title-font mb-3 text-lg font-bold">計時器</h2>
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
            </article>
          </section>
        </main>
      )}
    </div>
  );
}
