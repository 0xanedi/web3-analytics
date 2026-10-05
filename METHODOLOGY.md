# Methodology

This repo is shaped like a BI engagement, not a weekend project. It follows the same
six phases a data-consulting scope would: **Discovery → Setup → Build → QA → Launch →
Upkeep**. This document is the log of how each phase was actually carried out, including
what broke and how it was found.

The guiding constraint throughout: **public, keyless data only**, so every claim in every
dashboard can be reproduced by anyone with a browser.

---

## 1 · Discovery

**Question asked first:** what does a stakeholder actually need to decide, and which
public sources can answer it without a paid tier?

The scope was mapped to a set of dashboard proposals (labelled A, B, C, E, F, G — D was
dropped as it duplicated coverage) and each was checked against a real, public protocol or
chain so nothing is a toy example:

| Section | Dashboard | Subject | Decision it supports |
|---|---|---|---|
| A | Market Pulse | whole market | where is liquidity and activity right now |
| A | Protocol Overview | Aave | is this protocol growing, and where |
| B | Decision Markets | Polymarket | what does the crowd expect, vs spot |
| C | Spot & Fees | Uniswap | what are LPs actually earning |
| E | Holders & Token | UNI | how concentrated is governance |
| F | Treasury & Funding | Lido DAO | how long is the runway |
| G | Chain Comparison | 6 chains | which ecosystem is capital-efficient |

**Endpoint reconnaissance** was done before any UI code: `scripts/probe_endpoints.py`
hits each candidate endpoint and prints its real response shape, so the query layer is
written against observed JSON rather than documentation that may have drifted.

---

## 2 · Setup

- **Stack:** React + Vite + TypeScript, static build. A relative `base` and a hash router
  mean one `dist/` works from any GitHub Pages account/repo/sub-path with no rebuild.
- **No backend, no keys.** All fetching is client-side against free endpoints. The only
  "key" anywhere is Ethplorer's public `freeKey` demo key, which is documented as such in
  `src/lib/queries.ts`.
- **MCP server:** `mcp/defillama-mcp/` wraps the same DefiLlama APIs as 9 typed tools and
  3 prompts over stdio, with explicit context guardrails (history stripped unless
  requested, list limits, truncation, retry/backoff, caching).
- **Skills** were installed project-local and pinned in `skills-lock.json` so the tooling
  is reproducible without vendoring third-party code.

---

## 3 · Build

The query layer (`dashboards/src/lib/queries.ts`) is the centre of gravity: every metric is
a typed function over a named endpoint, with derivations (TWAP, treasury aggregation,
effective fee rate, capital efficiency) written as code. Pages are presentational.

Notable derivations:

- **Treasury aggregation** — `chainTvls` exposes both `Chain` (external) and
  `Chain-OwnTokens` buckets plus a bare `OwnTokens` aggregate; the aggregate is skipped to
  avoid double-counting, and external vs own are tracked separately.
- **7-day TWAP** of Polymarket outcome prices, computed from CLOB price history, compared
  against the current implied probability to expose drift.
- **Effective fee rate** — blended LP fees ÷ blended volume, shown as a single observed
  rate rather than trusting a protocol's advertised fee.

---

## 4 · QA

This is where most of the real work happened. Every dashboard was rendered headlessly,
its console checked for errors, and its numbers reconciled against the raw API. The
probes used are committed in `scripts/`. Bugs found and fixed:

| Symptom | Root cause | Fix |
|---|---|---|
| "Top 10 chains by TVL" showed micro-chains (TAC, Ink, Corn) | `/v2/chains` returns registration order, not TVL order | sort by TVL client-side |
| Every chain in the scoreboard showed the **same** DEX volume and fees | `/overview/dexs?chain=X` accepts the param but **silently ignores it** and returns global totals | use the path form `/overview/dexs/{chain}` |
| UNI Top-10, Top-20 and Top-100 concentration were all identical | Ethplorer's holder endpoint defaults to **10** rows | pass `limit=100` |
| Aave headline delta showed "n/a 24h · n/a 7d" | DefiLlama returns `change_1d/7d = null` for some protocols | derive the delta from the daily TVL series |
| "Outcome vs spot" table was empty | no crypto-linked markets in the top 40 by volume | fetch the top 100 |
| Raises table invented a "Strategic" label for unlabelled rounds | `round` is null for some rounds and was defaulted to a real round name | render `—` when unknown |
| Charts rendered blank in captures | multi-year daily series produced 195 KB SVG paths that missed the first raster pass | stride-sample long series + flush paints before capture |
| Whole page blanked when Polymarket was unreachable | one `Promise.all` coupled every panel to a single source | per-source `allSettled` + Manifold fallback venue |
| Network failures were retried 3× before any fallback | the retry loop did not distinguish transport errors | fail fast on `TypeError` (DNS/offline/CORS) |

**Documented limitations** (not hidden, not "fixed" by guessing):

- Holder concentration is a **point-in-time top-100 snapshot**; true historical cohorts
  need an indexer, which is out of scope for a keyless build.
- Per-chain DEX volume relies on DefiLlama's per-chain breakdown, which is **incomplete for
  chains where protocols don't report a split** — those cells render `n/a` rather than a
  misleading zero.

---

## 5 · Launch

- Static dashboards deployed to GitHub Pages via `.github/workflows/pages.yml`.
- Rendered screenshots committed under `docs/screenshots/` and embedded in the README.
- Public repo, no secrets: the staged index is scanned for credential patterns before
  every push, and `.venv/`, `node_modules/`, `dist/`, and vendored skills are gitignored.

---

## 6 · Upkeep

What a client would get next, and what this repo would do about it:

- **Freshness** — the dashboards are live-query, so they are never stale by construction;
  a scheduled job would snapshot the headline KPIs daily to detect source drift.
- **Breakage detection** — the endpoint probes in `scripts/` are the seed of a smoke test
  that fails loudly when a public API changes shape.
- **Coverage** — the `n/a` cells are an explicit backlog: they mark chains and metrics that
  need either a better source or a documented exclusion.
