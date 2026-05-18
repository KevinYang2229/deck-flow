import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

interface PresentationTableProps extends HTMLAttributes<HTMLTableElement> {
  /** 表格內容（thead / tbody） */
  children?: ReactNode;
}

/**
 * 簡報內的表格元件
 * 統一掛入 `slide-component-table` class，供 CSS 與後續客製樣式擴充
 */
export function PresentationTable({
  children,
  className,
  ...rest
}: PresentationTableProps) {
  const composedClassName = ["slide-component-table", className]
    .filter(Boolean)
    .join(" ");
  return (
    <table className={composedClassName} {...rest}>
      {children}
    </table>
  );
}

/** 表頭區塊 */
export function PresentationTableHead({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  const composedClassName = ["slide-component-table-head", className]
    .filter(Boolean)
    .join(" ");
  return (
    <thead className={composedClassName} {...rest}>
      {children}
    </thead>
  );
}

/** 表身區塊 */
export function PresentationTableBody({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  const composedClassName = ["slide-component-table-body", className]
    .filter(Boolean)
    .join(" ");
  return (
    <tbody className={composedClassName} {...rest}>
      {children}
    </tbody>
  );
}

/** 表格列 */
export function PresentationTableRow({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  const composedClassName = ["slide-component-table-row", className]
    .filter(Boolean)
    .join(" ");
  return (
    <tr className={composedClassName} {...rest}>
      {children}
    </tr>
  );
}

/** 表頭欄位 */
export function PresentationTableHeaderCell({
  children,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  const composedClassName = ["slide-component-table-th", className]
    .filter(Boolean)
    .join(" ");
  return (
    <th className={composedClassName} {...rest}>
      {children}
    </th>
  );
}

/** 表身欄位 */
export function PresentationTableCell({
  children,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  const composedClassName = ["slide-component-table-td", className]
    .filter(Boolean)
    .join(" ");
  return (
    <td className={composedClassName} {...rest}>
      {children}
    </td>
  );
}
