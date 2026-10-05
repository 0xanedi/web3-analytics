"""QA probe: per-chain DEX volume / fees alternatives after chain param failed.

Candidates:
  1. path-style  /overview/dexs/{chain}
  2. /v2/historicalChainDexs/{chain}
  3. /overview/fees?chain= (verify ignore) / path-style
Run: uv run --with httpx python scripts/probe_chain_sources.py
"""
from __future__ import annotations

import httpx


def main() -> None:
    c = httpx.Client(timeout=30)

    for path in ("/overview/dexs/Ethereum", "/overview/dexs/ethereum"):
        try:
            r = c.get(f"https://api.llama.fi{path}",
                      params={"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"})
            body = r.json()
            print(f"{path}: status={r.status_code} total24h={body.get('total24h') if isinstance(body, dict) else type(body).__name__}")
        except Exception as exc:  # noqa: BLE001
            print(f"{path}: ERROR {exc}")

    for chain in ("Ethereum", "Moonbeam"):
        try:
            r = c.get(f"https://api.llama.fi/v2/historicalChainDexs/{chain}")
            body = r.json()
            if isinstance(body, dict):
                print(f"historicalChainDexs/{chain}: keys={sorted(body.keys())} dd_len={len(body.get('dd') or [])}",
                      "| last dd:", (body.get("dd") or [None])[-1])
            else:
                print(f"historicalChainDexs/{chain}: status={r.status_code} {type(body).__name__}")
        except Exception as exc:  # noqa: BLE001
            print(f"historicalChainDexs/{chain}: ERROR {exc}")

    for path in ("/overview/fees/Ethereum",):
        try:
            r = c.get(f"https://api.llama.fi{path}",
                      params={"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"})
            body = r.json()
            print(f"{path}: status={r.status_code} total24h={body.get('total24h') if isinstance(body, dict) else type(body).__name__}")
        except Exception as exc:  # noqa: BLE001
            print(f"{path}: ERROR {exc}")

    # Do per-protocol rows actually carry a chains array (for client-side filtering)?
    g = c.get("https://api.llama.fi/overview/dexs",
              params={"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"}).json()
    rows = g.get("protocols") or []
    with_chains = [p for p in rows if p.get("chains")]
    print(f"rows={len(rows)} with chains={len(with_chains)} sample chains:",
          [p.get("chains") for p in with_chains[:3]])


if __name__ == "__main__":
    main()
