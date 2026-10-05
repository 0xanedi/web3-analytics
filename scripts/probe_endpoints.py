"""Endpoint shape probe: prints top-level keys + first record keys for each API
used by the dashboards. QA evidence that field assumptions match reality.

Run:  uv run --with httpx python scripts/probe_endpoints.py
"""

from __future__ import annotations

import json
import subprocess
import sys

import httpx

CORE = "https://api.llama.fi"
COINS = "https://coins.llama.fi"

# Polymarket: local ISP DNS blocks *.polymarket.com -> resolve via DoH, pin with curl --resolve.
DOH = "https://dns.google/resolve?name={host}&type=A"


def polymarket_get(path: str) -> object:
    host = "gamma-api.polymarket.com"
    ip = json.loads(httpx.get(DOH.format(host=host), timeout=10).text)["Answer"][0]["data"]
    out = subprocess.run(
        [
            "curl.exe" if sys.platform == "win32" else "curl",
            "-s",
            "--max-time",
            "20",
            "--resolve",
            f"{host}:443:{ip}",
            f"https://{host}{path}",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout)


def describe(label: str, data: object, depth: int = 0) -> None:
    pad = "  " * depth
    if isinstance(data, dict):
        print(f"{pad}{label}: dict keys = {list(data.keys())[:25]}")
        for key in list(data.keys())[:4]:
            value = data[key]
            if isinstance(value, (dict, list)):
                describe(str(key), value, depth + 1)
    elif isinstance(data, list):
        print(f"{pad}{label}: list len = {len(data)}")
        if data:
            describe("[0]", data[0], depth + 1)
    else:
        print(f"{pad}{label}: {type(data).__name__} = {str(data)[:80]}")


def main() -> None:
    client = httpx.Client(timeout=30, follow_redirects=True)

    describe("historicalChainTvl(global)", client.get(f"{CORE}/v2/historicalChainTvl").json())
    describe("chainTvl(Ethereum)", client.get(f"{CORE}/v2/historicalChainTvl/Ethereum").json())
    describe("overview/fees", client.get(f"{CORE}/overview/fees", params={
        "excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"}).json())
    describe("overview/dexs", client.get(f"{CORE}/overview/dexs", params={
        "excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"}).json())
    describe("treasury/lido", client.get(f"{CORE}/treasury/lido").json())
    proto = client.get(f"{CORE}/protocol/aave").json()
    describe("protocol/aave", {k: proto[k] for k in ("name", "currentChainTvls", "change_1d") if k in proto})
    print("protocol/aave tvl[0] =", proto.get("tvl", [{}])[0])
    describe("stablecoins", client.get("https://stablecoins.llama.fi/stablecoins",
                                       params={"includePrices": "true"}).json())
    describe("batch-chart(UNI)", client.get(f"{COINS}/batch-chart", params={
        "coins": "coingecko:uniswap", "start": 1756000000, "end": 1759600000,
        "span": 30, "period": "1d"}).json())
    describe("prices/current", client.get(f"{COINS}/prices/current/coingecko:uniswap").json())
    describe("ethplorer getTokenInfo", client.get(
        "https://api.ethplorer.io/getTokenInfo/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
        params={"apiKey": "freeKey"}).json())
    try:
        describe("gamma markets", polymarket_get("/markets?limit=2&closed=false&order=volume24hr&ascending=false"))
    except Exception as exc:  # noqa: BLE001
        print("gamma markets FAILED:", exc)
    try:
        describe("gamma events", polymarket_get("/events?limit=1&closed=false"))
    except Exception as exc:  # noqa: BLE001
        print("gamma events FAILED:", exc)


if __name__ == "__main__":
    main()
