"""QA probe: does /overview/dexs and /overview/fees honour the chain param?

Run: uv run --with httpx python scripts/probe_chain_dexs.py
"""
from __future__ import annotations

import httpx


def main() -> None:
    c = httpx.Client(timeout=30)
    g = c.get("https://api.llama.fi/overview/dexs",
              params={"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"}).json()
    print("GLOBAL dexs total24h:", g.get("total24h"), "| protocols:", len(g.get("protocols") or []))
    for chain in ("Ethereum", "Solana", "Moonbeam", "Plasma", "Arc", "Harmony", "Corn", "Base", "BSC"):
        try:
            r = c.get("https://api.llama.fi/overview/dexs",
                      params={"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true",
                              "chain": chain}).json()
            print(f"  dexs chain={chain:10s} total24h={r.get('total24h')} protocols={len(r.get('protocols') or [])}")
        except Exception as exc:  # noqa: BLE001
            print(f"  dexs chain={chain} ERROR {exc}")
    for chain in ("Ethereum", "Moonbeam"):
        r = c.get("https://api.llama.fi/overview/fees",
                  params={"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true",
                          "chain": chain}).json()
        print(f"  fees chain={chain:10s} total24h={r.get('total24h')} protocols={len(r.get('protocols') or [])}")


if __name__ == "__main__":
    main()
