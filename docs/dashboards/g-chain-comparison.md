# G · Chain Comparison — same yardstick

**Question:** which ecosystem is capital-efficient, and where is activity concentrated?

**Page:** `dashboards/src/pages/ChainComparison.tsx` · **Query layer:** `fetchChains`, `fetchChainTvlSeries`, `fetchOverview("dexs"|"fees", chain)`, `fetchStablecoins`

## KPIs (per selected chain)

| KPI | Source | Derivation |
|---|---|---|
| TVL | `api.llama.fi/v2/chains` | chain `tvl` |
| Δ 7d | `v2/historicalChainTvl/{chain}` | last point vs 7 daily points back |
| DEX volume · 24h | `overview/dexs/{chain}` | `total24h` for that chain |
| Fees · 24h | `overview/fees/{chain}` | `total24h` for that chain |
| Vol / TVL | both | DEX volume ÷ TVL — capital efficiency |

## Panels

- **Select chains** — up to 6 from the tracked set (defaults: Ethereum, Solana, Base, Arbitrum, BSC).
- **TVL momentum / last 365 days** — one line per selected chain.
- **Scoreboard / identical KPIs** — the table above, one row per chain.
- **Dollar liquidity / stablecoin supply** — the top stablecoins by circulation.

## Derivations worth noting

- **The chain filter must be path-style.** `/overview/dexs?chain=X` accepts the parameter and
  **silently returns global totals**, so every chain would show the same number. The correct
  form is `/overview/dexs/{chain}`. This was the single most misleading bug found in QA — see
  `../../METHODOLOGY.md`.
- **The default set is curated**, not "first five rows": `/v2/chains` is not TVL-sorted, so a
  naive slice opens on micro-chains.
- **Capital efficiency is the point of the page** — it normalises volume by liquidity, which
  is what makes a low-TVL chain with high turnover visible.

## Caveats

- Per-chain DEX volume depends on DefiLlama's **per-chain breakdown**, which is incomplete for
  chains where protocols do not report a split. Those cells render `n/a` rather than a
  misleading zero — the `n/a` cells are an explicit backlog, not a defect.
- 7-day momentum is computed from daily TVL points (last vs 7 back), so it is a daily-resolution
  measure.
- Stablecoin supply is global per asset, not per selected chain.
