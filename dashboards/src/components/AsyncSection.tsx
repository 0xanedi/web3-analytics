import type { ReactNode } from "react";

/** Loading / error / retry wrapper used by every data section. */
export function AsyncSection({
  loading,
  error,
  onRetry,
  children,
  minHeight,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
  minHeight?: number;
}) {
  if (loading) {
    return (
      <div className="state" style={minHeight ? { minHeight } : undefined} role="status" aria-live="polite">
        <div className="state__spinner" aria-hidden="true" />
        <span>Fetching on-chain data…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="state state--error" style={minHeight ? { minHeight } : undefined} role="alert">
        <span>Source unreachable — {error}</span>
        <button className="retry-btn" onClick={onRetry} type="button">
          Retry query
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
