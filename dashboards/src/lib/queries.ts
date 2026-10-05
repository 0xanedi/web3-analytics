/**
 * ============================================================================
 * QUERIES — the portfolio's "base queries" layer.
 *
 * Every dashboard fetch lives here: typed, documented, keyless, and mapped to
 * the exact public endpoints below. This file is the Dune-equivalent of a
 * dashboard's SQL: same questions, different substrate.
 *
 *   DefiLlama core        https://api.llama.fi
 *   DefiLlama coins       https://coins.llama.fi
 *   DefiLlama yields      https://yields.llama.fi
 *   DefiLlama stablecoins https://stablecoins.llama.fi
 *   Polymarket gamma      https://gamma-api.polymarket.com   (CORS: *)
 *   Polymarket clob       https://clob.polymarket.com        (CORS: *)
 *   Ethplorer             https://api.ethplorer.io           (public demo key)
 *   CoinGecko             https://api.coingecko.com          (free, rate-limited)
 *
 * Local DNS caveat: some ISPs censor *.polymarket.com. Visitor browsers are
 * unaffected; QA docs describe the DoH workaround used during build/QA.
 * ============================================================================
 */

import { fetchJSON } from "./http";

/* ============================== shared types ============================== */

export interface DatePoint {
  date: number;
  value: number;
}

export interface ChainTvl {
  name: string;
  tvl: number;
  tokenSymbol: string | null;
  chainId: number | null;
}

export interface ProtocolRow {
  name: string;
  slug: string | null;
  symbol: string | null;
  category: string | null;
  chain: string | null;
  chains: number;
  tvl: number | null;
  change1d: number | null;
  change7d: number | null;
}

export interface Raise {
  date: number;
  round: string | null;
  amount: number | null; // millions USD as reported by DefiLlama
  valuation: string | null;
  lead: string | null;
}

export interface ProtocolDetail {
  name: string;
  symbol: string | null;
  category: string | null;
  description: string | null;
  url: string | null;
  geckoId: string | null;
  chains: string[];
  tvlSeries: DatePoint[];
  currentChainTvls: Record<string, number>;
  change1d: number | null;
  change7d: number | null;
  hallmarks: [number, string][];
  raises: Raise[];
}

export interface OverviewTotals {
  total24h: number | null;
  total7d: number | null;
  total30d: number | null;
  totalAllTime: number | null;
  change1d: number | null;
}

export interface OverviewRow {
  name: string;
  category: string | null;
  chains: string[];
  total24h: number | null;
  total7d: number | null;
  total30d: number | null;
  total1y: number | null;
  totalAllTime: number | null;
  change1d: number | null;
}

/** /summary/fees/{slug} and /summary/dexs/{slug} */
export interface SummaryStats {
  name: string;
  total24h: number | null;
  total7d: number | null;
  total30d: number | null;
  totalAllTime: number | null;
  change1d: number | null;
  chart: DatePoint[];
}

export interface StableAsset {
  name: string;
  symbol: string;
  peg: string;
  circulating: number | null;
  prevDay: number | null;
  prevWeek: number | null;
  price: number | null;
}

export interface TreasurySnapshot {
  name: string;
  /** Total treasury USD value over time = Σ(chain external) + Σ(chain own-tokens). */
  totalSeries: DatePoint[];
  /** Composition series (stacked area chart): external assets vs own tokens. */
  externalSeries: DatePoint[];
  ownSeries: DatePoint[];
  /** Current split: external assets vs own tokens. */
  current: { total: number; external: number; ownTokens: number };
  /** Latest per-chain balances (own vs external kept separate — no double count). */
  chains: { name: string; external: number; ownTokens: number }[];
  hallmarks: [number, string][];
  mcap: number | null;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  holdersCount: number | null;
  transfersCount: number | null;
  price: number | null;
  lastUpdated: number | null;
}

export interface Holder {
  address: string;
  balance: number;
  share: number;
}

export interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  eventTitle: string | null;
  outcomes: string[];
  outcomePrices: number[];
  volume24h: number;
  volumeTotal: number;
  volume1w: number;
  liquidity: number;
  endDate: string | null;
  spread: number | null;
  lastTradePrice: number | null;
  clobTokenIds: string[];
  negRisk: boolean;
}

export interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  volume24h: number;
  volume: number;
  liquidity: number;
  openInterest: number | null;
  seriesSlug: string | null;
  endDate: string | null;
  markets: number;
}

