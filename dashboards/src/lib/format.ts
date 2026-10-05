/** Formatting helpers — every number on screen goes through here. */

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

/** $1.23B / $45.6M / $789 / $0.45 */
export function fmtUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1) return `${sign}$${compact.format(abs)}`;
  return `${sign}$${abs.toFixed(4)}`;
}

/** Plain grouped number: 1,234,567 */
export function fmtNum(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Percentage with explicit sign: +1.23% */
export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/** Price with sensible precision */
export function fmtPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

/** Unix seconds -> "2026-10-04" */
export function fmtDate(unixSeconds: number | number[]): string {
  const seconds = Array.isArray(unixSeconds) ? unixSeconds[0] : unixSeconds;
  if (!seconds) return "n/a";
  const ms = seconds > 1e12 ? seconds : seconds * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO string -> "2026-12-31" (Polymarket endDate) */
export function fmtIsoDate(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  return iso.slice(0, 10);
}

/** Day distance from now, signed: "+14d" / "-3d" */
export function fmtDaysAway(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  const sign = days >= 0 ? "+" : "-";
  return `${sign}${Math.abs(days).toFixed(0)}d`;
}

/** delta class for the up/down coloring */
export function deltaClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value === 0) return "delta--flat";
  return value > 0 ? "delta--up" : "delta--down";
}

/** Truncate an address for display: 0x1234…abcd */
export function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr ?? "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Sum an array with null-safety */
export function sum(values: (number | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/** Percentage part/whole with null-safety */
export function share(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (part == null || whole == null || whole === 0) return null;
  return (part / whole) * 100;
}
