# B · Decision Markets — Polymarket

**Question:** what does the crowd expect, and has it drifted from its own recent average?

**Page:** `dashboards/src/pages/DecisionMarkets.tsx` · **Query layer:** `fetchGammaMarkets(100)`, `fetchGammaEvents`, `fetchPriceHistory`, `fetchProtocol("polymarket")`

## KPIs

| KPI | Source | Derivation |
|---|---|---|
| Top-100 volume · 24h | `gamma-api.polymarket.com/markets` | sum of `volume24hr` over the fetched set |
| Interest · 24h | `gamma-api.polymarket.com/events` | sum of event `volume24hr` |
| Polymarket TVL | `api.llama.fi/protocol/polymarket` | treasury series (see `f-treasury.md` for the aggregation rule) |
| Live markets / events | gamma | row counts |
| Crypto-linked | gamma | markets whose question or event title matches a crypto-asset regex |
| Funding raised | `api.llama.fi/protocol/polymarket` | sum of `raises[].amount` (units are **$ millions**) |

## Panels

- **Platform liquidity** — Polymarket TVL over time.
- **Hot markets** — top markets by 24h volume with implied probability.
- **Outcome vs spot** — crypto-linked markets beside live BTC / ETH / SOL spot prices.
- **TWAP inspector** — outcome price vs its 7-day time-weighted average, with the margin.
- **Event flow & company milestones** — top events and the protocol's funding rounds.

## Derivations worth noting

- **Implied probability** comes from `outcomes` + `outcomePrices` on each market; the page
  shows the first outcome's price.
- **TWAP** is a 7-day time-weighted average of the selected outcome token's CLOB price
  history (`clob.polymarket.com/prices-history`), compared against the current implied
  probability. The margin (current − TWAP, in percentage points) is the drift signal.
- **Raises `amount` is in $ millions**, so it is multiplied by `1e6` for display. Rounds
  with a `null` label render `—` rather than inventing a name.
- **Top 100, not top 40.** Crypto price markets are sparse at the top of the volume table
  (sports and politics dominate), so the fetch limit is 100 to give the crypto panel content.

## Caveats

- The gamma API's `tag=crypto` filter is **ignored** by the endpoint; crypto markets are
  therefore identified by client-side regex over question/event text.
- Only the first outcome's price is charted; multi-outcome markets are not decomposed.
- Funding totals sum every recorded round, including rounds without a public label.