export interface PricePoint {
  t: number;
  p: number;
}

/* =========================== DefiLlama — core ============================ */

const CORE = "https://api.llama.fi";

/** Global TVL history: [{date, tvl}] -> DatePoint[] */
export async function fetchGlobalTvlSeries(): Promise<DatePoint[]> {
  const rows = await fetchJSON<{ date: number; tvl: number }[]>(`${CORE}/v2/historicalChainTvl`);
  return rows.map((r) => ({ date: r.date, value: r.tvl }));
}

/** Single-chain TVL history (e.g. "Ethereum", "Solana", "Base") */
export async function fetchChainTvlSeries(chain: string): Promise<DatePoint[]> {
  const rows = await fetchJSON<{ date: number; tvl: number }[]>(
    `${CORE}/v2/historicalChainTvl/${encodeURIComponent(chain)}`,
  );
  return rows.map((r) => ({ date: r.date, value: r.tvl }));
}

export async function fetchChains(): Promise<ChainTvl[]> {
  const rows = await fetchJSON<{ name: string; tvl: number; tokenSymbol: string | null; chainId: number | null }[]>(
    `${CORE}/v2/chains`,
  );
  // The endpoint returns chains in registration order, not by TVL — sort here
  // so "top chains" slices and default selections are meaningful.
  return [...rows].sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));
}

export async function fetchProtocol(slug: string): Promise<ProtocolDetail> {
  const raw = await fetchJSON<Record<string, any>>(`${CORE}/protocol/${slug}`);
  return {
    name: raw.name ?? slug,
    symbol: raw.symbol ?? null,
    category: raw.category ?? null,
    description: raw.description ?? null,
    url: raw.url ?? null,
    geckoId: raw.gecko_id ?? null,
    chains: raw.chains ?? [],
    tvlSeries: (raw.tvl ?? []).map((p: any) => ({ date: p.date, value: p.totalLiquidityUSD })),
    currentChainTvls: raw.currentChainTvls ?? {},
    change1d: raw.change_1d ?? null,
    change7d: raw.change_7d ?? null,
    hallmarks: raw.hallmarks ?? [],
    raises: (Array.isArray(raw.raises) ? raw.raises : []).map((r: any) => ({
      date: r.date ?? 0,
      round: r.round ?? null,
      amount: r.amount ?? null,
      valuation: r.valuation ?? null,
      lead: r.leadInvestors?.[0] ?? null,
    })),
  };
}

/** /overview/fees or /overview/dexs with history arrays excluded (context protection). */
export async function fetchOverview(
  kind: "fees" | "dexs",
  chain?: string,
): Promise<{ totals: OverviewTotals; protocols: OverviewRow[] }> {
  const params = new URLSearchParams({
    excludeTotalDataChart: "true",
    excludeTotalDataChartBreakdown: "true",
  });
  // Chain filter must be path-style: /overview/dexs?chain=X is accepted but
  // silently ignored (returns global totals — verified in QA probe).
  const url = chain
    ? `${CORE}/overview/${kind}/${encodeURIComponent(chain)}?${params}`
    : `${CORE}/overview/${kind}?${params}`;
  const raw = await fetchJSON<Record<string, any>>(url);
  const protocols: OverviewRow[] = (raw.protocols ?? []).map((p: any) => ({
    name: p.name ?? "?",
    category: p.category ?? null,
    chains: p.chains ?? [],
    total24h: p.total24h ?? null,
    total7d: p.total7d ?? null,
    total30d: p.total30d ?? null,
    total1y: p.total1y ?? null,
    totalAllTime: p.totalAllTime ?? null,
    change1d: p.change_1d ?? null,
  }));
  // API list order is registration order — sort by 24h activity so "leaders"
  // tables actually show leaders (nulls last).
  protocols.sort((a, b) => (b.total24h ?? -1) - (a.total24h ?? -1));
  return {
    totals: {
      total24h: raw.total24h ?? null,
      total7d: raw.total7d ?? null,
      total30d: raw.total30d ?? null,
      totalAllTime: raw.totalAllTime ?? null,
      change1d: raw.change_1d ?? null,
    },
    protocols,
  };
}

