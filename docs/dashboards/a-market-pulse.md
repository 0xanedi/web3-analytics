# A · Market Pulse

**Question:** where is DeFi liquidity and activity right now?

**Page:** `dashboards/src/pages/MarketPulse.tsx` · **Query layer:** `fetchGlobalTvlSeries`, `fetchChains`, `fetchOverview`, `fetchStablecoins`

## KPIs

| KPI | Source | Derivation |
|---|---|---|
| Global TVL | `api.llama.fi/v2/historicalChainTvl` | last point of the daily series |
| Global TVL Δ (24h) | same | last point vs previous daily point, % |
| DEX volume · 24h | `api.llama.fi/overview/dexs` | `total24h` (all chains) |
| Protocol fees · 24h | `api.llama.fi/overview/fees` | `total24h` (all chains) |
| Stablecoin supply | `stablecoins.llama.fi/stablecoins` | sum of `circulating.peggedUSD` across tracked assets |
| Tracked chains | `api.llama.fi/v2/chains` | row count; "top" = highest TVL after client-side sort |

## Panels

- **Total value locked / all chains** — the global daily series, full history.
- **Where the liquidity lives** — top 10 chains by TVL (horizontal bars) beside the top
  stablecoins by circulation.
- **Flow & fee leaders / 24h** — top 8 protocols by 24h DEX volume and by 24h fees.
- **The rest of the ledger** — links to the six deep-dive dashboards.

## Derivations worth noting

- **Leader tables are sorted client-side.** `/overview/dexs` and `/overview/fees` return
  `protocols` in registration order, *not* by volume. Taking the first 8 rows without
  sorting produces a meaningless list (this was a real bug — see `../../METHODOLOGY.md`).
- **Top chains are sorted client-side.** `/v2/chains` is also not TVL-ordered; it is sorted
  descending by `tvl` in `fetchChains` before any slice.
- **Stablecoin total** sums `circulating.peggedUSD` across all returned pegged assets; it is
  a supply figure, not a market cap of a single issuer.

## Caveats

- Global DEX volume and fees are all-chain aggregates from DefiLlama; they include every
  protocol DefiLlama tracks, not a curated subset.
- The TVL series is daily, so the 24h delta compares two daily snapshots, not a rolling 24h.
