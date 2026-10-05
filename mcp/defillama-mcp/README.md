# defillama-mcp — local, keyless DefiLlama MCP server

A production-ready **Model Context Protocol** server that replicates the core capabilities of the
hosted DefiLlama MCP using **only the free public REST APIs** — no API key, no OAuth, no subscription.

| API | Base URL | Key |
| --- | --- | --- |
| Core (TVL, protocols, chains, dexs, fees) | `https://api.llama.fi` | none |
| Coins (prices) | `https://coins.llama.fi` | none |
| Yields (pools) | `https://yields.llama.fi` | none |
| Stablecoins | `https://stablecoins.llama.fi` | none |

- **Transport:** stdio
- **Framework:** [FastMCP](https://github.com/jlowin/fastmcp) + `httpx` (async) + `pydantic`
- **Python:** ≥ 3.10

## Tools (9)

| Tool | Endpoint | Returns |
| --- | --- | --- |
| `get_protocol(name, include_history=False)` | `/protocol/{name}` | compact JSON: TVL, chains, allocations — history stripped unless asked |
| `search_protocols(query, limit=10)` | `/protocols` (cached 10 min) | Top-N Markdown table — never the raw 4k+ array |
| `get_chain_tvls(limit=25)` | `/v2/chains` | Top-N chain TVL table + totals |
| `get_dex_volumes(chain?, limit=15)` | `/overview/dexs` | Top-N DEX volume table + totals |
| `get_protocol_fees(chain?, limit=15)` | `/overview/fees` | Top-N fees/revenue table + totals |
| `get_token_prices(coins, search_width="4h")` | `/prices/current/{coins}` | compact price map |
| `get_historical_price(coins, timestamp)` | `/prices/historical/{ts}/{coins}` | compact price map |
| `search_yield_pools(chain?, project?, min_tvl=1e6, limit=20)` | `/pools` (cached 10 min) | Top-N pool table with APY + risk flags |
| `get_stablecoins_overview(include_prices=True, limit=15)` | `/stablecoins` | total supply + Top-N table |

## Prompts (3) — research skills from the hosted server, re-implemented

| Prompt | Purpose |
| --- | --- |
| `protocol_deep_dive(protocol_name)` | full protocol report: TVL → chain split → fee capture → token performance |
| `yield_opportunity_screen(chain, min_tvl)` | sequence yield searches: base vs reward APY, IL, sustainability |
| `chain_ecosystem_comparison(chains)` | TVL momentum, DEX volume, fee capture, per-chain scoring |

> MCP prompt arguments are strings by protocol spec — `min_tvl` and `chains` (comma-separated)
> are declared as strings and parsed server-side.

## Context-protection guardrails

LLM context is the scarce resource. This server enforces:

1. **Field filtering** — historical time-series arrays (`tvl`, `chainTvls`, `tokens`, `daily`, …)
   are stripped by default; opt in with `include_history=true`.
2. **Top-N limits** — `limit` defaults to **15**, hard-capped at **50** on every list tool.
3. **Payload truncation** — every response serialized as compact JSON
   (`separators=(',', ':')`) or Markdown tables, hard-capped at **12,000 chars**.
4. **Retry** — 3 attempts with exponential backoff on 429/5xx/timeouts.
5. **Caching** — the multi-MB `/protocols` and `/pools` payloads are cached for 10 minutes.

Measured output sizes (smoke test): every tool call stays **under 2.3 KB** of text.

## Install / run

```bash
# from this directory
uv sync                     # creates .venv + honors uv.lock
uv run defillama-mcp        # run the server (stdio)

# or one-shot, no install:
uvx --from . defillama-mcp

# health check (full MCP handshake + all tools/prompts against live APIs)
uv run python smoke_test.py
```

Requires [`uv`](https://docs.astral.sh/uv/). Plain `pip install .` works too (`defillama-mcp` entrypoint).

## Client configuration

### OpenCode — `opencode.json` (project root)

```json
{
  "mcp": {
    "defillama": {
      "type": "local",
      "command": ["uvx", "--from", "./mcp/defillama-mcp", "defillama-mcp"]
    }
  }
}
```

### Cursor — `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "defillama": {
      "command": "uvx",
      "args": ["--from", "./mcp/defillama-mcp", "defillama-mcp"]
    }
  }
}
```

### Claude Desktop — `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "defillama": {
      "command": "uvx",
      "args": ["--from", "/absolute/path/to/mcp/defillama-mcp", "defillama-mcp"]
    }
  }
}
```

### Generic MCP agent

```bash
uvx --from /path/to/mcp/defillama-mcp defillama-mcp   # stdio transport
```

## Why local instead of hosted?

The hosted `https://mcp.defillama.com/mcp` server requires a **paid API subscription**
(see `defillama-setup` skill → https://defillama.com/subscribe). Every endpoint used here is
free, public and keyless — this server gives the same core tool surface with zero cost and
full data ownership (nothing phoned home to a third party).

## Layout

```
mcp/defillama-mcp/
├── pyproject.toml   # build metadata, deps, entrypoint defillama-mcp
├── server.py        # client init, HTTP retry helper, 9 tools, 3 prompts, guardrails
├── smoke_test.py    # stdio JSON-RPC handshake + live call for every tool/prompt
├── uv.lock          # pinned, reproducible dependency tree
└── README.md        # this file
```
