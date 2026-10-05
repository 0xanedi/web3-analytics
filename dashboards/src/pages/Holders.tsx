import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AsyncSection } from "../components/AsyncSection";
import { DataTable, type Column } from "../components/DataTable";
import { SectionHead } from "../components/chart";
import { StatCard } from "../components/StatCard";
import { fmtNum, fmtPrice, fmtUsd, shortAddr, sum } from "../lib/format";
import {
  KNOWN_LABELS,
  fetchTopHolders,
  fetchTokenInfo,
  type Holder,
  type TokenInfo,
} from "../lib/queries";
import { useAsync } from "../lib/useAsync";

interface Snapshot {
  info: TokenInfo;
  holders: Holder[];
}

const ZERO_DEC18 = 1e18;

function label(h: Holder): string | null {
  return KNOWN_LABELS[h.address.toLowerCase()] ?? null;
}

export function Holders() {
  const { data, error, loading, reload } = useAsync<Snapshot>(async () => {
    const [info, holders] = await Promise.all([fetchTokenInfo(), fetchTopHolders()]);
    return { info, holders };
  }, []);

  const top = (n: number) => sum(data?.holders.slice(0, n).map((h) => h.share) ?? []);
  const supply = data ? data.info.totalSupply / ZERO_DEC18 : null;
  const top100Balance = data ? sum(data.holders.map((h) => h.balance)) / ZERO_DEC18 : null;
  const circShare = supply && top100Balance ? (top100Balance / supply) * 100 : null;

  const barData = (data?.holders ?? [])
    .slice(0, 10)
    .map((h) => ({ name: label(h) ?? shortAddr(h.address), share: h.share }))
    .reverse();

  const holderCols: Column<Holder>[] = [
    {
      key: "addr",
      header: "Holder",
      render: (h) => (
        <div>
          {label(h) ? <span className="tag tag--amber">{label(h)}</span> : null}{" "}
          <span className="cell-main">{shortAddr(h.address)}</span>
          <div className="cell-sub">{h.address}</div>
        </div>
      ),
    },
    { key: "bal", header: "Balance (UNI)", num: true, render: (h) => fmtNum(h.balance / ZERO_DEC18) },
    { key: "share", header: "Share", num: true, render: (h) => <span className="delta delta--flat">{h.share.toFixed(2)}%</span> },
  ];

  // Attach rank to rows (DataTable renders by column, index lives on the row).
  const ranked = (data?.holders ?? []).map((h, i) => ({ ...h, rank: i + 1 }));
  const rankedCols: Column<(typeof ranked)[number]>[] = [
    { key: "rank", header: "#", num: true, render: (r) => <span className="cell-sub">{r.rank}</span> },
    ...holderCols,
  ];

  return (
    <>
      <div className="page-head rise rise-1">
        <div className="page-head__eyebrow">
          <span>Section E</span>
          <span>Holders &amp; token</span>
          <span>Subject: UNI (Ethereum)</span>
        </div>
        <h1 className="page-head__title">
          Who owns <em>UNI</em>
        </h1>
        <p className="page-head__desc">
          Concentration, labeling and supply flows for the Uniswap governance token. Source methodology risk item:
          <strong> wallet labeling</strong> — known addresses are tagged from public Etherscan labels; everything
          else stays pseudonymous. Data is a point-in-time snapshot from Ethplorer&rsquo;s public endpoint
          (top-100 holders), with holder count and transfer activity for the full population.
        </p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid--stats">
              <StatCard
                label="Holders"
                hint="all addresses"
                value={fmtNum(data.info.holdersCount)}
                meta={`${fmtNum(data.info.transfersCount)} transfers to date`}
                delay={1}
              />
              <StatCard label="Top-10 share" value={`${top(10).toFixed(2)}%`} tone="coral" hint="concentration" delay={2} />
              <StatCard label="Top-100 share" value={`${top(100).toFixed(2)}%`} hint="of total supply" tone="amber" delay={3} />
              <StatCard
                label="Circulating supply"
                value={supply != null ? fmtNum(supply / 1e6, 1) + "M" : "n/a"}
                hint="total minted"
                delay={4}
              />
              <StatCard label="UNI price" value={fmtPrice(data.info.price)} hint="ethplorer/coingecko" delay={5} />
            </div>

            <section className="section rise rise-2">
              <SectionHead
                title={
                  <>
                    Concentration <span className="rule">/</span> top 10 holders
                  </>
                }
                note="share of total supply"
              />
              <div className="grid grid--main">
                <div className="card">
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical" margin={{ right: 12 }}>
                        <CartesianGrid stroke="#24322c" strokeDasharray="2 4" horizontal={false} />
                        <XAxis type="number" unit="%" />
                        <YAxis type="category" dataKey="name" width={110} />
                        <Tooltip
                          contentStyle={{ background: "#192320", border: "1px solid #35493f" }}
                          formatter={(v) => [`${Number(v).toFixed(2)}%`, "Share"]}
                        />
                        <Bar dataKey="share" fill="#ff6b57" radius={[0, 2, 2, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card">
                  <div className="card__label">
                    <span>Slice the set</span>
                    <span className="hint">top-N share</span>
                  </div>
                  <div className="grid grid--stats">
                    <StatCard label="Top-1" value={`${top(1).toFixed(2)}%`} tone="coral" delay={1} />
                    <StatCard label="Top-5" value={`${top(5).toFixed(2)}%`} tone="coral" delay={2} />
                    <StatCard label="Top-20" value={`${top(20).toFixed(2)}%`} tone="amber" delay={3} />
                    <StatCard label="Top-100" value={`${top(100).toFixed(2)}%`} tone="amber" delay={4} />
                  </div>
                  <p className="prose" style={{ marginTop: "0.8rem" }}>
                    Top-100 wallets hold {circShare != null ? circShare.toFixed(1) : "n/a"}% of minted supply;
                    the tail beyond rank 100 holds the remainder. Transfers:{fmtNum(data.info.transfersCount)} —
                    activity proxy for cohort flows (full cohort history needs an indexer; documented in
                    docs/qa).
                  </p>
                </div>
              </div>
            </section>

            <section className="section rise rise-3">
              <SectionHead
                title={
                  <>
                    Top holders <span className="rule">/</span> snapshot
                  </>
                }
                note="ethplorer getTopTokenHolders · top 100"
              />
              <div className="card card--flush">
                <div className="table-wrap">
                  <DataTable
                    caption="Top 100 UNI holders"
                    columns={rankedCols}
                    rows={ranked.slice(0, 25)}
                    keyOf={(r) => r.address}
                  />
                </div>
              </div>
              <p className="prose" style={{ marginTop: "0.8rem" }}>
                Showing {Math.min(25, ranked.length)} of {ranked.length}. Labels are applied only where publicly verifiable (burn address,
                Uniswap timelock, exchange hot wallets) — everything else is left anonymous by design.
                Aggregate value at spot: {fmtUsd(top100Balance && data.info.price ? top100Balance * data.info.price : null)}.
              </p>
            </section>
          </>
        )}
      </AsyncSection>
    </>
  );
}
