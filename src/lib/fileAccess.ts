export type FileHandleLike = {
  name?: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

interface WindowWithFsApi extends Window {
  showOpenFilePicker?: (options?: object) => Promise<FileHandleLike[]>;
  showSaveFilePicker?: (options?: object) => Promise<FileHandleLike>;
}

/** 是否支援 File System Access API */
export function isFsApiSupported(): boolean {
  const win = window as WindowWithFsApi;
  return Boolean(win.showOpenFilePicker && win.showSaveFilePicker);
}

/** 開啟本機 Markdown 檔案 */
export async function openMarkdownFile(): Promise<{ handle: FileHandleLike; name: string; content: string }> {
  const win = window as WindowWithFsApi;
  if (!win.showOpenFilePicker) {
    throw new Error("目前瀏覽器不支援開啟本機檔案 API");
  }

  const [handle] = await win.showOpenFilePicker({
    multiple: false,
    types: [{ description: "Markdown Files", accept: { "text/markdown": [".md", ".markdown", ".mdx"] } }],
    excludeAcceptAllOption: false,
  });
  if (!handle) {
    throw new Error("未選擇檔案");
  }

  const file = await handle.getFile();
  const content = await file.text();
  return { handle, name: file.name, content };
}

/** 儲存內容回既有檔案 */
export async function saveToExistingFile(handle: FileHandleLike, content: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** 另存新檔 */
export async function saveAsMarkdownFile(content: string): Promise<void> {
  const win = window as WindowWithFsApi;
  if (!win.showSaveFilePicker) {
    throw new Error("目前瀏覽器不支援另存新檔 API");
  }

  const handle = await win.showSaveFilePicker({
    suggestedName: "slides.md",
    types: [{ description: "Markdown Files", accept: { "text/markdown": [".md"] } }],
  });

  await saveToExistingFile(handle, content);
}

/** 下載 Markdown 檔案（API 不支援時的備援） */
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
