import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AsyncSection } from "../components/AsyncSection";
import { DataTable, type Column } from "../components/DataTable";
import { Legend, SectionHead, tickDate, tickUsd } from "../components/chart";
import { StatCard } from "../components/StatCard";
import { deltaClass, fmtNum, fmtPct, fmtUsd, sum } from "../lib/format";
import {
  fetchChainTvlSeries,
  fetchChains,
  fetchOverview,
  fetchStablecoins,
  type ChainTvl,
  type DatePoint,
  type OverviewTotals,
  type StableAsset,
} from "../lib/queries";
import { useAsync } from "../lib/useAsync";

const SERIES_COLORS = ["#c6f135", "#6ec3ff", "#ffb454", "#7fe3c0", "#ff6b57", "#d9a7ff"];
const MAX_SELECTED = 6;

interface ChainBlock {
  tvlSeries: DatePoint[];
  dexTotals: OverviewTotals | null;
  feeTotals: OverviewTotals | null;
}

interface Snapshot {
  chains: ChainTvl[];
  globalDex: OverviewTotals;
  stables: StableAsset[];
  stableTotal: number;
  blocks: Record<string, ChainBlock>;
}

interface Row {
  chain: ChainTvl;
  change7d: number | null;
  dex24h: number | null;
  fee24h: number | null;
  efficiency: number | null; // DEX volume / TVL, %
}

/** Curated default set — majors with full metric coverage (a registration-order
 *  slice would open on micro-chains; /v2/chains is not TVL-sorted). */
const DEFAULT_CHAINS = ["Ethereum", "Solana", "Base", "Arbitrum", "BSC"];

