import { extractSlideTitle, parseDeckMarkdown } from "@/lib/deck";

describe("deck parser", () => {
  it("應能依 `---` 分割投影片，並解析 notes 區塊", () => {
    const result = parseDeckMarkdown(`# A\n---\n## B\n:::notes\nmemo`);
    expect(result).toHaveLength(2);
    expect(result[1]?.title).toBe("B");
    expect(result[1]?.notes).toBe("memo");
  });

  it("找不到標題時應使用第一行文字", () => {
    expect(extractSlideTitle("plain text slide")).toBe("plain text slide");
  });

  it("應可解析背景圖語法並移除指令行", () => {
    const result = parseDeckMarkdown(":::bg https://example.com/bg.jpg\n# Cover");
    expect(result[0]?.background).toBe("https://example.com/bg.jpg");
    expect(result[0]?.content).toBe("# Cover");
  });

  it("應可解析水平與垂直對齊語法", () => {
    const result = parseDeckMarkdown(":::align center middle\n# Center Slide");
    expect(result[0]?.alignHorizontal).toBe("center");
    expect(result[0]?.alignVertical).toBe("middle");
  });

  it("未指定 layout 時，第一頁應為 cover，其餘為 default", () => {
    const result = parseDeckMarkdown("# A\n---\n# B");
    expect(result[0]?.layout).toBe("cover");
    expect(result[1]?.layout).toBe("default");
  });

  it("應可解析 layout 指令", () => {
    const result = parseDeckMarkdown(":::layout two-cols\n# L\n::right::\n# R");
    expect(result[0]?.layout).toBe("two-cols");
  });

  it("應可解析左右比例指令", () => {
    const result = parseDeckMarkdown(":::ratio 35:65\n:::layout image-right\n# Demo");
    expect(result[0]?.ratio?.left).toBeCloseTo(35);
    expect(result[0]?.ratio?.right).toBeCloseTo(65);
  });
});