/** Per-protocol totals + daily history: /summary/fees/{slug} | /summary/dexs/{slug} */
export async function fetchSummary(kind: "fees" | "dexs", slug: string): Promise<SummaryStats> {
  const raw = await fetchJSON<Record<string, any>>(`${CORE}/summary/${kind}/${slug}`);
  return {
    name: raw.name ?? slug,
    total24h: raw.total24h ?? null,
    total7d: raw.total7d ?? null,
    total30d: raw.total30d ?? null,
    totalAllTime: raw.totalAllTime ?? null,
    change1d: raw.change_1d ?? null,
    chart: (raw.totalDataChart ?? []).map((p: any) => ({ date: p[0], value: p[1] })),
  };
}

/* ========================= DefiLlama — stablecoins ======================== */

const STABLECOINS = "https://stablecoins.llama.fi";

export async function fetchStablecoins(): Promise<{ assets: StableAsset[]; total: number }> {
  const raw = await fetchJSON<{ peggedAssets: Record<string, any>[] }>(`${STABLECOINS}/stablecoins?includePrices=true`);
  const assets: StableAsset[] = (raw.peggedAssets ?? []).map((a) => ({
    name: a.name ?? "?",
    symbol: a.symbol ?? "?",
    peg: String(a.pegType ?? "peggedUSD").replace("pegged", ""),
    circulating: a.circulating?.peggedUSD ?? null,
    prevDay: a.circulatingPrevDay?.peggedUSD ?? null,
    prevWeek: a.circulatingPrevWeek?.peggedUSD ?? null,
    price: a.price ?? null,
  }));
  const total = assets.reduce((acc, a) => acc + (a.circulating ?? 0), 0);
  return { assets, total };
}

/* ======================== DefiLlama — treasury (F) ======================== */

export async function fetchTreasury(slug: string): Promise<TreasurySnapshot> {
  const raw = await fetchJSON<Record<string, any>>(`${CORE}/treasury/${slug}`);

  const chainTvls: Record<string, Record<string, any>> = raw.chainTvls ?? {};
  const externalChains: string[] = [];
  const ownChains: string[] = [];
  for (const key of Object.keys(chainTvls)) {
    // "Ethereum-OwnTokens" is own-token holdings; bare "OwnTokens" is an
    // aggregate that would double-count — skip it when summing.
    if (key === "OwnTokens") continue;
    if (key.endsWith("-OwnTokens")) ownChains.push(key);
    else externalChains.push(key);
  }

  // Build a unified total series by date (external + own), union of timestamps.
  const byDate = new Map<number, { external: number; own: number }>();
  const addRows = (keys: string[], bucket: "external" | "own") => {
    for (const key of keys) {
      const rows: { date: number; totalLiquidityUSD: number }[] = chainTvls[key]?.tvl ?? [];
      for (const row of rows) {
        const entry = byDate.get(row.date) ?? { external: 0, own: 0 };
        entry[bucket] += row.totalLiquidityUSD ?? 0;
        byDate.set(row.date, entry);
      }
    }
  };
  addRows(externalChains, "external");
  addRows(ownChains, "own");

  const totalSeries: DatePoint[] = [...byDate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([date, v]) => ({ date, value: v.external + v.own }));
  const externalSeries: DatePoint[] = [...byDate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([date, v]) => ({ date, value: v.external }));
  const ownSeries: DatePoint[] = [...byDate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([date, v]) => ({ date, value: v.own }));

  const current = raw.currentChainTvls ?? {};
  const externalNow = externalChains.reduce((acc, k) => acc + (current[k] ?? 0), 0);
  const ownNow = ownChains.reduce((acc, k) => acc + (current[k] ?? 0), 0);

  const chains = [...externalChains, ...ownChains]
    .filter((k) => (current[k] ?? 0) > 0)
    .map((k) => ({
      name: k.replace("-OwnTokens", ""),
      external: k.endsWith("-OwnTokens") ? 0 : (current[k] ?? 0),
      ownTokens: k.endsWith("-OwnTokens") ? (current[k] ?? 0) : 0,
    }));

  return {
    name: raw.name ?? slug,
    totalSeries,
    externalSeries,
    ownSeries,
    current: { total: externalNow + ownNow, external: externalNow, ownTokens: ownNow },
    chains,
    hallmarks: raw.hallmarks ?? [],
    mcap: raw.mcap ?? null,
  };
}

/* ========================= Ethplorer — holders (E) ======================== */
/**
 * Ethplorer's "freeKey" is a PUBLIC demo key published in their docs — it is
 * not a secret and is safe to ship client-side (rate limit: ~5 req/min).
 */
