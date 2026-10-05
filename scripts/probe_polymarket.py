"""QA probe: crypto-market coverage in gamma top-N + Polymarket raises reconciliation.

Run: uv run --with httpx python scripts/probe_polymarket.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys

import httpx

CRYPTO_RE = re.compile(r"\b(btc|bitcoin|eth|ethereum|sol|solana|xrp|ripple|ada|doge)\b", re.I)


def gamma_get(client: httpx.Client, path: str) -> object:
    ip = json.loads(client.get("https://dns.google/resolve?name=gamma-api.polymarket.com&type=A").text)["Answer"][0]["data"]
    cmd = ["curl.exe" if sys.platform == "win32" else "curl", "-s", "--max-time", "25",
           "--resolve", f"gamma-api.polymarket.com:443:{ip}",
           f"https://gamma-api.polymarket.com{path}"]
    out = subprocess.run(cmd, capture_output=True, check=True)
    return json.loads(out.stdout.decode("utf-8", errors="replace"))


def main() -> None:
    client = httpx.Client(timeout=30)
    for limit in (40, 100):
        markets = gamma_get(client, f"/markets?closed=false&active=true&order=volume24hr&ascending=false&limit={limit}")
        assert isinstance(markets, list)
        hits = []
        for m in markets:
            event_title = ""
            events = m.get("events") or []
            if events:
                event_title = events[0].get("title") or ""
            if CRYPTO_RE.search((m.get("question") or "") + " " + event_title):
                hits.append(m)
        print(f"limit={limit}: got {len(markets)}, crypto hits {len(hits)}")
        if limit == 100 and hits:
            for h in hits[:10]:
                print("   ", (h.get("question") or "")[:90], "| vol24:", h.get("volume24hr"))

    # tag-based query if top-N misses crypto markets
    try:
        tagged = gamma_get(client, "/events?closed=false&tag=crypto&order=volume24hr&ascending=false&limit=10")
        print("tag=crypto events:", len(tagged) if isinstance(tagged, list) else tagged)
        if isinstance(tagged, list):
            for e in tagged[:5]:
                print("   ", (e.get("title") or "")[:90], "| vol24:", e.get("volume24hr"))
    except Exception as exc:  # noqa: BLE001
        print("tag query failed:", exc)

    proto = client.get("https://api.llama.fi/protocol/polymarket", timeout=30).json()
    raises = proto.get("raises") or []
    print("raises count:", len(raises))
    for r in raises:
        print("   ", r.get("date"), r.get("round"), "amount=", r.get("amount"),
              "val=", r.get("valuation"), "lead=", (r.get("leadInvestors") or [None])[0])
    print("sum amount:", sum(r.get("amount") or 0 for r in raises))


if __name__ == "__main__":
    main()
