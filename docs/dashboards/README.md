# Dashboard KPI definitions

One file per dashboard. Each documents the **source endpoint**, the **derivation**, and
the **caveats** for every headline number, so a reviewer can reproduce any figure by hand.

Every source below is public and keyless. Nothing in these dashboards requires an API key,
a paid plan, or a backend.

## Conventions used everywhere

- **TVL means net deposits.** DefiLlama reports borrowed / staking / pool2 buckets
  separately; those are excluded unless a panel says otherwise.
- **Fees are gross.** "Fees" = what users paid (e.g. borrower interest), not protocol
  revenue, unless labelled otherwise.
- **Percentages are shares of the stated base**, and every chart states its base.
- **Missing data renders `n/a`**, never a silent zero.

## Index

| Section | Dashboard | Subject | File |
|---|---|---|---|
| A | Market Pulse | whole market | [a-market-pulse.md](a-market-pulse.md) |
| A | Protocol Overview | Aave | [a-protocol-overview.md](a-protocol-overview.md) |
| B | Decision Markets | Polymarket | [b-decision-markets.md](b-decision-markets.md) |
| C | Spot & Fees | Uniswap | [c-spot-fees.md](c-spot-fees.md) |
| E | Holders & Token | UNI | [e-holders.md](e-holders.md) |
| F | Treasury & Funding | Lido DAO | [f-treasury.md](f-treasury.md) |
| G | Chain Comparison | 6 chains | [g-chain-comparison.md](g-chain-comparison.md) |

Cross-cutting QA notes and known limitations: [`../qa/`](../qa/).
