# A · Protocol Overview — Aave

**Question:** is this protocol growing, and where does its liquidity sit?

**Page:** `dashboards/src/pages/ProtocolOverview.tsx` · **Query layer:** `fetchProtocol("aave")`, `fetchSummary("fees", "aave")`

## KPIs

| KPI | Source | Derivation |
|---|---|---|
| Aave TVL | `api.llama.fi/protocol/aave` | sum of plain chain TVL keys in `currentChainTvls`, excluding borrowed/staking/pool2 and any `*-bucket` key |
| TVL Δ 24h / 7d | same | `change_1d` / `change_7d`; **falls back to the daily series** when the API returns `null` |
| Chains live | same | count of plain chain keys with non-zero TVL |
| Interest paid · 24h / 30d | `api.llama.fi/summary/fees/aave` | `total24h` / `total30d` |
| All-time fees | same | `totalAllTime` |

## Panels

- **TVL / since listing** — the full daily TVL series since 2020.
- **Chain split / net deposits** — per-chain net deposits (bars) with a table of the top 14
  chains and their share of total.
- **Fee capture / interest paid, last 365 days** — daily gross borrower interest.
- **About & milestones** — description, live chain list, and DefiLlama hallmarks.

## Derivations worth noting

- **`raw.chains` is empty for Aave** because it is a parent protocol. The chain list in the
  About panel is therefore derived from `currentChainTvls` keys (same filter as the chain
  table), not from `chains`.
- **Deltas are computed from the raw daily series**, never from the rendered (stride-sampled)
  chart series — sampling 6 years of daily data to ~700 points would otherwise turn a 7-day
  change into a ~28-day change.
- **Hallmarks are de-duplicated** on `date + event`; the source contains exact duplicates.
- **Charts are stride-sampled** for paint performance (see `downsample` in
  `dashboards/src/components/chart.tsx`); the visual shape is unchanged.

## Caveats

- **Fees are gross borrower interest**, not Aave's protocol revenue. The page says so
  explicitly.
- TVL is *net deposits*: borrowed amounts are excluded to match the protocol's own
  front-end definition.
- The chain table shows the top 14 chains; smaller chains remain in the total.
