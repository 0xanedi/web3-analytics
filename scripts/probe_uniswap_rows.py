"""QA probe: Uniswap family rows in /overview/dexs — reconcile headline vs table.

Run: uv run --with httpx python scripts/probe_uniswap_rows.py
"""
from __future__ import annotations

import re

import httpx

P = {"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"}


def main() -> None:
    c = httpx.Client(timeout=30)
    dex = c.get("https://api.llama.fi/overview/dexs", params=P).json()
    fee = c.get("https://api.llama.fi/overview/fees", params=P).json()
    rx = re.compile(r"uniswap", re.I)
    drows = [r for r in (dex.get("protocols") or []) if rx.search(r.get("name") or "")]
    frows = {r.get("name"): r for r in (fee.get("protocols") or []) if rx.search(r.get("name") or "")}
    dsum = 0.0
    for r in sorted(drows, key=lambda x: -(x.get("total24h") or 0)):
        v = r.get("total24h")
        dsum += v or 0
        print(f"  dex  {r.get('name'):22s} 24h={v!s:>16} 7d={r.get('total7d')} fee24h={frows.get(r.get('name'), {}).get('total24h')}")
    print("dex rows sum total24h:", dsum)
    print("global totals:", dex.get("total24h"), fee.get("total24h"))


if __name__ == "__main__":
    main()
