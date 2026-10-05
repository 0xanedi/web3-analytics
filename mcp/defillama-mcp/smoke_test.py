"""Smoke test for the local DefiLlama MCP server.

Speaks real MCP over stdio (newline-delimited JSON-RPC) as a subprocess and calls
every tool and prompt once against the live, keyless DefiLlama APIs.

Run:  uv run python smoke_test.py
Exit code 0 = all green.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from typing import Any

TIMEOUT_S = 90.0

TOOL_CALLS: list[tuple[str, dict[str, Any]]] = [
    ("search_protocols", {"query": "aave", "limit": 5}),
    ("get_protocol", {"name": "aave"}),
    ("get_chain_tvls", {"limit": 5}),
    ("get_dex_volumes", {"chain": "Ethereum", "limit": 5}),
    ("get_protocol_fees", {"limit": 5}),
    ("get_token_prices", {"coins": ["coingecko:bitcoin", "coingecko:ethereum"]}),
    ("get_historical_price", {"coins": ["coingecko:bitcoin"], "timestamp": 1735689600}),
    ("search_yield_pools", {"chain": "Ethereum", "min_tvl": 10_000_000, "limit": 5}),
    ("get_stablecoins_overview", {"limit": 5}),
]

PROMPT_CALLS: list[dict[str, Any]] = [
    {"name": "protocol_deep_dive", "arguments": {"protocol_name": "aave"}},
    {"name": "yield_opportunity_screen", "arguments": {"chain": "Ethereum", "min_tvl": "1000000"}},
    {"name": "chain_ecosystem_comparison", "arguments": {"chains": "Ethereum,Solana"}},
]


class McpClient:
    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            [sys.executable, "server.py"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
            cwd=__file__.rsplit("\\", 1)[0] if "\\" in __file__ else __file__.rsplit("/", 1)[0],
        )
        self._id = 0

    def request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._id += 1
        msg = json.dumps({"jsonrpc": "2.0", "id": self._id, "method": method, "params": params or {}})
        assert self.proc.stdin is not None
        self.proc.stdin.write(msg + "\n")
        self.proc.stdin.flush()
        deadline = time.monotonic() + TIMEOUT_S
        assert self.proc.stdout is not None
        while time.monotonic() < deadline:
            line = self.proc.stdout.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if data.get("id") == self._id:
                if "error" in data:
                    raise RuntimeError(f"{method} -> {data['error']}")
                return data.get("result", {})
        raise TimeoutError(f"no response for {method} within {TIMEOUT_S}s")

    def notify(self, method: str) -> None:
        msg = json.dumps({"jsonrpc": "2.0", "method": method, "params": {}})
        assert self.proc.stdin is not None
        self.proc.stdin.write(msg + "\n")
        self.proc.stdin.flush()

    def close(self) -> str:
        if self.proc.stdin:
            try:
                self.proc.stdin.close()
            except OSError:
                pass
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        err = self.proc.stderr.read() if self.proc.stderr else ""
        return err


def main() -> int:
    client = McpClient()
    failures: list[str] = []

    init = client.request(
        "initialize",
        {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "smoke-test", "version": "1.0"},
        },
    )
    server_info = init.get("serverInfo", {})
    print(f"[init] {server_info.get('name')} v{server_info.get('version')}")
    client.notify("notifications/initialized")

    tools = client.request("tools/list")
    names = sorted(t["name"] for t in tools.get("tools", []))
    print(f"[tools/list] {len(names)}: {', '.join(names)}")
    if len(names) != 9:
        failures.append(f"expected 9 tools, got {len(names)}")

    prompts = client.request("prompts/list")
    prompt_names = sorted(p["name"] for p in prompts.get("prompts", []))
    print(f"[prompts/list] {len(prompt_names)}: {', '.join(prompt_names)}")
    if len(prompt_names) != 3:
        failures.append(f"expected 3 prompts, got {len(prompt_names)}")

    for tool, args in TOOL_CALLS:
        started = time.monotonic()
        try:
            result = client.request("tools/call", {"name": tool, "arguments": args})
            text = "".join(
                c.get("text", "") for c in result.get("content", []) if c.get("type") == "text"
            )
            elapsed = time.monotonic() - started
            if result.get("isError"):
                failures.append(f"{tool}: {text[:160]}")
                print(f"[call] {tool:<26} ERROR  {elapsed:5.1f}s  {text[:120]}")
            else:
                print(f"[call] {tool:<26} ok     {elapsed:5.1f}s  {len(text):>6} chars")
        except Exception as exc:  # noqa: BLE001 - smoke test reports everything
            failures.append(f"{tool}: {exc}")
            print(f"[call] {tool:<26} FAIL   {exc}")

    for prompt_args in PROMPT_CALLS:
        name = prompt_args["name"]
        try:
            result = client.request("prompts/get", prompt_args)
            length = sum(len(m.get("content", "").get("text", "")) for m in result.get("messages", []))
            print(f"[prompt] {name:<26} ok     {length} chars")
            if length < 100:
                failures.append(f"prompt {name}: suspiciously short ({length} chars)")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"prompt {name}: {exc}")
            print(f"[prompt] {name:<26} FAIL   {exc}")

    stderr_tail = client.close().strip()
    if stderr_tail:
        print(f"[server stderr] {stderr_tail.splitlines()[-1][:200]}")

    if failures:
        print("\nSMOKE TEST FAILED:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("\nSMOKE TEST PASSED: 9 tools, 3 prompts, live keyless APIs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
