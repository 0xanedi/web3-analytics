# C · Spot & Fees — Uniswap

**Question:** what are LPs actually earning, and is the token priced above or below trend?

**Page:** `dashboards/src/pages/SpotFees.tsx` · **Query layer:** `fetchSummary("dexs"|"fees", "uniswap-v3")`, `fetchOverview`, `fetchMarketChart("uniswap")`

## KPIs

| KPI | Source | Derivation |
|---|---|---|
| Family volume · 24h | `api.llama.fi/overview/dexs` | sum of `total24h` over rows whose name matches `/uniswap/i` |
| LP fees · 24h | `api.llama.fi/overview/fees` | sum of `total24h` over the same-name rows |
| Effective fee rate | both | `LP fees ÷ family volume`, as an observed blended rate |
| UNI price | `api.coingecko.com` market chart | last daily close |
| UNI vs 7d TWAP | same | last close vs 7-day time-weighted average |

## Panels

- **Uniswap v3 daily volume, last 180 days** — from the per-protocol summary series.
- **LP fees / daily, last 180 days** — daily LP fees, with a definitions panel explaining
  where fees go and what the observed rate means.
- **UNI spot vs 7-day TWAP** — daily closes against a time-weighted average.
- **Uniswap family / deployments by 24h volume** — v1–v4 plus auctions, joined with fees.

## Derivations worth noting

- **Headline and table share one source.** Family volume and fees are summed from the same
  `overview` rows the table renders, so the headline always reconciles with the table.
- **Effective fee rate is observed, not advertised.** It is blended fees ÷ blended volume
  across the whole family, which is the number you reconcile against a business's own
  definition before publishing.
- **TWAP is time-weighted** (a rolling average over daily closes), not a simple mean of the
  window's endpoints.

## Caveats

- Deployments are joined between the dexs and fees endpoints **on display name**. A
  deployment that appears in one but not the other shows `n/a` for the missing column, and
  the page states how many deployments matched.
- The volume/fee history charts use the `uniswap-v3` summary series, while the headline is
  the whole family — the labels say which is which.
