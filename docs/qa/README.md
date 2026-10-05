# QA notes

How the numbers on these dashboards were verified, what broke, and what is knowingly
imperfect.

## Approach

1. **Probe before building.** Every endpoint was hit and its real response shape printed
   before any UI code was written. The probes are committed in [`../../scripts/`](../../scripts/)
   (`probe_endpoints.py`, `probe_polymarket.py`, `probe_chain_path.py`, …) and double as
   regression evidence.
2. **Render headlessly, check the console.** Each of the seven pages is loaded in a headless
   browser; the run asserts that data tiles rendered, that no error state is present, and that
   the console is clean.
3. **Reconcile against the raw API.** Headline stats are recomputed from the same source the
   table renders, so a headline can never disagree with its table.
4. **Distrust the shape, not just the value.** Several bugs were *plausible-looking numbers*,
   not crashes — see below.

## Bugs found and fixed

| Symptom | Root cause | Fix |
|---|---|---|
| "Top 10 chains by TVL" listed micro-chains | `/v2/chains` returns registration order, not TVL order | sort by TVL client-side |
| Every chain showed identical DEX volume/fees | `/overview/dexs?chain=X` **ignores** the param and returns global totals | use `/overview/dexs/{chain}` |
| Top-10 / Top-20 / Top-100 concentration identical | Ethplorer holder endpoint defaults to **10** rows | pass `limit=100` |
| Aave delta showed "n/a 24h · n/a 7d" | API returns `change_1d/7d = null` for some protocols | derive from the daily series |
| "Outcome vs spot" empty | no crypto markets in the top 40 by volume | fetch top 100 |
| Raises table invented a round name | `round` is `null` for some rounds | render `—` |
| Charts blank in captures | 195 KB SVG paths missed the first raster pass | stride-sample long series, flush paints |

## Documented limitations

These are deliberate, disclosed trade-offs — not hidden defects:

- **Holder concentration is a point-in-time top-100 snapshot.** Historical cohort analysis
  (who accumulated when) requires an indexer. Top-100 share is a lower bound on true
  concentration among large wallets.
- **Per-chain DEX volume is incomplete for some chains.** Where protocols don't report a
  per-chain split, the cell is `n/a`. This is an explicit backlog.
- **Fees are gross, not revenue.** Borrower interest and LP fees are what users paid.
- **Stablecoin supply is a supply figure**, not a market cap of a single issuer.

## Reproducing a number

Every figure maps to a function in `dashboards/src/lib/queries.ts`. To reproduce one, open
the corresponding file in [`../dashboards/`](../dashboards/), read the source endpoint, and
call it directly — no key required.

## Environment notes

See [`network-notes.md`](network-notes.md) for the one environment-specific quirk
encountered during QA (Polymarket DNS) and why it does not affect visitors.
