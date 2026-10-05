import type { ReactNode } from "react";

/** Section header used above every chart/table block. */
export function SectionHead({ title, note }: { title: ReactNode; note?: ReactNode }) {
  return (
    <div className="section__head">
      <h2 className="section__title">{title}</h2>
      {note ? <span className="section__note">{note}</span> : null}
    </div>
  );
}

/** Formatters shared by all Recharts axes/tooltips. */
export const tickUsd = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export const tickDate = (value: number): string => {
  const ms = value > 1e12 ? value : value * 1000;
  return new Date(ms).toISOString().slice(0, 7); // YYYY-MM
};

export const tickPct = (value: number): string => `${value.toFixed(2)}%`;

/** Legend line rendered under charts (styled dots, mono caps). */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend-line">
      {items.map((item) => (
        <span key={item.label}>
          <span className="dot" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Stride-sample a series so multi-year daily data does not emit 100KB+ SVG
 *  paths (paint cost, and blank first raster on slower machines). Keeps the
 *  last point so the chart's right edge stays truthful. */
export function downsample<T>(series: T[], maxPoints: number): T[] {
  if (series.length <= maxPoints) return series;
  const stride = Math.ceil(series.length / maxPoints);
  const out = series.filter((_, i) => i % stride === 0);
  const last = series.at(-1);
  if (last !== undefined && out.at(-1) !== last) out.push(last);
  return out;
}
