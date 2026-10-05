# F · Treasury & Funding — Lido DAO

**Question:** how much does the DAO control, and how long is the runway?

**Page:** `dashboards/src/pages/Treasury.tsx` · **Query layer:** `fetchTreasury("lido")`

## KPIs

| KPI | Source | Derivation |
|---|---|---|
| Treasury total | `api.llama.fi/treasury/lido` | external + own-token holdings, current |
| Own tokens (LDO) | same | sum of `*-OwnTokens` buckets |
| Liquid / external | same | sum of plain chain buckets (stablecoins, ETH, LP positions) |
| Treasury ÷ mcap | same | total ÷ `mcap` |
| Chains with wallets | same | count of non-zero chain buckets |

## Panels

- **Treasury value / external vs own tokens** — the full daily series, split into external
  assets and the DAO's own token.
- **Positions** — per-chain external and own-token holdings with share of total.
- **Milestones** — DefiLlama hallmarks, stress events included.
- **Funding** — a note that Lido has no traditional VC rounds (it is DAO-funded), contrasted
  with the Polymarket raise schedule.

## Derivations worth noting

- **Double-counting is avoided deliberately.** DefiLlama exposes both `Chain` (external) and
  `Chain-OwnTokens` buckets **plus** a bare `OwnTokens` aggregate. The aggregate is skipped;
  only the per-chain buckets are summed. The page states this.
- The total series is a **union of timestamps** across buckets: for each date, external and
  own are summed separately, then combined, so a date present in only one bucket still
  contributes correctly.
- **Own-token share is flagged as price-dependent**: a drawdown in LDO shrinks the runway
  proportionally, and that is a risk note on the page rather than a footnote.

## Caveats

- Valuations use DefiLlama's **last-updated price** for each asset, not a live oracle.
- Position addresses are aggregated by DefiLlama's treasury adapters; this dashboard does not
  independently enumerate every wallet.
- "Treasury ÷ mcap" compares a balance-sheet figure to a market figure; it is a framing
  ratio, not a solvency measure.