export function ChainComparison() {
  const [selected, setSelected] = useState<string[]>(DEFAULT_CHAINS);

  const { data, error, loading, reload } = useAsync<Snapshot>(
    async () => {
      const [chains, globalDex, stables] = await Promise.all([
        fetchChains(),
        fetchOverview("dexs"),
        fetchStablecoins(),
      ]);

      // Default selection: top 5 chains, until the user picks their own set.
      const chosen = selected.length > 0 ? selected : chains.slice(0, 5).map((c) => c.name);

      const blocks: Record<string, ChainBlock> = {};
      await Promise.all(
        chosen.map(async (name) => {
          const [tvlSeries, dex, fee] = await Promise.allSettled([
            fetchChainTvlSeries(name),
            fetchOverview("dexs", name),
            fetchOverview("fees", name),
          ]);
          blocks[name] = {
            tvlSeries: tvlSeries.status === "fulfilled" ? tvlSeries.value : [],
            dexTotals: dex.status === "fulfilled" ? dex.value.totals : null,
            feeTotals: fee.status === "fulfilled" ? fee.value.totals : null,
          };
        }),
      );

      return {
        chains,
        globalDex: globalDex.totals,
        stables: stables.assets.slice(0, 6),
        stableTotal: stables.total,
        blocks,
      };
    },
    [selected.join("|")],
  );

  const activeNames = selected.length > 0 ? selected : (data?.chains.slice(0, 5).map((c) => c.name) ?? []);

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    return activeNames
      .map((name) => {
        const chain = data.chains.find((c) => c.name === name);
        if (!chain) return null;
        const block = data.blocks[name];
        const series = block?.tvlSeries ?? [];
        const now = series.at(-1)?.value ?? chain.tvl;
        const weekAgo = series.at(-8)?.value ?? null;
        return {
          chain,
          change7d: weekAgo ? ((now - weekAgo) / weekAgo) * 100 : null,
          dex24h: block?.dexTotals?.total24h ?? null,
          fee24h: block?.feeTotals?.total24h ?? null,
          efficiency: block?.dexTotals?.total24h && chain.tvl ? (block.dexTotals.total24h / chain.tvl) * 100 : null,
        } satisfies Row;
      })
      .filter((r): r is Row => r !== null);
  }, [data, activeNames]);

  /** Multi-line TVL history, last 365 days, one line per selected chain. */
  const lineData = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<number, Record<string, number>>();
    activeNames.forEach((name, i) => {
      const key = `c${i}`;
      const series = (data.blocks[name]?.tvlSeries ?? []).slice(-365);
      for (const p of series) {
        const entry = byDate.get(p.date) ?? { date: p.date };
        entry[key] = p.value;
        byDate.set(p.date, entry);
      }
    });
    return [...byDate.values()].sort((a, b) => a.date - b.date);
  }, [data, activeNames]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const base = prev.length > 0 ? prev : (data?.chains.slice(0, 5).map((c) => c.name) ?? []);
      if (base.includes(name)) {
        if (base.length === 1) return base; // keep at least one
        return base.filter((n) => n !== name);
      }
      if (base.length >= MAX_SELECTED) return [...base.slice(1), name];
      return [...base, name];
    });
  };

  const tableCols: Column<Row>[] = [
    {
      key: "name",
      header: "Chain",
      render: (r) => (
        <div>
          <span className="cell-main">{r.chain.name}</span>
          <div className="cell-sub">{r.chain.tokenSymbol ?? "—"}{r.chain.chainId ? ` · id ${r.chain.chainId}` : ""}</div>
        </div>
      ),
    },
    { key: "tvl", header: "TVL", num: true, render: (r) => fmtUsd(r.chain.tvl) },
    {
      key: "ch7",
      header: "Δ 7d",
      num: true,
      render: (r) => <span className={`delta ${deltaClass(r.change7d)}`}>{fmtPct(r.change7d)}</span>,
    },
    { key: "dex", header: "DEX vol 24h", num: true, render: (r) => fmtUsd(r.dex24h) },
    {
      key: "eff",
      header: "Vol / TVL",
      num: true,
      render: (r) => <span className="delta delta--flat">{r.efficiency != null ? `${r.efficiency.toFixed(2)}%` : "n/a"}</span>,
    },
    { key: "fee", header: "Fees 24h", num: true, render: (r) => fmtUsd(r.fee24h) },
  ];

  const stableCols: Column<StableAsset>[] = [
    { key: "n", header: "Stablecoin", render: (r) => <span className="cell-main">{r.name}</span> },
    { key: "c", header: "Circulation", num: true, render: (r) => fmtUsd(r.circulating) },
    {
      key: "d",
      header: "Δ 24h",
      num: true,
      render: (r) => {
        if (r.circulating == null || !r.prevDay) return "n/a";
        const pct = ((r.circulating - r.prevDay) / r.prevDay) * 100;
        return <span className={`delta ${deltaClass(pct)}`}>{fmtPct(pct)}</span>;
      },
    },
  ];

  const pickerChains = data?.chains.slice(0, 14) ?? [];
  const selectedSet = new Set(activeNames);

  return (
    <>
      <div className="page-head rise rise-1">
        <div className="page-head__eyebrow">
          <span>Section G</span>
          <span>Chain comparison</span>
          <span>max 6 chains selected</span>
        </div>
        <h1 className="page-head__title">
          Chain vs chain, <em>same yardstick</em>
        </h1>
        <p className="page-head__desc">
          Compare ecosystems on identical KPIs: TVL depth, 7-day momentum, DEX volume, capital efficiency
          (volume ÷ TVL), fee capture and stablecoin liquidity. This is the source methodology&rsquo;s
          comparison funnel, driven entirely by live queries.
        </p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <section className="section rise rise-2" style={{ marginTop: 0 }}>
              <SectionHead title={<>Select chains</>} note={`${selectedSet.size || 5} of ${MAX_SELECTED} slots used`} />
              <div className="card">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {pickerChains.map((c) => {
                    const active = selectedSet.has(c.name);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => toggle(c.name)}
                        className="retry-btn"
                        aria-pressed={active}
                        style={
                          active
                            ? { borderColor: "#c6f135", color: "#0a0e0d", background: "#c6f135", fontWeight: 600 }
                            : undefined
                        }
                      >
                        {c.name} <span style={{ opacity: 0.6 }}>{fmtUsd(c.tvl)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="grid grid--stats rise rise-2">
              <StatCard
                label="Selected TVL"
                value={fmtUsd(sum(rows.map((r) => r.chain.tvl)))}
                hint={`${rows.length} chains`}
                delay={1}
              />
              <StatCard
                label="Global DEX volume · 24h"
                value={fmtUsd(data.globalDex.total24h)}
                hint="all chains"
                delay={2}
              />
              <StatCard
                label="Top chain"
                value={data.chains[0]?.name ?? "n/a"}
                hint={fmtUsd(data.chains[0]?.tvl)}
                tone="amber"
                delay={3}
              />
              <StatCard
                label="Stablecoin supply"
                value={fmtUsd(data.stableTotal)}
                hint="dollar liquidity"
                delay={4}
              />
              <StatCard
                label="Chains tracked"
                value={fmtNum(data.chains.length)}
                hint="api.llama.fi"
                delay={5}
              />
            </div>

            <section className="section rise rise-3">
              <SectionHead
                title={
                  <>
                    TVL momentum <span className="rule">/</span> last 365 days
                  </>
                }
                note="v2/historicalChainTvl/{chain} · daily"
              />
              <div className="card">
                <div className="chart chart--lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                      <YAxis tickFormatter={tickUsd} width={64} />
                      <Tooltip
                        contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                        labelFormatter={(v) => tickDate(Number(v))}
                        formatter={(v, name) => [tickUsd(Number(v)), String(name ?? "")]}
                      />
                      {activeNames.map((name, i) => (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={`c${i}`}
                          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                          strokeWidth={1.6}
                          dot={false}
                          isAnimationActive={false}
                          name={name}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <Legend
                  items={activeNames.map((name, i) => ({
                    label: name,
                    color: SERIES_COLORS[i % SERIES_COLORS.length],
                  }))}
                />
              </div>
            </section>

            <section className="section rise rise-4">
              <SectionHead
                title={
                  <>
                    Scoreboard <span className="rule">/</span> identical KPIs
                  </>
                }
                note="overview/dexs + overview/fees filtered per chain"
              />
              <div className="card card--flush">
                <div className="table-wrap">
                  <DataTable caption="Chain comparison" columns={tableCols} rows={rows} keyOf={(r) => r.chain.name} />
                </div>
              </div>
              <p className="prose" style={{ marginTop: "0.8rem" }}>
                <strong>Vol / TVL</strong> is capital efficiency: higher means more swap flow per dollar of
                locked liquidity. <strong>Fees 24h</strong> covers protocol fee generators on that chain.
                7-day momentum comes from the chain TVL series (last point vs 7 points back).
              </p>
            </section>

            <section className="section rise rise-5">
              <SectionHead
                title={
                  <>
                    Dollar liquidity <span className="rule">/</span> stablecoin supply
                  </>
                }
                note="stablecoins.llama.fi"
              />
              <div className="card card--flush">
                <div className="table-wrap">
                  <DataTable
                    caption="Top stablecoins"
                    columns={stableCols}
                    rows={data.stables}
                    keyOf={(r) => r.symbol}
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
