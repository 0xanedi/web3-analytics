import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AsyncSection } from "../components/AsyncSection";
import { DataTable, type Column } from "../components/DataTable";
import { Legend, SectionHead, downsample, tickDate, tickUsd } from "../components/chart";
import { StatCard } from "../components/StatCard";
import { DASHBOARDS } from "../lib/config";
import { deltaClass, fmtNum, fmtPct, fmtUsd } from "../lib/format";
import {
  fetchChains,
  fetchGlobalTvlSeries,
  fetchOverview,
  fetchStablecoins,
  type ChainTvl,
  type DatePoint,
  type OverviewRow,
  type StableAsset,
} from "../lib/queries";
import { useAsync } from "../lib/useAsync";

interface Snapshot {
  tvl: DatePoint[];
  chains: ChainTvl[];
  dexs: OverviewRow[];
  dexTotals24h: number | null;
  fees: OverviewRow[];
  feeTotals24h: number | null;
  stables: StableAsset[];
  stableTotal: number;
  stableCount: number;
}

export function MarketPulse() {
  const { data, error, loading, reload } = useAsync<Snapshot>(async () => {
    const [tvl, chains, dexOverview, feeOverview, stables] = await Promise.all([
      fetchGlobalTvlSeries(),
      fetchChains(),
      fetchOverview("dexs"),
      fetchOverview("fees"),
      fetchStablecoins(),
    ]);
    return {
      tvl,
      chains,
      dexs: dexOverview.protocols.slice(0, 8),
      dexTotals24h: dexOverview.totals.total24h,
      fees: feeOverview.protocols.slice(0, 8),
      feeTotals24h: feeOverview.totals.total24h,
      stables: stables.assets.slice(0, 8),
      stableTotal: stables.total,
      stableCount: stables.assets.length,
    };
  }, []);

  const last = data?.tvl.at(-1);
  const prev = data?.tvl.at(-2);
  const tvlChange = last && prev ? ((last.value - prev.value) / prev.value) * 100 : null;
  const tvlChart = useMemo(() => downsample(data?.tvl ?? [], 900), [data]);

  const dexCols: Column<OverviewRow>[] = [
    { key: "name", header: "Protocol", render: (r) => <span className="cell-main">{r.name}</span> },
    { key: "c24", header: "24h volume", num: true, render: (r) => fmtUsd(r.total24h) },
    { key: "c7", header: "7d", num: true, render: (r) => fmtUsd(r.total7d) },
    { key: "c30", header: "30d", num: true, render: (r) => fmtUsd(r.total30d) },
    {
      key: "ch",
      header: "Δ 24h",
      num: true,
      render: (r) => <span className={`delta ${deltaClass(r.change1d)}`}>{fmtPct(r.change1d)}</span>,
    },
  ];

  const feeCols: Column<OverviewRow>[] = [
    { key: "name", header: "Protocol", render: (r) => <span className="cell-main">{r.name}</span> },
    { key: "f24", header: "24h fees", num: true, render: (r) => fmtUsd(r.total24h) },
    { key: "f30", header: "30d", num: true, render: (r) => fmtUsd(r.total30d) },
    { key: "fall", header: "All-time", num: true, render: (r) => fmtUsd(r.totalAllTime) },
    {
      key: "ch",
      header: "Δ 24h",
      num: true,
      render: (r) => <span className={`delta ${deltaClass(r.change1d)}`}>{fmtPct(r.change1d)}</span>,
    },
  ];

  const stableCols: Column<StableAsset>[] = [
    { key: "name", header: "Stablecoin", render: (r) => <span className="cell-main">{r.name}</span> },
    { key: "sym", header: "Ticker", render: (r) => <span className="tag">{r.symbol}</span> },
    { key: "circ", header: "Circulation", num: true, render: (r) => fmtUsd(r.circulating) },
    {
      key: "d1",
      header: "Δ 24h",
      num: true,
      render: (r) => {
        if (r.circulating == null || r.prevDay == null || r.prevDay === 0) return "n/a";
        const pct = ((r.circulating - r.prevDay) / r.prevDay) * 100;
        return <span className={`delta ${deltaClass(pct)}`}>{fmtPct(pct)}</span>;
      },
    },
    { key: "price", header: "Peg", num: true, render: (r) => (r.price != null ? `$${r.price.toFixed(4)}` : "n/a") },
  ];

  return (
    <>
      <div className="page-head rise rise-1">
        <div className="page-head__eyebrow">
          <span>Section A</span>
          <span>Protocol overview</span>
          <span>Source: api.llama.fi</span>
        </div>
        <h1 className="page-head__title">
          Market <em>Pulse</em>
        </h1>
        <p className="page-head__desc">
          The state of DeFi in one screen: total value locked across {fmtNum(data?.chains.length ?? 0)} tracked
          chains, where swaps happen, who earns fees, and how many dollars are in circulation. Every number is a
          live keyless API query — view-source or read the query layer in the repo.
        </p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid--stats">
              <StatCard
                label="Global TVL"
                hint="Σ 9y history"
                value={fmtUsd(last?.value)}
                meta={
                  <span className={`delta ${deltaClass(tvlChange)}`}>{fmtPct(tvlChange)} vs yesterday</span>
                }
                delay={1}
              />
              <StatCard label="DEX volume · 24h" value={fmtUsd(data.dexTotals24h)} hint="all chains" delay={2} />
              <StatCard label="Protocol fees · 24h" value={fmtUsd(data.feeTotals24h)} tone="amber" delay={3} />
              <StatCard
                label="Stablecoin supply"
                value={fmtUsd(data.stableTotal)}
                hint={`${data.stableCount} assets`}
                meta="dollar liquidity on-chain"
                delay={4}
              />
              <StatCard
                label="Tracked chains"
                value={fmtNum(data.chains.length)}
                hint={`top: ${data.chains[0]?.name ?? "n/a"}`}
                delay={5}
              />
            </div>

            <section className="section rise rise-2">
              <SectionHead
                title={
                  <>
                    Total value locked <span className="rule">/</span> all chains
                  </>
                }
                note="api.llama.fi/v2/historicalChainTvl · daily"
              />
              <div className="card">
                <div className="chart chart--lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tvlChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tvlFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#c6f135" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#c6f135" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                      <YAxis tickFormatter={tickUsd} width={64} />
                      <Tooltip
                        contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                        labelFormatter={(v) => tickDate(Number(v))}
                        formatter={(v) => [tickUsd(Number(v)), "TVL"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#c6f135"
                        strokeWidth={1.6}
                        fill="url(#tvlFill)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={[{ label: "Global TVL (USD)", color: "#c6f135" }]} />
              </div>
            </section>

            <section className="section rise rise-3">
              <SectionHead
                title={<>Where the liquidity lives</>}
                note="top 10 chains by TVL"
              />
              <div className="grid grid--2">
                <div className="card">
                  <div className="card__label">
                    <span>Chain TVL</span>
                    <span className="hint">/v2/chains</span>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.chains.slice(0, 10).reverse()}
                        layout="vertical"
                        margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid stroke="#24322c" strokeDasharray="2 4" horizontal={false} />
                        <XAxis type="number" tickFormatter={tickUsd} />
                        <YAxis type="category" dataKey="name" width={86} />
                        <Tooltip
                          contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                          formatter={(v) => [tickUsd(Number(v)), "TVL"]}
                        />
                        <Bar dataKey="tvl" fill="#6ec3ff" radius={[0, 2, 2, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card card--flush">
                  <div className="table-wrap">
                    <DataTable
                      caption="Top stablecoins by circulation"
                      columns={stableCols}
                      rows={data.stables}
                      keyOf={(r) => r.symbol}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="section rise rise-4">
              <SectionHead
                title={
                  <>
                    Flow &amp; fee leaders <span className="rule">/</span> 24h
                  </>
                }
                note="overview/dexs · overview/fees"
              />
              <div className="grid grid--2">
                <div className="card card--flush">
                  <div className="table-wrap">
                    <DataTable caption="Top DEX by volume" columns={dexCols} rows={data.dexs} keyOf={(r) => r.name} />
                  </div>
                </div>
                <div className="card card--flush">
                  <div className="table-wrap">
                    <DataTable
                      caption="Top fee generators"
                      columns={feeCols}
                      rows={data.fees}
                      keyOf={(r) => r.name}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="section rise rise-5">
              <SectionHead title={<>The rest of the ledger</>} note="6 deep-dive dashboards" />
              <div className="grid grid--stats">
                {DASHBOARDS.filter((d) => d.slug !== "/").map((d) => (
                  <Link key={d.slug} to={d.slug} className="card" style={{ display: "block", borderBottom: "none" }}>
                    <div className="card__label">
                      <span>Section {d.section}</span>
                      <span className="hint">→</span>
                    </div>
                    <div className="stat__value" style={{ fontSize: "1.15rem" }}>
                      {d.name}
                    </div>
                    <div className="stat__meta">{d.desc}</div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </AsyncSection>
    </>
  );
}
