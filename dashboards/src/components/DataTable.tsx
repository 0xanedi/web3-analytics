import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  num?: boolean;
  render: (row: T) => ReactNode;
}

/** Generic bordered data table with zebra hover + tabular numerals. */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T, index: number) => string;
  caption?: string;
}) {
  return (
    <div className="table-wrap">
      <table className="data">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.num ? "num" : undefined} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyOf(row, i)}>
              {columns.map((col) => (
                <td key={col.key} className={col.num ? "num" : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
