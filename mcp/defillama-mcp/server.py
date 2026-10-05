"""DefiLlama MCP server (local, keyless, stdio).

Replicates the core capabilities of the hosted DefiLlama MCP server using only the
free public DefiLlama REST APIs:

    Core API       https://api.llama.fi
    Coins API      https://coins.llama.fi
    Yields API     https://yields.llama.fi
    Stablecoins    https://stablecoins.llama.fi

Design goals:
  * No API key / no OAuth -- every endpoint is public.
  * Context-protection guardrails: history arrays are stripped by default,
    every list is Top-N clamped (default 15, hard cap 50) and payloads are
    serialized as compact JSON or Markdown tables.
  * Retry with exponential backoff on 429/5xx/timeouts.
  * Research skills from the hosted server are re-implemented as MCP Prompts.

Run:  defillama-mcp        (entrypoint installed by pip/uv)
      uvx --from . defillama-mcp
"""

from __future__ import annotations

import asyncio
import json
import math
import time
from typing import Any, Optional

import httpx
from fastmcp import FastMCP
from pydantic import Field

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

CORE_API = "https://api.llama.fi"
COINS_API = "https://coins.llama.fi"
YIELDS_API = "https://yields.llama.fi"
STABLECOINS_API = "https://stablecoins.llama.fi"

DEFAULT_LIMIT = 15          # Top-N default for every list tool
HARD_CAP = 50               # absolute max items ever returned
MAX_OUTPUT_CHARS = 12_000   # hard truncation so one call cannot blow a context window
RETRIES = 3
REQUEST_TIMEOUT = 30.0
CACHE_TTL = 600.0           # seconds; used for the multi-MB list endpoints

USER_AGENT = "defillama-mcp/1.0 (local, keyless)"

# Time-series keys that DefiLlama returns as [{"date": ..., "value": ...}, ...]
HISTORY_KEYS = frozenset(
    {
        "tvl",
        "chainTvls",
        "tokens",
        "tokensInUsd",
        "volume",
        "volumeUsd",
        "fees",
        "revenue",
        "hourly",
        "daily",
        "totalDataChart",
        "totalDataChartBreakdown",
    }
)

mcp = FastMCP(
    "defillama",
    instructions=(
        "Local, keyless DefiLlama MCP server backed by the free public DefiLlama "
        "REST APIs (api.llama.fi, coins.llama.fi, yields.llama.fi, stablecoins.llama.fi). "
        "Use search_protocols before get_protocol when unsure of a slug. List tools "
        "return Top-N Markdown tables (default 15, max 50); object tools return "
        "compact JSON with historical time-series stripped unless include_history=true."
    ),
)

# In-memory cache for the heavy list endpoints (/protocols, /pools).
_CACHE: dict[str, tuple[float, Any]] = {}


# --------------------------------------------------------------------------- #
# HTTP helper with retry logic
# --------------------------------------------------------------------------- #


async def _get(url: str, params: Optional[dict[str, Any]] = None) -> Any:
    """GET `url` with retry/backoff. Raises RuntimeError with a short message."""
    last_error: Exception | None = None
    async with httpx.AsyncClient(
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        follow_redirects=True,
    ) as client:
        for attempt in range(RETRIES):
            try:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code == 404:
                    raise RuntimeError(f"HTTP 404 from {url} (not found)")
                if resp.status_code == 429 or resp.status_code >= 500:
                    last_error = RuntimeError(f"HTTP {resp.status_code} from {url}")
                else:
                    raise RuntimeError(
                        f"HTTP {resp.status_code} from {url}: {resp.text[:180]}"
                    )
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
            await asyncio.sleep(0.5 * (2**attempt))
    raise RuntimeError(f"GET {url} failed after {RETRIES} attempts: {last_error}")


async def _get_cached(cache_key: str, url: str, params: Optional[dict] = None) -> Any:
    hit = _CACHE.get(cache_key)
    if hit and (time.monotonic() - hit[0]) < CACHE_TTL:
        return hit[1]
    data = await _get(url, params)
    _CACHE[cache_key] = (time.monotonic(), data)
    return data