const ETHPLORER_KEY = "freeKey";
const UNI_TOKEN = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";

export async function fetchTokenInfo(token = UNI_TOKEN): Promise<TokenInfo> {
  const raw = await fetchJSON<Record<string, any>>(
    `https://api.ethplorer.io/getTokenInfo/${token}?apiKey=${ETHPLORER_KEY}`,
  );
  return {
    name: raw.name ?? "?",
    symbol: raw.symbol ?? "?",
    decimals: raw.decimals ?? 18,
    totalSupply: raw.totalSupply ?? 0,
    holdersCount: raw.holdersCount ?? null,
    transfersCount: raw.transfersCount ?? null,
    price: raw.price?.rate ?? null,
    lastUpdated: raw.lastUpdated ?? null,
  };
}

export async function fetchTopHolders(token = UNI_TOKEN): Promise<Holder[]> {
  const raw = await fetchJSON<{ holders: { address: string; balance: number; share: number }[] }>(
    `https://api.ethplorer.io/getTopTokenHolders/${token}?apiKey=${ETHPLORER_KEY}&limit=100`,
  );
  return raw.holders ?? [];
}

/** Well-known UNI holders. Verified against Etherscan label pages in docs/qa. */
export const KNOWN_LABELS: Record<string, string> = {
  "0x000000000000000000000000000000000000dead": "Burn",
  "0x1a9c8182c09f50c8318d769245bea52c32be35bc": "Uniswap: Timelock",
  "0xf977814e90da44bfa03b6295a0616a897441acec": "Binance: Hot Wallet",
  "0xaba63748c4b4def4a3319c3a29fe4829029d926f": "Binance: Hot Wallet",
};

/* ======================== Polymarket — gamma (B) ========================== */

const GAMMA = "https://gamma-api.polymarket.com";

function parseMaybeJson<T>(value: unknown): T | [] {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return [] as never;
    }
  }
  return (value as T) ?? ([] as never);
}

export async function fetchGammaMarkets(limit = 40): Promise<GammaMarket[]> {
  const rows = await fetchJSON<Record<string, any>[]>(
    `${GAMMA}/markets?closed=false&active=true&order=volume24hr&ascending=false&limit=${limit}`,
  );
  return rows.map((m) => {
    const outcomes = parseMaybeJson<string[]>(m.outcomes);
    const prices = parseMaybeJson<string[]>(m.outcomePrices).map((p) => Number(p));
    return {
      id: String(m.id),
      question: m.question ?? "?",
      slug: m.slug ?? "",
      eventTitle: m.events?.[0]?.title ?? null,
      outcomes,
      outcomePrices: prices,
      volume24h: m.volume24hr ?? 0,
      volumeTotal: Number(m.volume ?? m.volumeNum ?? 0),
      volume1w: m.volume1wk ?? 0,
      liquidity: m.liquidityNum ?? Number(m.liquidity ?? 0),
      endDate: m.endDate ?? null,
      spread: m.spread ?? null,
      lastTradePrice: m.lastTradePrice ?? null,
      clobTokenIds: parseMaybeJson<string[]>(m.clobTokenIds),
      negRisk: Boolean(m.negRisk),
    };
  });
}

export async function fetchGammaEvents(limit = 15): Promise<GammaEvent[]> {
  const rows = await fetchJSON<Record<string, any>[]>(
    `${GAMMA}/events?closed=false&order=volume24hr&ascending=false&limit=${limit}`,
  );
  return rows.map((e) => ({
    id: String(e.id),
    title: e.title ?? "?",
    slug: e.slug ?? "",
    volume24h: e.volume24hr ?? 0,
    volume: e.volume ?? 0,
    liquidity: e.liquidity ?? 0,
    openInterest: e.openInterest ?? null,
    seriesSlug: e.seriesSlug ?? e.series?.[0]?.slug ?? null,
    endDate: e.endDate ?? null,
    markets: e.markets?.length ?? 0,
  }));
}

/** CLOB outcome-price history (hourly-ish points) for TWAP math. */
export async function fetchOutcomeHistory(clobTokenId: string): Promise<PricePoint[]> {
  const raw = await fetchJSON<{ history?: { t: number; p: number }[] }>(
    `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(clobTokenId)}&interval=1w&fidelity=60`,
  );
  return raw.history ?? [];
}

