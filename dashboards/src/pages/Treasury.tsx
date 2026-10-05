import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AsyncSection } from "../components/AsyncSection";
import { DataTable, type Column } from "../components/DataTable";
import { Legend, SectionHead, tickDate, tickUsd } from "../components/chart";
import { StatCard } from "../components/StatCard";
import { fmtDate, fmtUsd, share } from "../lib/format";
import { fetchTreasury, type TreasurySnapshot } from "../lib/queries";
import { useAsync } from "../lib/useAsync";

interface ChainRow {
  name: string;
  external: number;
  ownTokens: number;
  total: number;
  pct: number | null;
}

export function Treasury() {
  const { data, error, loading, reload } = useAsync<TreasurySnapshot>(() => fetchTreasury("lido"), []);

  /** Merge external + own series into one stacked-area dataset. */
  const stacked = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<number, { date: number; external: number; own: number }>();
    for (const p of data.externalSeries) byDate.set(p.date, { date: p.date, external: p.value, own: 0 });
    for (const p of data.ownSeries) {
      const entry = byDate.get(p.date) ?? { date: p.date, external: 0, own: 0 };
      entry.own = p.value;
      byDate.set(p.date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.date - b.date);
  }, [data]);

  const chains: ChainRow[] = useMemo(() => {
    if (!data) return [];
    return data.chains
      .map((c) => ({
        ...c,
        total: c.external + c.ownTokens,
        pct: share(c.external + c.ownTokens, data.current.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const ownPct = data ? (data.current.ownTokens / data.current.total) * 100 : 0;
  const mcapRatio =
    data && data.mcap ? (data.current.total / data.mcap) * 100 : null;

  const chainCols: Column<ChainRow>[] = [
    { key: "n", header: "Chain", render: (r) => <span className="cell-main">{r.name}</span> },
    { key: "e", header: "External assets", num: true, render: (r) => fmtUsd(r.external) },
    { key: "o", header: "Own tokens (LDO)", num: true, render: (r) => fmtUsd(r.ownTokens) },
    { key: "t", header: "Total", num: true, render: (r) => fmtUsd(r.total) },
    {
      key: "p",
      header: "Share",
      num: true,
      render: (r) => <span className="delta delta--flat">{r.pct != null ? `${r.pct.toFixed(1)}%` : "n/a"}</span>,
    },
  ];

  return (
    <>
      <div className="page-head rise rise-1">
        <div className="page-head__eyebrow">
          <span>Section F</span>
          <span>Treasury &amp; funding</span>
          <span>Subject: Lido DAO</span>
        </div>
        <h1 className="page-head__title">
          Treasury <em>runway</em>
        </h1>
        <p className="page-head__desc">
          How much the DAO controls, how much of it is its own token vs. liquid assets, and the milestones that
          moved it. Source methodology risk item: <strong>position addresses</strong> — DefiLlama treasury
          adapters aggregate disclosed wallets; own-token vs. external buckets are kept separate to avoid
          double-counting.
        </p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid--stats">
              <StatCard label="Treasury total" value={fmtUsd(data.current.total)} hint="all chains" delay={1} />
              <StatCard
                label="Own tokens (LDO)"
                value={`${ownPct.toFixed(1)}%`}
                tone="coral"
                hint={fmtUsd(data.current.ownTokens)}
                meta="price-dependent"
                delay={2}
              />
              <StatCard
                label="Liquid / external"
                value={`${(100 - ownPct).toFixed(1)}%`}
                tone="acid"
                hint={fmtUsd(data.current.external)}
                meta="stables, ETH, LP positions"
                delay={3}
              />
              <StatCard
                label="Treasury ÷ LDO mcap"
                value={mcapRatio != null ? `${mcapRatio.toFixed(1)}%` : "n/a"}
                tone="amber"
                hint={fmtUsd(data.mcap)}
                delay={4}
              />
              <StatCard label="Chains held" value={String(chains.length)} hint="disclosed wallets" delay={5} />
            </div>

            <section className="section rise rise-2">
              <SectionHead
                title={
                  <>
                    Treasury value <span className="rule">/</span> external vs own tokens
                  </>
                }
                note="api.llama.fi/treasury/lido · daily"
              />
              <div className="card">
                <div className="chart chart--lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stacked} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="extFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6ec3ff" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6ec3ff" stopOpacity={0.04} />
                        </linearGradient>
                        <linearGradient id="ownFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ff6b57" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#ff6b57" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                      <YAxis tickFormatter={tickUsd} width={64} />
                      <Tooltip
                        contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                        labelFormatter={(v) => tickDate(Number(v))}
                        formatter={(v) => [tickUsd(Number(v)), ""]}
                      />
                      <Area
                        type="monotone"
                        dataKey="external"
                        stackId="1"
                        stroke="#6ec3ff"
                        strokeWidth={1.2}
                        fill="url(#extFill)"
                        isAnimationActive={false}
                        name="External assets"
                      />
                      <Area
                        type="monotone"
                        dataKey="own"
                        stackId="1"
                        stroke="#ff6b57"
                        strokeWidth={1.2}
                        fill="url(#ownFill)"
                        isAnimationActive={false}
                        name="Own tokens (LDO)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Legend
                  items={[
                    { label: "External assets (stables, ETH, LP)", color: "#6ec3ff" },
                    { label: "Own tokens (LDO)", color: "#ff6b57" },
                  ]}
                />
              </div>
            </section>

            <section className="section rise rise-3">
              <SectionHead title={<>Positions</>} note="currentChainTvls · no double counting" />
              <div className="grid grid--main">
                <div className="card card--flush">
                  <div className="table-wrap">
                    <DataTable caption="Treasury positions per chain" columns={chainCols} rows={chains} keyOf={(r) => r.name} />
                  </div>
                </div>
                <div className="card">
                  <div className="card__label">
                    <span>Funding</span>
                    <span className="hint">DefiLlama raises</span>
                  </div>
                  <p className="prose">
                    No traditional VC rounds are recorded for Lido — the protocol is DAO-funded, with runway
                    dependent on liquid staking fee capture rather than a balance-sheet raise. Contrast with{" "}
                    <strong>Polymarket (Section B)</strong>, which shows $1B+ raised across rounds at a $9B
                    valuation.
                  </p>
                  <hr className="hr-dash" />
                  <div className="card__label">
                    <span>Why own tokens matter</span>
                    <span className="hint">risk note</span>
                  </div>
                  <p className="prose">
                    {ownPct.toFixed(1)}% of treasury value moves with LDO — a drawdown shrinks runway
                    proportionally. The &ldquo;liquid&rdquo; slice is what can be spent without selling the
                    governance token. DefiLlama marks valuation by last-updated price; QA doc reconciles against
                    the treasury page.
                  </p>
                </div>
              </div>
            </section>

            <section className="section rise rise-4">
              <SectionHead title={<>Milestones</>} note="hallmarks — stress events included" />
              <div className="card card--flush">
                <div className="table-wrap">
                  <DataTable
                    caption="Lido hallmarks"
                    columns={[
                      { key: "d", header: "Date", render: (r: [number, string]) => <span className="tag">{fmtDate(r[0])}</span> },
                      { key: "e", header: "Event", render: (r: [number, string]) => <span className="cell-main">{r[1]}</span> },
                    ]}
                    rows={data.hallmarks}
                    keyOf={(r) => `${r[0]}`}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </AsyncSection>
    </>
  );
}
