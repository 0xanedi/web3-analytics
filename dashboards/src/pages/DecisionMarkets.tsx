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
import { fmtDate, fmtDaysAway, fmtIsoDate, fmtNum, fmtPrice, fmtUsd, sum } from "../lib/format";
import { fetchJSON } from "../lib/http";
import {
  fetchGammaEvents,
  fetchGammaMarkets,
  fetchOutcomeHistory,
  fetchProtocol,
  twap,
  type GammaEvent,
  type GammaMarket,
  type PricePoint,
  type ProtocolDetail,
} from "../lib/queries";
import { useAsync } from "../lib/useAsync";

const SPOT_COINS = ["coingecko:bitcoin", "coingecko:ethereum", "coingecko:solana"];
const CRYPTO_RE = /\b(btc|bitcoin|eth|ethereum|sol|solana|xrp|ripple|ada|doge)\b/i;

interface Snapshot {
  markets: GammaMarket[];
  events: GammaEvent[];
  protocol: ProtocolDetail;
  spot: Record<string, number | null>;
}

function PageHead() {
  return (
    <div className="page-head rise rise-1">
      <div className="page-head__eyebrow">
        <span>Section B</span>
        <span>Decision markets</span>
        <span>Sources: gamma-api · clob · DefiLlama</span>
      </div>
      <h1 className="page-head__title">
        Prediction market <em>radar</em>
      </h1>
      <p className="page-head__desc">
        Polymarket, read like a trading desk: volume per market, implied outcome probabilities against live spot
        prices, open interest, and a <strong>7-day TWAP of outcome prices</strong> so you can see how far the crowd
        has drifted from its own recent average. Risk items mirror the source methodology — conditional pools,
        outcome mapping, TWAP.
      </p>
    </div>
  );
}

