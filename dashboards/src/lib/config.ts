/**
 * Central config — one place to point the dashboards at your published repo.
 *
 * `REPO_URL` is used for "view KPI definitions / queries" links.
 */
export const REPO_URL = "https://github.com/0xanedi/web3-analytics";

export const DOCS_URL = `${REPO_URL}/tree/main/docs/dashboards`;

/** Section letters mirror the Umia <> SEEData proposed-dashboard table (A,B,C,E,F,G — no D). */
export const DASHBOARDS = [
  { section: "A", slug: "/", name: "Market Pulse", desc: "Global DeFi: TVL, chains, volume, fees" },
  { section: "A", slug: "/protocol", name: "Protocol Overview", desc: "Aave deep dive — TVL, chains, fee capture" },
  { section: "B", slug: "/decision-markets", name: "Decision Markets", desc: "Polymarket — volume, outcomes, TWAP" },
  { section: "C", slug: "/spot-fees", name: "Spot & Fees", desc: "Uniswap — volume, LP fees, price vs TWAP" },
  { section: "E", slug: "/holders", name: "Holders & Token", desc: "UNI concentration, cohorts, supply flows" },
  { section: "F", slug: "/treasury", name: "Treasury & Funding", desc: "Lido DAO treasury, raises, milestones" },
  { section: "G", slug: "/chains", name: "Chain Comparison", desc: "TVL momentum, volume efficiency, fees" },
] as const;
