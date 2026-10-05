"""Refine Manifold probe: valid sort params, binary coverage, history series size.

Run: uv run --with httpx python scripts/probe_manifold2.py
"""
from __future__ import annotations

import httpx

BASE = "https://api.manifold.markets/v0"


def main() -> None:
    c = httpx.Client(timeout=30, headers={"User-Agent": "web3-analytics-qa/1.0"})
    for sort in ("24-hour-vol", "liquidity", "volume", "newest"):
        try:
            r = c.get(f"{BASE}/markets", params={"limit": 50, "sort": sort, "order": "desc"})
            body = r.json()
            if isinstance(body, list):
                binary = [m for m in body if m.get("probability") is not None]
                unresolved = [m for m in body if not m.get("isResolved")]
                print(f"sort={sort:12s} HTTP {r.status_code} n={len(body)} binary={len(binary)} unresolved={len(unresolved)}")
                for m in sorted(body, key=lambda x: -(x.get("volume24Hours") or 0))[:3]:
                    print(f"      v24={m.get('volume24Hours')!r:>10} p={m.get('probability')!r:>8} {m.get('question','')[:60]}")
            else:
                print(f"sort={sort:12s} HTTP {r.status_code} non-list: {str(body)[:120]}")
        except Exception as exc:  # noqa: BLE001
            print(f"sort={sort}: ERROR {exc}")

    print("\n--- bets history size for a top binary market ---")
    ms = c.get(f"{BASE}/markets", params={"limit": 50, "sort": "24-hour-vol", "order": "desc"}).json()
    binary = [m for m in ms if m.get("probability") is not None]
    if binary:
        m = sorted(binary, key=lambda x: -(x.get("volume24Hours") or 0))[0]
        print("market:", m["question"][:70], "| id:", m["id"], "| prob:", m.get("probability"))
        bets = c.get(f"{BASE}/bets", params={"contractId": m["id"], "limit": 1000}).json()
        ts = [b.get("createdTime") for b in bets if b.get("probAfter") is not None]
        print("bets:", len(bets), "| with probAfter:", len(ts), "| t range:", (min(ts), max(ts)) if ts else None)


if __name__ == "__main__":
    main()