export function DecisionMarkets() {
  const { data, error, loading, reload } = useAsync<Snapshot>(async () => {
    const [markets, events, protocol, spotRaw] = await Promise.all([
      fetchGammaMarkets(100),
      fetchGammaEvents(15),
      fetchProtocol("polymarket"),
      fetchJSON<{ coins: Record<string, { price: number }> }>(
        `https://coins.llama.fi/prices/current/${SPOT_COINS.join(",")}`,
      ),
    ]);
    const spot: Record<string, number | null> = {};
    for (const coin of SPOT_COINS) spot[coin] = spotRaw.coins?.[coin]?.price ?? null;
    return { markets, events, protocol, spot };
  }, []);

  const cryptoMarkets = useMemo(
    () => (data?.markets ?? []).filter((m) => CRYPTO_RE.test(`${m.question} ${m.eventTitle ?? ""}`)),
    [data],
  );

  // TWAP inspector target: explicit choice or the first crypto market.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectable = useMemo(
    () => (data?.markets ?? []).filter((m) => m.clobTokenIds.length > 0),
    [data],
  );
  const selected = useMemo(() => {
    if (!data) return null;
    return (
      selectable.find((m) => m.id === selectedId) ??
      cryptoMarkets[0] ??
      selectable[0] ??
      null
    );
  }, [selectable, selectedId, cryptoMarkets, data]);

  const tokenId = selected?.clobTokenIds[0] ?? null;
  const history = useAsync<PricePoint[]>(async () => (tokenId ? fetchOutcomeHistory(tokenId) : []), [tokenId]);

  const spotPrice = (coin: string) => data?.spot[coin] ?? null;
  const marketTvl = data
    ? Object.values(data.protocol.currentChainTvls ?? {}).reduce((acc, v) => acc + (v ?? 0), 0)
    : 0;

  const top24h = sum((data?.markets ?? []).map((m) => m.volume24h));
  const oiTotal = sum((data?.events ?? []).map((e) => e.openInterest));

  const marketCols: Column<GammaMarket>[] = [
    {
      key: "q",
      header: "Market",
      render: (m) => (
        <div>
          <span className="cell-main">{m.question}</span>
          <div className="cell-sub">
            {m.eventTitle && m.eventTitle !== m.question ? `${m.eventTitle} · ` : ""}
            ends {fmtIsoDate(m.endDate)} ({fmtDaysAway(m.endDate)})
          </div>
        </div>
      ),
    },
    {
      key: "prob",
      header: `${"Implied prob."}`,
      num: true,
      render: (m) => (
        <span className="tag tag--acid">
          {m.outcomes[0] ?? "YES"} {m.outcomePrices[0] != null ? `${(m.outcomePrices[0] * 100).toFixed(0)}%` : "n/a"}
        </span>
      ),
    },
    { key: "v24", header: "Vol 24h", num: true, render: (m) => fmtUsd(m.volume24h) },
    { key: "vt", header: "Vol total", num: true, render: (m) => fmtUsd(m.volumeTotal) },
    { key: "liq", header: "Liquidity", num: true, render: (m) => fmtUsd(m.liquidity) },
  ];

  const eventCols: Column<GammaEvent>[] = [
    { key: "t", header: "Event", render: (e) => <span className="cell-main">{e.title}</span> },
    { key: "v24", header: "Vol 24h", num: true, render: (e) => fmtUsd(e.volume24h) },
    { key: "oi", header: "Open interest", num: true, render: (e) => fmtUsd(e.openInterest) },
    { key: "m", header: "Markets", num: true, render: (e) => fmtNum(e.markets) },
  ];

  const spotCols: Column<GammaMarket>[] = [
    {
      key: "q",
      header: "Crypto market",
      render: (m) => <span className="cell-main">{m.question}</span>,
    },
    {
      key: "p",
      header: "Implied",
      num: true,
      render: (m) => (
        <span className="tag tag--acid">
          {m.outcomes[0] ?? "?"} {m.outcomePrices[0] != null ? `${(m.outcomePrices[0] * 100).toFixed(1)}%` : "n/a"}
        </span>
      ),
    },
    { key: "v", header: "Vol 24h", num: true, render: (m) => fmtUsd(m.volume24h) },
    { key: "e", header: "Resolves", num: true, render: (m) => fmtIsoDate(m.endDate) },
  ];

  const twapValue = history.data ? twap(history.data, 7) : null;
  const currentPrice = history.data?.at(-1)?.p ?? null;
  const marginPp = twapValue != null && currentPrice != null ? (currentPrice - twapValue) * 100 : null;

  const twapChart = (history.data ?? []).map((p) => ({
    t: p.t,
    p: p.p,
    twap: twapValue ?? undefined,
  }));

  return (
    <>
      <PageHead />

      <AsyncSection loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid--stats">
              <StatCard
                label="Top-100 volume · 24h"
                value={fmtUsd(top24h)}
                hint="sum of fetched"
                delay={1}
              />
              <StatCard label="Open interest" value={fmtUsd(oiTotal)} hint="top events" tone="amber" delay={2} />
              <StatCard label="Polymarket TVL" value={fmtUsd(marketTvl)} hint="DefiLlama" delay={3} />
              <StatCard
                label="Live markets"
                value={fmtNum(data.markets.length)}
                hint={`${cryptoMarkets.length} crypto-linked`}
                delay={4}
              />
              <StatCard
                label="Funding raised"
                value={fmtUsd(sum(data.protocol.raises.map((r) => (r.amount ?? 0) * 1e6)))}
                hint="all rounds"
                tone="amber"
                delay={5}
              />
            </div>

            <section className="section rise rise-2">
              <SectionHead
                title={
                  <>
                    Platform liquidity <span className="rule">/</span> Polymarket TVL
                  </>
                }
                note="api.llama.fi/protocol/polymarket"
              />
              <div className="card">
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.protocol.tvlSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                      <YAxis tickFormatter={tickUsd} width={64} />
                      <Tooltip
                        contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                        labelFormatter={(v) => tickDate(Number(v))}
                        formatter={(v) => [tickUsd(Number(v)), "TVL"]}
                      />
                      <Line type="monotone" dataKey="value" stroke="#c6f135" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={[{ label: "Polymarket liquidity (USD)", color: "#c6f135" }]} />
              </div>
            </section>

            <section className="section rise rise-3">
              <SectionHead title={<>Hot markets</>} note="gamma-api · ordered by 24h volume" />
              <div className="card card--flush">
                <div className="table-wrap">
                  <DataTable caption="Top Polymarket markets" columns={marketCols} rows={data.markets.slice(0, 20)} keyOf={(m) => m.id} />
                </div>
              </div>
            </section>

            <section className="section rise rise-4">
              <SectionHead
                title={
                  <>
                    Outcome vs spot <span className="rule">/</span> crypto-linked markets
                  </>
                }
                note="implied probability vs live oracle prices"
              />
              <div className="grid grid--stats" style={{ marginBottom: "var(--gap)" }}>
                {SPOT_COINS.map((coin) => (
                  <StatCard
                    key={coin}
                    label={coin.split(":")[1]}
                    value={fmtPrice(spotPrice(coin))}
                    hint="spot · coins.llama.fi"
                    delay={2}
                  />
                ))}
              </div>
              <div className="card card--flush">
                <div className="table-wrap">
                  <DataTable
                    caption="Crypto prediction markets"
                    columns={spotCols}
                    rows={cryptoMarkets.slice(0, 10)}
                    keyOf={(m) => m.id}
                  />
                </div>
              </div>
            </section>

            <section className="section rise rise-5">
              <SectionHead
                title={
                  <>
                    TWAP inspector <span className="rule">/</span> outcome price vs 7-day time-weighted average
                  </>
                }
                note="clob.polymarket.com/prices-history · fidelity 60m"
              />
              <div className="card">
                <label className="card__label" htmlFor="market-select">
                  <span>Market under inspection</span>
                  <span className="hint">TWAP = Σ(p·Δt) / ΣΔt</span>
                </label>
                <select
                  id="market-select"
                  value={selected?.id ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="retry-btn"
                  style={{ width: "100%", marginBottom: "0.9rem", textAlign: "left" }}
                >
                  {selectable.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.question.slice(0, 90)}
                    </option>
                  ))}
                </select>

                <AsyncSection loading={history.loading} error={history.error} onRetry={history.reload} minHeight={180}>
                  {twapChart.length > 0 ? (
                    <>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={twapChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke="#24322c" strokeDasharray="2 4" vertical={false} />
                            <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickDate} />
                            <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={44} />
                            <Tooltip
                              contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                              labelFormatter={(v) => tickDate(Number(v))}
                              formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, ""]}
                            />
                            <Line type="stepAfter" dataKey="p" stroke="#6ec3ff" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Outcome price" />
                            <Line type="monotone" dataKey="twap" stroke="#ffb454" strokeWidth={1.4} strokeDasharray="5 4" dot={false} isAnimationActive={false} name="7d TWAP" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <Legend
                        items={[
                          { label: `${selected?.outcomes[0] ?? "Outcome"} price`, color: "#6ec3ff" },
                          { label: "7d TWAP", color: "#ffb454" },
                        ]}
                      />
                      <div className="grid grid--stats" style={{ marginTop: "var(--gap)" }}>
                        <StatCard label="Current probability" value={`${((currentPrice ?? 0) * 100).toFixed(1)}%`} delay={1} />
                        <StatCard label="7d TWAP" value={twapValue != null ? `${(twapValue * 100).toFixed(1)}%` : "n/a"} tone="amber" delay={2} />
                        <StatCard
                          label="Margin vs TWAP"
                          value={marginPp != null ? `${marginPp >= 0 ? "+" : ""}${marginPp.toFixed(1)} pp` : "n/a"}
                          tone={marginPp != null && marginPp >= 0 ? "acid" : "coral"}
                          meta="drift from crowd's own average"
                          delay={3}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="state">No price history for this market yet.</div>
                  )}
                </AsyncSection>
              </div>
            </section>

            <section className="section rise rise-5">
              <SectionHead title={<>Event flow &amp; company milestones</>} note="gamma events · DefiLlama raises/hallmarks" />
              <div className="grid grid--2">
                <div className="card card--flush">
                  <div className="table-wrap">
                    <DataTable caption="Top events" columns={eventCols} rows={data.events.slice(0, 10)} keyOf={(e) => e.id} />
                  </div>
                </div>
                <div className="card card--flush">
                  <div className="table-wrap">
                    <DataTable
                      caption="Polymarket funding rounds"
                      columns={[
                        { key: "d", header: "Date", render: (r: ProtocolDetail["raises"][number]) => <span className="tag">{fmtDate(r.date)}</span> },
                        {
                          key: "r",
                          header: "Round",
                          render: (r: ProtocolDetail["raises"][number]) => (
                            <span className="cell-main">{r.round ?? "—"}</span>
                          ),
                        },
                        { key: "a", header: "Raised", num: true, render: (r: ProtocolDetail["raises"][number]) => fmtUsd((r.amount ?? 0) * 1e6) },
                        {
                          key: "v",
                          header: "Valuation",
                          num: true,
                          render: (r: ProtocolDetail["raises"][number]) => (r.valuation ? `$${r.valuation}M` : "n/a"),
                        },
                        {
                          key: "l",
                          header: "Lead",
                          render: (r: ProtocolDetail["raises"][number]) => <span className="cell-sub">{r.lead ?? "—"}</span>,
                        },
                      ]}
                      rows={[...data.protocol.raises].sort((a, b) => b.date - a.date)}
                      keyOf={(r) => `${r.date}-${r.round}`}
                    />
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginTop: "var(--gap)" }}>
                <div className="card__label">
                  <span>Milestones</span>
                  <span className="hint">hallmarks</span>
                </div>
                <div className="table-wrap">
                  <DataTable
                    caption="Hallmarks"
                    columns={[
                      { key: "d", header: "Date", render: (r: [number, string]) => <span className="tag">{fmtDate(r[0])}</span> },
                      { key: "e", header: "Event", render: (r: [number, string]) => <span className="cell-main">{r[1]}</span> },
                    ]}
                    rows={data.protocol.hallmarks}
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
