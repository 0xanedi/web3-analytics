import { useMemo } from "react";
import {
  Area,
  AreaChart,
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
import { deltaClass, fmtPct, fmtPrice, fmtUsd, sum } from "../lib/format";
import {
  fetchMarketChart,
  fetchOverview,
  fetchSummary,
  rollingAverage,
  type OverviewRow,
  type PricePoint,
  type SummaryStats,
} from "../lib/queries";
import { useAsync } from "../lib/useAsync";

interface Snapshot {
  volume: SummaryStats;
  fees: SummaryStats;
  dexRows: OverviewRow[];
  feeRows: OverviewRow[];
  uniPrice: PricePoint[];
  uniError: string | null;
}

interface FamilyRow extends OverviewRow {
  fee24h: number | null;
}

const UNISWAP_RE = /uniswap/i;

export function SpotFees() {
  const { data, error, loading, reload } = useAsync<Snapshot>(async () => {
    const [volume, fees, dexOverview, feeOverview] = await Promise.all([
      fetchSummary("dexs", "uniswap-v3"),
      fetchSummary("fees", "uniswap-v3"),
      fetchOverview("dexs"),
      fetchOverview("fees"),
    ]);
    let uniPrice: PricePoint[] = [];
    let uniError: string | null = null;
    try {
      uniPrice = await fetchMarketChart("uniswap", 90);
    } catch (err) {
      uniError = err instanceof Error ? err.message : String(err);
    }
    return {
      volume,
      fees,
      dexRows: dexOverview.protocols.filter((r) => UNISWAP_RE.test(r.name)),
      feeRows: feeOverview.protocols.filter((r) => UNISWAP_RE.test(r.name)),
      uniPrice,
      uniError,
    };
  }, []);

  const famVol24 = useMemo(() => sum(data?.dexRows.map((r) => r.total24h) ?? []), [data]);
  const famFee24 = useMemo(() => sum(data?.feeRows.map((r) => r.total24h) ?? []), [data]);
  const effectiveRate = famVol24 > 0 ? (famFee24 / famVol24) * 100 : null;

  const uniNow = data?.uniPrice.at(-1)?.p ?? null;
  const twapSeries = useMemo(() => (data ? rollingAverage(data.uniPrice, 7) : []), [data]);
  const uniTwap = twapSeries.at(-1)?.p ?? null;
  const vsTwap = uniNow != null && uniTwap ? ((uniNow - uniTwap) / uniTwap) * 100 : null;

  const priceChart = useMemo(
    () =>
      (data?.uniPrice ?? []).map((p, i) => ({
        t: p.t,
        price: p.p,
        twap: twapSeries[i]?.p,
      })),
    [data, twapSeries],
  );

  const familyCols: Column<FamilyRow>[] = [
    { key: "n", header: "Deployment", render: (r) => <span className="cell-main">{r.name}</span> },
    { key: "c", header: "Chains", render: (r) => <span className="cell-sub">{r.chains.slice(0, 4).join(", ")}</span> },
    { key: "v", header: "Volume 24h", num: true, render: (r) => fmtUsd(r.total24h) },
    { key: "f", header: "Fees 24h", num: true, render: (r) => fmtUsd(r.fee24h) },
    {
      key: "d",
      header: "Δ 24h",
      num: true,
      render: (r) => <span className={`delta ${deltaClass(r.change1d)}`}>{fmtPct(r.change1d)}</span>,
    },
  ];

  /** Join overview/dexs rows with overview/fees rows on display name. */
  const familyRows: FamilyRow[] = (data?.dexRows ?? []).map((row) => ({
    ...row,
    fee24h: data?.feeRows.find((f) => f.name === row.name)?.total24h ?? null,
  }));

  const vol180 = data?.volume.chart.slice(-180) ?? [];
  const fee180 = data?.fees.chart.slice(-180) ?? [];

  return (
    <>
      <div className="page-head rise rise-1">
        <div className="page-head__eyebrow">
          <span>Section C</span>
          <span>Spot &amp; fees</span>
          <span>Subject: Uniswap</span>
        </div>
        <h1 className="page-head__title">
          The fee switch, <em>measured</em>
        </h1>
        <p className="page-head__desc">
          UMIA/USDC in the source engagement; Uniswap here. Spot volume and liquidity, LP fees generated daily,
          the <strong>observed effective fee rate</strong> (fees ÷ volume), and UNI price versus a{" "}
          <strong>7-day TWAP</strong>. Risk item carried over: hooks and the protocol fee switch.
        </p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid--stats">
              <StatCard label="Family volume · 24h" value={fmtUsd(famVol24)} hint="v2+v3+v4 rows" delay={1} />
              <StatCard label="LP fees · 24h" value={fmtUsd(famFee24)} tone="amber" hint="paid to LPs" delay={2} />
              <StatCard
                label="Effective fee rate"
                value={effectiveRate != null ? `${effectiveRate.toFixed(3)}%` : "n/a"}
                hint="fees ÷ volume"
                tone="acid"
                meta="observed, blended across pools"
                delay={3}
              />
              <StatCard label="UNI spot" value={fmtPrice(uniNow)} hint="coingecko:uniswap" delay={4} />
              <StatCard
                label="UNI vs 7d TWAP"
                value={vsTwap != null ? fmtPct(vsTwap) : "n/a"}
                tone={vsTwap != null && vsTwap >= 0 ? "acid" : "coral"}
                hint={uniTwap != null ? `TWAP ${fmtPrice(uniTwap)}` : "n/a"}
                delay={5}
              />
            </div>

            <section className="section rise rise-2">
              <SectionHead
                title={
                  <>
                    Uniswap v3 <span className="rule">/</span> daily volume, last 180 days
                  </>
                }
                note="api.llama.fi/summary/dexs/uniswap-v3"
              />
              <div className="card">
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={vol180} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="uniVolFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#c6f135" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#c6f135" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                      <YAxis tickFormatter={tickUsd} width={64} />
                      <Tooltip
                        contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                        labelFormatter={(v) => tickDate(Number(v))}
                        formatter={(v) => [tickUsd(Number(v)), "Volume"]}
                      />
                      <Area type="monotone" dataKey="value" stroke="#c6f135" strokeWidth={1.5} fill="url(#uniVolFill)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={[{ label: "Daily swap volume (USD)", color: "#c6f135" }]} />
              </div>
            </section>

            <section className="section rise rise-3">
              <SectionHead
                title={
                  <>
                    LP fees <span className="rule">/</span> daily, last 180 days
                  </>
                }
                note="summary/fees/uniswap-v3 · gross to LPs"
              />
              <div className="grid grid--main">
                <div className="card">
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={fee180} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                        <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                        <YAxis tickFormatter={tickUsd} width={64} />
                        <Tooltip
                          contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                          labelFormatter={(v) => tickDate(Number(v))}
                          formatter={(v) => [tickUsd(Number(v)), "Fees"]}
                        />
                        <Line type="monotone" dataKey="value" stroke="#ffb454" strokeWidth={1.4} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <Legend items={[{ label: "Daily LP fees (USD)", color: "#ffb454" }]} />
                </div>
                <div className="card">
                  <div className="card__label">
                    <span>Fee switch — definitions</span>
                    <span className="hint">KPI notes</span>
                  </div>
                  <div className="prose">
                    <p>
                      <strong>LP fees</strong> — what swappers pay (pool-dependent: 0.01%–1% tiers in v3; 0.3% /
                      0.05% presets in v4). All of it accrues to liquidity providers.
                    </p>
                    <p>
                      <strong>Protocol share</strong> — a governance-set cut of LP fees. On v2 it is a fixed
                      1/6 of the LP fee when enabled pool-by-pool; on v3/v4 it is a per-pool governance switch
                      (v4 can also route it through hooks).
                    </p>
                    <p>
                      <strong>Observed effective rate</strong> above = blended fees ÷ blended volume across the
                      family over the last 24h — the number you reconcile against the business&rsquo;s own
                      definition before publishing.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="section rise rise-4">
              <SectionHead
                title={
                  <>
                    UNI spot <span className="rule">/</span> vs 7-day TWAP
                  </>
                }
                note="coingecko market_chart · daily closes"
              />
              <div className="card">
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                      <YAxis tickFormatter={(v) => `$${Number(v).toFixed(2)}`} width={56} />
                      <Tooltip
                        contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                        labelFormatter={(v) => tickDate(Number(v))}
                        formatter={(v) => [fmtPrice(Number(v)), ""]}
                      />
                      <Line type="monotone" dataKey="price" stroke="#6ec3ff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="twap" stroke="#ffb454" strokeWidth={1.4} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <Legend
                  items={[
                    { label: "UNI daily close", color: "#6ec3ff" },
                    { label: "7d TWAP (time-weighted)", color: "#ffb454" },
                  ]}
                />
                {data.uniError ? (
                  <p className="prose" style={{ marginTop: "0.8rem" }}>
                    Price history unavailable: <span className="kbd">{data.uniError}</span>
                  </p>
                ) : null}
              </div>
            </section>

            <section className="section rise rise-5">
              <SectionHead
                title={
                  <>
                    Uniswap family <span className="rule">/</span> deployments by 24h volume
                  </>
                }
                note="overview/dexs · name ~ /uniswap/i"
              />
              <div className="card card--flush">
                <div className="table-wrap">
                  <DataTable
                    caption="Uniswap deployments"
                    columns={familyCols}
                    rows={familyRows.slice(0, 10)}
                    keyOf={(r) => r.name}
                  />
                </div>
              </div>
              <p className="prose" style={{ marginTop: "0.8rem" }}>
                Fee columns are joined from <span className="kbd">overview/fees</span> on display name —{" "}
                {familyRows.filter((r) => r.fee24h != null).length} of {familyRows.length} deployments matched;
                blended family totals are used in the headline stats.
              </p>
            </section>
          </>
        )}
      </AsyncSection>
    </>
  );
}
