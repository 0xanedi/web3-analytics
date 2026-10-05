import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { Legend, SectionHead, downsample, tickDate, tickUsd } from "../components/chart";
import { StatCard } from "../components/StatCard";
import { deltaClass, fmtDate, fmtNum, fmtPct, fmtUsd, share } from "../lib/format";
import { fetchProtocol, fetchSummary, type ProtocolDetail, type SummaryStats } from "../lib/queries";
import { useAsync } from "../lib/useAsync";

/** DefiLlama reports borrowed/staking/pool2 buckets separately — exclude them
 *  so the chart matches the TVL definition used on protocol front-ends. */
const NON_TVL_KEYS = new Set(["borrowed", "staking", "pool2", "ownTokens", "tvl"]);

interface Snapshot {
  protocol: ProtocolDetail;
  fees: SummaryStats | null;
  feesError: string | null;
}

interface ChainRow {
  name: string;
  tvl: number;
  pct: number | null;
}

export function ProtocolOverview() {
  const { data, error, loading, reload } = useAsync<Snapshot>(async () => {
    const protocol = await fetchProtocol("aave");
    let fees: SummaryStats | null = null;
    let feesError: string | null = null;
    try {
      fees = await fetchSummary("fees", "aave");
    } catch (err) {
      feesError = err instanceof Error ? err.message : String(err);
    }
    return { protocol, fees, feesError };
  }, []);

  const chains: ChainRow[] = (data
    ? Object.entries(data.protocol.currentChainTvls)
        .filter(([k]) => !NON_TVL_KEYS.has(k) && !k.includes("-"))
        .map(([name, tvl]) => ({ name, tvl }))
        .sort((a, b) => b.tvl - a.tvl)
    : []
  ).map((row) => ({ ...row, pct: share(row.tvl, data ? sum(data.protocol.currentChainTvls) : 0) }));

  const totalTvl = chains.reduce((acc, r) => acc + r.tvl, 0);

  const feeCols: Column<ChainRow>[] = [
    { key: "name", header: "Chain", render: (r) => <span className="cell-main">{r.name}</span> },
    { key: "tvl", header: "TVL (net)", num: true, render: (r) => fmtUsd(r.tvl) },
    {
      key: "pct",
      header: "Share",
      num: true,
      render: (r) => <span className="delta delta--flat">{r.pct != null ? `${r.pct.toFixed(1)}%` : "n/a"}</span>,
    },
  ];

  const feeChart = data?.fees?.chart.slice(-365) ?? [];
  // 6+ years of daily points makes a 195KB+ SVG path — stride-sample for paint
  // performance; visual shape is unchanged at this scale.
  const tvlChart = useMemo(() => downsample(data?.protocol.tvlSeries ?? [], 700), [data]);
  const priceStats = data?.fees;

  // DefiLlama returns change_1d/7d = null for some protocols (e.g. aave) —
  // fall back to the daily TVL series so the headline delta is never blank.
  // Must read the raw series: tvlChart is stride-sampled for rendering.
  const changeFrom = (back: number): number | null => {
    const series = data?.protocol.tvlSeries ?? [];
    const last = series.at(-1)?.value ?? null;
    const prev = series.at(-1 - back)?.value ?? null;
    return last != null && prev ? ((last - prev) / prev) * 100 : null;
  };
  const change1d = data?.protocol.change1d ?? changeFrom(1);
  const change7d = data?.protocol.change7d ?? changeFrom(7);

  // Aave is a parent protocol: raw.chains arrives empty — derive the live
  // chain list from currentChainTvls (same filter as the chain table).
  const aboutChains = chains.slice(0, 12).map((c) => c.name);

  // Source data contains exact duplicate hallmarks — dedupe on date+event.
  const seenHallmarks = new Set<string>();
  const hallmarks = (data?.protocol.hallmarks ?? []).filter((h: [number, string]) => {
    const key = `${h[0]}-${h[1]}`;
    if (seenHallmarks.has(key)) return false;
    seenHallmarks.add(key);
    return true;
  });

  return (
    <>
      <div className="page-head rise rise-1">
        <div className="page-head__eyebrow">
          <span>Section A</span>
          <span>Protocol overview</span>
          <span>Subject: Aave (multi-chain lending)</span>
        </div>
        <h1 className="page-head__title">
          Aave, <em>decoded</em>
        </h1>
        <p className="page-head__desc">
          One protocol, end to end: TVL trend since 2020, net deposits per chain, and fee capture. This is the
          template dashboard a client receives first — the &ldquo;3–4 days&rdquo; engagement piece. KPI definitions:
          <strong> TVL = net deposits</strong> (borrowed excluded, DefiLlama convention), fees = interest paid by
          borrowers (gross, not protocol revenue).
        </p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid--stats">
              <StatCard
                label="Aave TVL"
                hint="net deposits"
                value={fmtUsd(totalTvl)}
                meta={
                  <span className={`delta ${deltaClass(change1d)}`}>
                    {fmtPct(change1d)} 24h · {fmtPct(change7d)} 7d
                  </span>
                }
                delay={1}
              />
              <StatCard label="Chains live" value={fmtNum(chains.length)} hint="excl. borrowed" delay={2} />
              <StatCard label="Interest paid · 24h" value={fmtUsd(priceStats?.total24h ?? null)} tone="amber" delay={3} />
              <StatCard label="Interest paid · 30d" value={fmtUsd(priceStats?.total30d ?? null)} tone="amber" delay={4} />
              <StatCard label="All-time fees" value={fmtUsd(priceStats?.totalAllTime ?? null)} hint="gross" delay={5} />
            </div>

            <section className="section rise rise-2">
              <SectionHead
                title={
                  <>
                    TVL <span className="rule">/</span> since listing
                  </>
                }
                note="api.llama.fi/protocol/aave · daily"
              />
              <div className="card">
                <div className="chart chart--lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tvlChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="aaveFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6ec3ff" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#6ec3ff" stopOpacity={0.02} />
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
                        stroke="#6ec3ff"
                        strokeWidth={1.6}
                        fill="url(#aaveFill)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={[{ label: "Aave TVL (USD)", color: "#6ec3ff" }]} />
              </div>
            </section>

            <section className="section rise rise-3">
              <SectionHead
                title={
                  <>
                    Chain split <span className="rule">/</span> net deposits
                  </>
                }
                note="currentChainTvls · borrowed/staking buckets excluded"
              />
              <div className="grid grid--main">
                <div className="card">
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chains.slice(0, 12).reverse()} layout="vertical" margin={{ right: 12 }}>
                        <CartesianGrid stroke="#24322c" strokeDasharray="2 4" horizontal={false} />
                        <XAxis type="number" tickFormatter={tickUsd} />
                        <YAxis type="category" dataKey="name" width={92} />
                        <Tooltip
                          contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                          formatter={(v) => [tickUsd(Number(v)), "TVL"]}
                        />
                        <Bar dataKey="tvl" fill="#ffb454" radius={[0, 2, 2, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card card--flush">
                  <div className="table-wrap">
                    <DataTable caption="TVL per chain" columns={feeCols} rows={chains.slice(0, 14)} keyOf={(r) => r.name} />
                  </div>
                </div>
              </div>
            </section>

            <section className="section rise rise-4">
              <SectionHead
                title={
                  <>
                    Fee capture <span className="rule">/</span> interest paid, last 365 days
                  </>
                }
                note="api.llama.fi/summary/fees/aave"
              />
              <div className="card">
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={feeChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                      <YAxis tickFormatter={tickUsd} width={64} />
                      <Tooltip
                        contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                        labelFormatter={(v) => fmtDate(Number(v))}
                        formatter={(v) => [tickUsd(Number(v)), "Fees"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#ffb454"
                        strokeWidth={1.4}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={[{ label: "Daily borrower interest (USD)", color: "#ffb454" }]} />
                {data.feesError ? (
                  <p className="prose" style={{ marginTop: "0.8rem" }}>
                    Fee history unavailable: <span className="kbd">{data.feesError}</span>
                  </p>
                ) : null}
              </div>
            </section>

            <section className="section rise rise-5">
              <SectionHead title={<>About &amp; milestones</>} note="hallmarks from DefiLlama" />
              <div className="grid grid--2">
                <div className="card">
                  <div className="card__label">
                    <span>{data.protocol.name}</span>
                    <span className="hint">{data.protocol.category}</span>
                  </div>
                  <p className="prose">
                    {data.protocol.description
                      ? data.protocol.description.slice(0, 420)
                      : "No description supplied by the data source."}
                    {data.protocol.description && data.protocol.description.length > 420 ? "…" : ""}
                  </p>
                  <p className="prose" style={{ marginTop: "0.7rem" }}>
                    Chains: {aboutChains.join(", ")}
                    {chains.length > 12 ? ` +${chains.length - 12} more` : ""}
                  </p>
                </div>
                <div className="card card--flush">
                  <div className="table-wrap">
                    <DataTable
                      caption="Hallmarks"
                      columns={[
                        {
                          key: "date",
                          header: "Date",
                          render: (r: [number, string]) => <span className="tag">{fmtDate(r[0])}</span>,
                        },
                        {
                          key: "event",
                          header: "Event",
                          render: (r: [number, string]) => <span className="cell-main">{r[1]}</span>,
                        },
                      ]}
                      rows={hallmarks.slice(0, 10)}
                      keyOf={(r) => `${r[0]}-${r[1]}`}
                    />
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </AsyncSection>
    </>
  );
}

/** Sum of plain chain TVL keys (same filter as the chart). */
function sum(current: Record<string, number>): number {
  return Object.entries(current)
    .filter(([k]) => !NON_TVL_KEYS.has(k) && !k.includes("-"))
    .reduce((acc, [, v]) => acc + v, 0);
}
