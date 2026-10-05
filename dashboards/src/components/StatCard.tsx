import type { ReactNode } from "react";

/** Single KPI tile: uppercase mono label, big tabular number, context line. */
export function StatCard({
  label,
  value,
  hint,
  meta,
  tone = "paper",
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  meta?: ReactNode;
  tone?: "paper" | "acid" | "amber" | "coral";
  delay?: number;
}) {
  const toneClass = tone === "paper" ? "" : ` ${tone}`;
  return (
    <div className={`card rise rise-${delay || 1}`}>
      <div className="card__label">
        <span>{label}</span>
        {hint ? <span className="hint">{hint}</span> : null}
      </div>
      <div className={`stat__value${toneClass}`}>{value}</div>
      {meta ? <div className="stat__meta">{meta}</div> : null}
    </div>
  );
}
