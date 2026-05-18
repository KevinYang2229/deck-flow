interface PresentationButtonProps {
  /** 按鈕文字 */
  label: string;
  /** 點擊後開啟的連結 */
  href?: string;
}

/**
 * 簡報內可重用的按鈕元件
 */
export function PresentationButton({ label, href }: PresentationButtonProps) {
  if (href) {
    return (
      <a
        className="slide-component-button"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {label}
      </a>
    );
  }

  return (
    <button className="slide-component-button" type="button">
      {label}
    </button>
  );
}
