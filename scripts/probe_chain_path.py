"""QA probe: validate path-style /overview/{dexs|fees}/{chain} filtering.

Run: uv run --with httpx python scripts/probe_chain_path.py
"""
from __future__ import annotations

import httpx

P = {"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"}


def main() -> None:
    c = httpx.Client(timeout=30)
    g = c.get("https://api.llama.fi/overview/dexs", params=P).json()
    print("GLOBAL total24h:", g.get("total24h"), "| top3:",
          [(p.get("name"), p.get("total24h")) for p in (g.get("protocols") or [])[:3]])

    for chain in ("Ethereum", "Solana", "Base", "Arbitrum", "BSC", "Moonbeam", "Corn", "Harmony", "Arc", "Plasma"):
        try:
            r = c.get(f"https://api.llama.fi/overview/dexs/{chain}", params=P)
            body = r.json()
            if not isinstance(body, dict) or "total24h" not in body:
                print(f"  dexs/{chain}: status={r.status_code} unexpected body: {str(body)[:120]}")
                continue
            top = [(p.get("name"), p.get("total24h")) for p in (body.get("protocols") or [])[:3]]
            print(f"  dexs/{chain:9s} total24h={body.get('total24h')!s:>18} n={len(body.get('protocols') or [])} top3={top}")
        except Exception as exc:  # noqa: BLE001
            print(f"  dexs/{chain}: ERROR {exc}")

    for chain in ("Ethereum", "Solana", "Moonbeam"):
        try:
            r = c.get(f"https://api.llama.fi/overview/fees/{chain}", params=P)
            body = r.json()
            if isinstance(body, dict) and "total24h" in body:
                top = [(p.get("name"), p.get("total24h")) for p in (body.get("protocols") or [])[:3]]
                print(f"  fees/{chain:9s} total24h={body.get('total24h')!s:>18} n={len(body.get('protocols') or [])} top3={top}")
            else:
                print(f"  fees/{chain}: status={r.status_code} {str(body)[:120]}")
        except Exception as exc:  # noqa: BLE001
            print(f"  fees/{chain}: ERROR {exc}")


if __name__ == "__main__":
    main()
