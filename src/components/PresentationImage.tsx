interface PresentationImageProps {
  /** 圖片路徑或網址 */
  src: string;
  /** 替代文字 */
  alt: string;
  /** 圖片寬度，可填 CSS 長度（如 50%、320px、24rem） */
  width?: string;
  /** 圖片下方說明文字 */
  caption?: string;
}

/**
 * 簡報內可重用的圖片元件
 * 預設置中顯示，並限制最大寬高以避免溢出版面
 */
export function PresentationImage({
  src,
  alt,
  width,
  caption,
}: PresentationImageProps) {
  return (
    <figure className="slide-component-image" style={width ? { width } : undefined}>
      <img className="slide-component-image-media" src={src} alt={alt} />
      {caption ? (
        <figcaption className="slide-component-image-caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