# --------------------------------------------------------------------------- #
# Context-protection helpers
# --------------------------------------------------------------------------- #


def _clamp(limit: int) -> int:
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT
    return max(1, min(limit, HARD_CAP))


def _strip_history(obj: Any) -> Any:
    """Recursively drop time-series arrays so payloads stay small."""
    if isinstance(obj, dict):
        return {
            key: _strip_history(value)
            for key, value in obj.items()
            if key not in HISTORY_KEYS
        }
    if isinstance(obj, list):
        # A remaining list of {date: ...} dicts is still a time series -> drop it.
        if obj and isinstance(obj[0], dict) and "date" in obj[0]:
            return "[history stripped: pass include_history=true]"
        return [_strip_history(item) for item in obj]
    return obj


def _shorten(text: str) -> str:
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    return text[:MAX_OUTPUT_CHARS] + f"\n...[truncated {len(text) - MAX_OUTPUT_CHARS} chars]"


def _compact(data: Any) -> str:
    return _shorten(json.dumps(data, separators=(",", ":"), default=str))


def _num(value: Any, decimals: int = 2) -> Any:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
            return None
        if abs(value) >= 1000:
            return round(value, decimals)
        return round(value, max(decimals, 4))
    return value


def _fmt_usd(value: Any) -> str:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return "n/a"
    for unit, divisor in (("T", 1e12), ("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if abs(value) >= divisor:
            return f"${value / divisor:,.2f}{unit}"
    return f"${value:,.2f}"


def _md_table(rows: list[dict[str, Any]], columns: list[tuple[str, str]]) -> str:
    """Render rows as a compact Markdown table.

    columns: list of (key, header) pairs, in display order.
    """
    if not rows:
        return "_No results._"
    header = "| " + " | ".join(label for _, label in columns) + " |"
    sep = "| " + " | ".join("---" for _ in columns) + " |"
    lines = [header, sep]
    for row in rows:
        cells = []
        for key, _ in columns:
            value = row.get(key, "n/a")
            if isinstance(value, float):
                value = _num(value)
            if isinstance(value, str):
                value = value.replace("|", "/")[:60]
            elif value is None:
                value = "n/a"
            cells.append(str(value))
        lines.append("| " + " | ".join(cells) + " |")
    return _shorten("\n".join(lines))


def _usd_format(rows: list[dict[str, Any]], keys: list[str]) -> list[dict[str, Any]]:
    """Render the given numeric keys as compact USD strings (after sorting!)."""
    for row in rows:
        for key in keys:
            value = row.get(key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                row[key] = _fmt_usd(value)
    return rows


def _top_n(rows: list[dict[str, Any]], key: str, limit: int) -> list[dict[str, Any]]:
    """Sort desc by `key` (missing -> -inf), then clamp to Top-N."""
    def sort_key(row: dict[str, Any]) -> float:
        value = row.get(key)
        return value if isinstance(value, (int, float)) else float("-inf")

    return sorted(rows, key=sort_key, reverse=True)[: _clamp(limit)]


# --------------------------------------------------------------------------- #
# Tools -- Protocols & TVL
# --------------------------------------------------------------------------- #


@mcp.tool()
async def get_protocol(
    name: str = Field(description="Protocol slug, e.g. 'aave', 'uniswap-v3', 'lido'."),
    include_history: bool = Field(
        default=False,
        description="Keep full historical time-series arrays. Off by default to protect context.",
    ),
) -> str:
    """Current TVL, chain breakdown and token allocations for one protocol (/protocol/{name}).

    Returns compact JSON. Historical arrays (tvl, chainTvls, tokens...) are stripped
    unless include_history=true.
    """
    data = await _get(f"{CORE_API}/protocol/{name.strip().lower()}")
    if not include_history:
        data = _strip_history(data)
    return _compact(data)


@mcp.tool()
async def search_protocols(
    query: str = Field(description="Free-text matched against protocol name and slug."),
    limit: int = Field(default=10, description="Max matches (1-50, default 10)."),
) -> str:
    """Filter the full protocol registry by name/slug (never returns the raw 4k+ array).

    Uses a cached copy of /protocols (10 min TTL).
    """
    registry = await _get_cached("protocols", f"{CORE_API}/protocols")
    needle = query.strip().lower()
    matches = [
        {
            "name": p.get("name"),
            "slug": p.get("slug"),
            "symbol": p.get("symbol"),
            "category": p.get("category"),
            "chain": p.get("chain"),
            "chains": len(p.get("chains") or []),
            "tvl": p.get("tvl"),
            "change_1d": p.get("change_1d"),
            "change_7d": p.get("change_7d"),
        }
        for p in registry
        if needle in str(p.get("name", "")).lower() or needle in str(p.get("slug", "")).lower()
    ]
    matches = _top_n(matches, "tvl", limit)
    matches = _usd_format(matches, ["tvl"])
    return _md_table(
        matches,
        [
            ("name", "Protocol"),
            ("slug", "Slug"),
            ("category", "Category"),
            ("chain", "Chain"),
            ("tvl", "TVL (USD)"),
            ("change_1d", "1d %"),
            ("change_7d", "7d %"),
        ],
    )


@mcp.tool()
async def get_chain_tvls(
    limit: int = Field(default=25, description="Top chains by TVL (1-50, default 25)."),
) -> str:
    """TVL rankings across all tracked blockchains (/v2/chains). Markdown table."""
    chains = await _get(f"{CORE_API}/v2/chains")
    rows = [
        {
            "name": c.get("name"),
            "tvl": c.get("tvl"),
            "tokenSymbol": c.get("tokenSymbol") or "-",
            "chainId": c.get("chainId"),
        }
        for c in chains
    ]
    rows = _top_n(rows, "tvl", limit)
    rows = _usd_format(rows, ["tvl"])
    table = _md_table(
        rows,
        [
            ("name", "Chain"),
            ("tvl", "TVL (USD)"),
            ("tokenSymbol", "Gas"),
            ("chainId", "Chain ID"),
        ],
    )
    pretty = [f"{r['name']}: {_fmt_usd(r['tvl'])}" for r in rows]
    return table + "\n\n" + _shorten("\n".join(pretty))


# --------------------------------------------------------------------------- #
# Tools -- DEX volumes, fees & revenue
# --------------------------------------------------------------------------- #


def _overview_rows(payload: Any, limit: int, protocol_key: str = "protocols") -> tuple[list[dict], dict]:
    rows: list[dict] = []
    for p in payload.get(protocol_key, []) or []:
        rows.append(
            {
                "name": p.get("name"),
                "total24h": p.get("total24h"),
                "total7d": p.get("total7d"),
                "total30d": p.get("total30d"),
                "change_1d": p.get("change_1d"),
                "rev24h": p.get("rev24h") or p.get("revenue24h"),
                "chain": p.get("chain"),
            }
        )
    totals = {
        key: payload.get(key)
        for key in ("total24h", "total7d", "total30d", "totalAllTime", "change_1d")
        if payload.get(key) is not None
    }
    return _top_n(rows, "total24h", limit), totals


@mcp.tool()
async def get_dex_volumes(
    chain: Optional[str] = Field(
        default=None, description="Optional chain filter, e.g. 'Ethereum', 'Solana', 'Base'."
    ),
    limit: int = Field(default=15, description="Top protocols by 24h volume (1-50, default 15)."),
) -> str:
    """Daily and total DEX volumes, per chain if given (/overview/dexs).

    History arrays excluded by default; returns Top-N Markdown table + totals.
    """
    params: dict[str, Any] = {
        "excludeTotalDataChart": "true",
        "excludeTotalDataChartBreakdown": "true",
    }
    if chain:
        params["chain"] = chain
    payload = await _get(f"{CORE_API}/overview/dexs", params=params)
    rows, totals = _overview_rows(payload, limit)
    rows = _usd_format(rows, ["total24h", "total7d", "total30d"])
    table = _md_table(
        rows,
        [
            ("name", "Protocol"),
            ("chain", "Chain"),
            ("total24h", "24h vol"),
            ("total7d", "7d vol"),
            ("total30d", "30d vol"),
            ("change_1d", "1d %"),
        ],
    )
    scope = f"chain={chain}" if chain else "all chains"
    header = f"DEX volume ({scope}) -- totals: " + _compact(totals)
    return header + "\n\n" + table


@mcp.tool()
async def get_protocol_fees(
    chain: Optional[str] = Field(
        default=None, description="Optional chain filter, e.g. 'Ethereum', 'Solana'."
    ),
    limit: int = Field(default=15, description="Top protocols by 24h fees (1-50, default 15)."),
) -> str:
    """Top fee- and revenue-generating protocols (/overview/fees).

    Returns Top-N Markdown table (fees + 24h revenue where reported) + totals.
    """
    params: dict[str, Any] = {
        "excludeTotalDataChart": "true",
        "excludeTotalDataChartBreakdown": "true",
    }
    if chain:
        params["chain"] = chain
    payload = await _get(f"{CORE_API}/overview/fees", params=params)
    rows, totals = _overview_rows(payload, limit)
    rows = _usd_format(rows, ["total24h", "rev24h", "total7d", "total30d"])
    table = _md_table(
        rows,
        [
            ("name", "Protocol"),
            ("total24h", "Fees 24h"),
            ("rev24h", "Revenue 24h"),
            ("total7d", "Fees 7d"),
            ("total30d", "Fees 30d"),
            ("change_1d", "1d %"),
        ],
    )
    scope = f"chain={chain}" if chain else "all chains"
    header = f"Protocol fees ({scope}) -- totals: " + _compact(totals)
    return header + "\n\n" + table


# --------------------------------------------------------------------------- #
# Tools -- Token prices (Coins API)
# --------------------------------------------------------------------------- #


def _coins_param(coins: list[str]) -> str:
    cleaned = [c.strip() for c in coins if c and c.strip()]
    if not cleaned:
        raise ValueError("coins must contain at least one id, e.g. 'coingecko:bitcoin'")
    return ",".join(cleaned)


@mcp.tool()
async def get_token_prices(
    coins: list[str] = Field(
        description="Chain-prefixed ids: ['ethereum:0x...', 'coingecko:bitcoin', 'bitcoin'] ."
    ),
    search_width: str = Field(
        default="4h", description="Max age of the price sample, e.g. '4h', '1h', '10m'."
    ),
) -> str:
    """Current prices for one or more coins (/prices/current/{coins}). Compact JSON."""
    url = f"{COINS_API}/prices/current/{_coins_param(coins)}"
    payload = await _get(url, params={"search_width": search_width})
    return _compact(payload.get("coins", payload))


@mcp.tool()
async def get_historical_price(
    coins: list[str] = Field(description="Chain-prefixed ids, same format as get_token_prices."),
    timestamp: int = Field(description="Unix timestamp in seconds (UTC)."),
) -> str:
    """Price snapshot at a specific unix timestamp (/prices/historical/{timestamp}/{coins})."""
    url = f"{COINS_API}/prices/historical/{int(timestamp)}/{_coins_param(coins)}"
    payload = await _get(url)
    return _compact(payload.get("coins", payload))


# --------------------------------------------------------------------------- #
# Tools -- Yields & pools
# --------------------------------------------------------------------------- #


@mcp.tool()
async def search_yield_pools(
    chain: Optional[str] = Field(default=None, description="Chain filter, e.g. 'Ethereum'."),
    project: Optional[str] = Field(
        default=None, description="Project filter, e.g. 'aave-v3', 'lido', 'curve-dex'."
    ),
    min_tvl: float = Field(
        default=1_000_000, description="Ignore pools with TVL below this USD amount."
    ),
    limit: int = Field(default=20, description="Rows to return (1-50, default 20)."),
) -> str:
    """Yield pools ranked by TVL with APY and risk flags (/pools).

    Filters small pools out, returns Top-N Markdown table. Cached 10 min.
    """
    payload = await _get_cached("pools", f"{YIELDS_API}/pools")
    rows: list[dict] = []
    chain_l = chain.strip().lower() if chain else None
    project_l = project.strip().lower() if project else None
    for pool in payload.get("data", []) or []:
        if pool.get("tvlUsd", 0) < min_tvl:
            continue
        if chain_l and str(pool.get("chain", "")).lower() != chain_l:
            continue
        if project_l and project_l not in str(pool.get("project", "")).lower():
            continue
        rows.append(
            {
                "project": pool.get("project"),
                "chain": pool.get("chain"),
                "symbol": str(pool.get("symbol", ""))[:38],
                "tvlUsd": pool.get("tvlUsd"),
                "apy": pool.get("apy"),
                "apyBase": pool.get("apyBase"),
                "ilRisk": pool.get("ilRisk"),
                "stablecoin": pool.get("stablecoin"),
                "exposure": pool.get("exposure"),
            }
        )
    rows = _top_n(rows, "tvlUsd", limit)
    rows = _usd_format(rows, ["tvlUsd"])
    return _md_table(
        rows,
        [
            ("project", "Project"),
            ("chain", "Chain"),
            ("symbol", "Pool"),
            ("tvlUsd", "TVL (USD)"),
            ("apy", "APY %"),
            ("apyBase", "Base %"),
            ("ilRisk", "IL risk"),
            ("stablecoin", "Stable"),
        ],
    )


# --------------------------------------------------------------------------- #
# Tools -- Stablecoins
# --------------------------------------------------------------------------- #


@mcp.tool()
async def get_stablecoins_overview(
    include_prices: bool = Field(
        default=True, description="Attach current peg prices from the Coins API."
    ),
    limit: int = Field(default=15, description="Top pegged assets by circulation (1-50)."),
) -> str:
    """Circulation and market cap of tracked stablecoins (/stablecoins).

    Returns total supply + Top-N Markdown table.
    """
    payload = await _get(
        f"{STABLECOINS_API}/stablecoins",
        params={"includePrices": "true" if include_prices else "false"},
    )
    assets = payload.get("peggedAssets", []) or []
    rows: list[dict] = []
    for asset in assets:
        circulating = (asset.get("circulating") or {}).get("peggedUSD")
        rows.append(
            {
                "name": asset.get("name"),
                "symbol": asset.get("symbol"),
                "peg": asset.get("pegType", "").replace("peggedUSD", "USD"),
                "circulating": circulating,
                "price": asset.get("price"),
                "chg_1d": asset.get("change_1d"),
                "chg_7d": asset.get("change_7d"),
            }
        )
    rows = _top_n(rows, "circulating", limit)
    rows = _usd_format(rows, ["circulating"])
    total = (payload.get("totalCirculatingUSD") or {}).get("peggedUSD")
    table = _md_table(
        rows,
        [
            ("name", "Stablecoin"),
            ("symbol", "Symbol"),
            ("peg", "Peg"),
            ("circulating", "Circ. (USD)"),
            ("price", "Price"),
            ("chg_1d", "1d %"),
            ("chg_7d", "7d %"),
        ],
    )
    return f"Total stablecoin circulation: {_fmt_usd(total)}\n\n" + table


# --------------------------------------------------------------------------- #
# MCP Prompts -- research skills
# --------------------------------------------------------------------------- #


@mcp.prompt()
def protocol_deep_dive(protocol_name: str) -> str:
    """Step-by-step instructions for a full single-protocol research report."""
    return f"""Produce a research report on the protocol '{protocol_name}' using the local DefiLlama tools:

1. Call search_protocols(query='{protocol_name}') to confirm the exact slug; retry get_protocol with the slug if needed.
2. get_protocol(name='<slug>') -- record current TVL, category, listed chains and chain TVL split.
   - Flag multi-chain presence: is TVL concentrated on one chain (>90%) or distributed?
3. get_protocol_fees(chain=None) and get_dex_volumes(chain=None) -- locate the protocol's fee/revenue capture:
   - 24h/7d/30d fees, 24h revenue (keep fees vs revenue distinct: revenue = protocol share), trend vs 1d change.
4. get_token_prices(coins=['coingecko:<id>']) with the protocol's gecko id (from step 2) -- native token performance;
   add get_historical_price(coins=[...], timestamp=...) for a 30d and 90d reference point.
5. Synthesize: 5-bullet thesis (TVL trend, chain risk, fee capture, token performance, open questions).
Keep every list Top-N and never request raw historical arrays."""


@mcp.prompt()
def yield_opportunity_screen(chain: str, min_tvl: str = "1000000") -> str:
    """Sequenced screening of yield opportunities on a chain.

    min_tvl is a plain string (MCP prompt arguments are strings) -- e.g. '1000000'.
    """
    try:
        min_tvl_usd = int(float(min_tvl))
    except (TypeError, ValueError):
        min_tvl_usd = 1_000_000
    return f"""Screen yield opportunities on '{chain}' with minimum TVL {min_tvl_usd} USD:

1. search_yield_pools(chain='{chain}', min_tvl={min_tvl_usd}, limit=50) -- take the Top-N by TVL.
2. Cut pools with APY driven by ephemeral rewards: compare apy vs apyBase; if apy >> apyBase, the yield is
   token-incentivized and likely to decay -- deprioritize unless base APY also clears the bar.
3. Prefer pools flagged stablecoin=true and exposure=single for IL-free yield; call out any IL risk (ilRisk=yes)
   for volatile pairs as a separate, higher-risk bucket.
4. For the top 3 candidates, call search_yield_pools(project='<project>') to compare sibling pools on the same
   protocol and confirm the pool is a core market, not a fringe pool.
5. Assess sustainability: APY x TVL = annualized revenue to LPs. If implied revenue is implausible versus the
   protocol's fee base (get_protocol_fees), mark the yield as mercenary.
6. Output a ranked table: pool, TVL, base APY, reward APY, IL risk, verdict (core / mercenary / avoid).
Cap the table at 10 rows."""


@mcp.prompt()
def chain_ecosystem_comparison(chains: str) -> str:
    """Comparative analysis across the supplied chains.

    chains: comma-separated list, e.g. 'Ethereum,Solana,Base' (MCP prompt args are strings).
    """
    chain_list = [c.strip() for c in chains.split(",") if c.strip()]
    if not chain_list:
        chain_list = ["Ethereum", "Solana"]
    return f"""Compare the ecosystems of these chains: {', '.join(chain_list)}.

1. get_chain_tvls(limit=50) -- TVL for each target chain, rank, and share of tracked DeFi TVL.
2. For each chain: get_dex_volumes(chain='<chain>', limit=10) -- 24h/7d DEX volume, top 3 venues,
   volume-to-TVL ratio (capital efficiency proxy).
3. For each chain: get_protocol_fees(chain='<chain>', limit=10) -- fee generation and revenue capture.
4. stablecoin angle: get_stablecoins_overview() for overall dollar liquidity, then reason about which chain
   benefits most from stablecoin supply (note chain-level stablecoin splits are not in this tool).
5. Score each chain 1-5 on: TVL depth, volume momentum (change_1d), fee capture, top-protocol concentration.
6. Output: comparison table + 3-line verdict per chain (strength, weakness, what to watch).
Do not exceed 50 rows total across all calls."""


# --------------------------------------------------------------------------- #
# Entrypoint
# --------------------------------------------------------------------------- #


def main() -> None:
    """Run the server over stdio (transport chosen by MCP client config)."""
    mcp.run(transport="stdio", show_banner=False)


if __name__ == "__main__":
    main()
