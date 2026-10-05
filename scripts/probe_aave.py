"""QA probe: why Protocol Overview charts render empty for Aave.

Checks top-level tvl series, chainTvls historical keys, and summary/fees chart.
Run: uv run --with httpx python scripts/probe_aave.py
"""
from __future__ import annotations

import httpx


def main() -> None:
    c = httpx.Client(timeout=40)

    p = c.get("https://api.llama.fi/protocol/aave").json()
    tvl = p.get("tvl") or []
    print("top-level tvl len:", len(tvl), "| last:", tvl[-1] if tvl else None)
    print("top-level keys sample:", sorted(p.keys()))
    ct = p.get("chainTvls") or {}
    print("chainTvls keys:", list(ct.keys())[:30])
    for k in ("Ethereum", "Ethereum-OwnTokens", "Borrowed"):
        v = ct.get(k) or {}
        arr = v.get("tvl") if isinstance(v, dict) else None
        print(f"  chainTvls[{k}]: type={type(v).__name__} tvl_len={len(arr) if isinstance(arr, list) else 'n/a'}",
              "last=", (arr[-1] if isinstance(arr, list) and arr else None))
    cct = p.get("currentChainTvls") or {}
    print("currentChainTvls sample:", dict(list(cct.items())[:8]))
    print("description len:", len(p.get("description") or ""), "| chains:", p.get("chains"))
    print("change_1d:", p.get("change_1d"), "change_7d:", p.get("change_7d"))

    f = c.get("https://api.llama.fi/summary/fees/aave").json()
    tdc = f.get("totalDataChart") or []
    print("summary/fees/aave totalDataChart len:", len(tdc), "| last:", tdc[-1] if tdc else None)
    print("summary/fees keys:", sorted(f.keys()))


if __name__ == "__main__":
    main()
