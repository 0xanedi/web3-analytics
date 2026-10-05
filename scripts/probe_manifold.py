"""Probe Manifold Markets API shape (keyless, CORS-open) for the fallback source.

Run: uv run --with httpx python scripts/probe_manifold.py
"""
from __future__ import annotations

import httpx

BASE = "https://api.manifold.markets/v0"


def main() -> None:
    c = httpx.Client(timeout=30, headers={"User-Agent": "web3-analytics-qa/1.0"})

    ms = c.get(f"{BASE}/markets", params={"limit": 3}).json()
    print("markets type:", type(ms).__name__, "| count:", len(ms) if isinstance(ms, list) else "n/a")
    m = ms[0]
    print("market keys:", sorted(m.keys()))
    for k in ("id", "question", "outcomeType", "probability", "volume", "volume24Hours",
              "totalLiquidity", "closeTime", "createdTime", "isResolved", "url", "groupSlug"):
        print(f"   {k} = {m.get(k)!r}")

    mid = m["id"]
    print("\n--- /market/{id} ---")
    d = c.get(f"{BASE}/market/{mid}").json()
    print("keys:", sorted(d.keys()))
    for k in ("probability", "volume", "volume24Hours", "totalLiquidity", "pool", "closeTime"):
        print(f"   {k} = {d.get(k)!r}")

    print("\n--- /bets?contractId (history source) ---")
    try:
        bets = c.get(f"{BASE}/bets", params={"contractId": mid, "limit": 5}).json()
        print("bets count:", len(bets) if isinstance(bets, list) else "n/a")
        if isinstance(bets, list) and bets:
            print("bet keys:", sorted(bets[0].keys()))
            for b in bets[:3]:
                print("   probAfter=", b.get("probAfter"), "createdTime=", b.get("createdTime"), "amount=", b.get("amount"))
    except Exception as exc:  # noqa: BLE001
        print("bets ERROR:", exc)

    for path in (f"/market/{mid}/history", f"/market/{mid}/prob", f"/market/{mid}/positions"):
        try:
            r = c.get(f"{BASE}{path}")
            print(f"\n{path}: HTTP {r.status_code} {r.text[:140]}")
        except Exception as exc:  # noqa: BLE001
            print(f"\n{path}: ERROR {exc}")

    print("\n--- top by 24h volume ---")
    top = c.get(f"{BASE}/markets", params={"limit": 10, "sort": "liquidity", "order": "desc"}).json()
    if isinstance(top, list):
        for t in top[:5]:
            print(f"   vol24={t.get('volume24Hours')!r:>12} liq={t.get('totalLiquidity')!r:>12} p={t.get('probability')!r:>6} {t.get('question','')[:70]}")


if __name__ == "__main__":
    main()