/**
 * Time-weighted average price over the last `days` days.
 * TWAP = Σ(pᵢ·Δtᵢ) / ΣΔtᵢ — the same definition Umia's decision-market
 * dashboards use for outcome-vs-spot margin checks.
 */
export function twap(history: PricePoint[], days = 7): number | null {
  if (history.length < 2) return null;
  const cutoff = history[history.length - 1].t - days * 86_400;
  const window = history.filter((p) => p.t >= cutoff);
  if (window.length < 2) return null;
  let weighted = 0;
  let total = 0;
  for (let i = 1; i < window.length; i++) {
    const dt = window[i].t - window[i - 1].t;
    weighted += window[i].p * dt;
    total += dt;
  }
  return total > 0 ? weighted / total : null;
}

/* ===================== Manifold Markets — fallback (B) ==================== */

const MANIFOLD = "https://api.manifold.markets/v0";

/**
 * Manifold Markets, mapped into the same shape the tables already render.
 *
 * Used as a fallback when Polymarket is unreachable (e.g. national DNS blocks
 * of *.polymarket.com). Manifold is keyless and CORS-open; it is a play-money
 * venue, so it is presented as an explicit fallback, never as Polymarket data.
 *
 * The API only sorts by time, so we fetch recently-active markets and rank by
 * 24h volume client-side.
 */
export async function fetchManifoldMarkets(limit = 400): Promise<GammaMarket[]> {
  const rows = await fetchJSON<Record<string, any>[]>(
    `${MANIFOLD}/markets?limit=${limit}&sort=last-bet-time&order=desc`,
    { timeoutMs: 20_000 },
  );
  return rows
    .filter((m) => !m.isResolved && typeof m.probability === "number")
    .map((m) => ({
      id: String(m.id),
      question: m.question ?? "?",
      slug: m.slug ?? "",
      eventTitle: Array.isArray(m.groupSlugs) && m.groupSlugs.length > 0 ? m.groupSlugs[0] : null,
      outcomes: ["YES"],
      outcomePrices: [m.probability as number],
      volume24h: m.volume24Hours ?? 0,
      volumeTotal: m.volume ?? 0,
      volume1w: 0,
      liquidity: m.totalLiquidity ?? 0,
      endDate: m.closeTime ? new Date(m.closeTime).toISOString() : null,
      spread: null,
      lastTradePrice: m.probability as number,
      clobTokenIds: [String(m.id)], // reused as the history handle
      negRisk: false,
    }))
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

/** Manifold price history rebuilt from bets (`probAfter`) — seconds. */
export async function fetchManifoldHistory(contractId: string): Promise<PricePoint[]> {
  const bets = await fetchJSON<Record<string, any>[]>(
    `${MANIFOLD}/bets?contractId=${encodeURIComponent(contractId)}&limit=1000`,
    { timeoutMs: 20_000 },
  );
  return bets
    .filter((b) => typeof b.probAfter === "number" && typeof b.createdTime === "number")
    .map((b) => ({ t: Math.round((b.createdTime as number) / 1000), p: b.probAfter as number }))
    .sort((a, b) => a.t - b.t);
}

/* ========================== CoinGecko — prices (C) ======================== */

const COINGECKO = "https://api.coingecko.com/api/v3";

/** Daily USD closes for a coin id: [[ms, price], ...] -> PricePoint[] (seconds). */
export async function fetchMarketChart(coinId: string, days = 90): Promise<PricePoint[]> {
  const raw = await fetchJSON<{ prices: [number, number][] }>(
    `${COINGECKO}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { retries: 1, timeoutMs: 15_000 },
  );
  return (raw.prices ?? []).map(([ms, p]) => ({ t: Math.round(ms / 1000), p }));
}

/** Simple moving / time-weighted average of daily closes — used as TWAP proxy. */
export function rollingAverage(points: PricePoint[], windowDays: number): PricePoint[] {
  const out: PricePoint[] = [];
  const windowSec = windowDays * 86_400;
  for (let i = 0; i < points.length; i++) {
    const start = points[i].t - windowSec;
    let weighted = 0;
    let total = 0;
    for (let j = 0; j <= i; j++) {
      const prevT = j > 0 ? points[j - 1].t : points[j].t;
      if (points[j].t < start) continue;
      const dt = points[j].t - prevT;
      weighted += points[j].p * dt;
      total += dt;
    }
    out.push({ t: points[i].t, p: total > 0 ? weighted / total : points[i].p });
  }
  return out;
}
