# E · Holders & Token — UNI

**Question:** how concentrated is governance, and how is supply moving?

**Page:** `dashboards/src/pages/Holders.tsx` · **Query layer:** `fetchTokenInfo`, `fetchTopHolders` (Ethplorer)

## KPIs

| KPI | Source | Derivation |
|---|---|---|
| Holders / all addresses | `api.ethplorer.io/getTokenInfo` | `holdersCount` / `transfersCount` |
| Top-10 / Top-100 share | `getTopTokenHolders` (`limit=100`) | sum of the top N holders' share of supply |
| Circulating supply | `getTokenInfo` | `totalSupply` |
| UNI price | `getTokenInfo` | `price.rate` |

## Panels

- **Concentration** — top-10 holders as bars, share of total supply.
- **Slice the set** — Top-1 / Top-5 / Top-20 / Top-100 concentration, each a different number.
- **Top holders snapshot** — the ranked top 100 with labels where verifiable.

## Derivations worth noting

- **`limit=100` is required.** Ethplorer's holder endpoint defaults to **10** rows; without
  the parameter, Top-10, Top-20 and Top-100 all return the same value (this was a real bug —
  see `../../METHODOLOGY.md`).
- **Concentration is cumulative share**, computed from the returned balances, not a
  pre-computed field.
- **Labels are applied only where publicly verifiable** — the burn address, the Uniswap
  timelock, and known exchange hot wallets. Everything else stays pseudonymous by design.

## Caveats — read these

- This is a **point-in-time top-100 snapshot**, not a historical cohort analysis. Tracking
  how specific cohorts accumulated over time requires an indexer, which is out of scope for
  a keyless build. The page says so.
- The long tail beyond rank 100 is not visible; Top-100 share is therefore a **lower bound**
  on true concentration among the largest wallets.
- Ethplorer's `freeKey` is a **public demo key** published in their documentation — it is not
  a secret, but it is also rate-limited.
