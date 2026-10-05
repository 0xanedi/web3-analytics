# Network notes

Environment-specific quirks encountered while QA-ing these dashboards locally. **None of
these affect visitors** to the published site — they are documented so a future contributor
doesn't misdiagnose them as bugs in the dashboards.

## Polymarket DNS resolution

On the machine this repo was built on, the local ISP resolver returns **NXDOMAIN** for
`*.polymarket.com`, while public DNS (e.g. Google DoH) resolves those hosts normally
(Cloudflare IPs). The gamma API does return `access-control-allow-origin: *`, so a visitor's
browser is unaffected — only local build/QA tooling on that network is.

Workarounds used during local QA only:

```bash
# resolve via public DoH, then pin the IP for curl
curl --resolve gamma-api.polymarket.com:443:104.18.34.205 \
     "https://gamma-api.polymarket.com/markets?limit=1"
```

For headless Chrome, the equivalent is a host-resolver rule:

```
--host-resolver-rules="MAP gamma-api.polymarket.com 104.18.34.205"
```

The local QA screenshot helper (`qa_shot.js`, in the browser-tooling skill, not in this repo)
takes a `--polymarket` flag that applies exactly this rule.

## Country-level blocking and the fallback venue

The `*.polymarket.com` NXDOMAIN above is consistent with a **national/ISP DNS block**
(Polymarket is restricted in several countries). That is not just a local dev annoyance: it
would blank the Decision Markets page for *every* visitor on such a network.

Mitigations, in order of preference:

1. **Fallback venue.** The page catches a Polymarket failure per-source and switches to
   **Manifold Markets** (`api.manifold.markets`) — keyless, CORS-open, not blocked — with a
   visible banner naming the cause. Polymarket remains primary everywhere it is reachable.
2. **Per-source isolation.** The page uses `Promise.allSettled`, so DefiLlama panels (TVL,
   funding, milestones) still render when the prediction-market source is unreachable. One
   source failing never takes down the page.

### Kalshi was evaluated and rejected

Kalshi (`api.elections.kalshi.com`) is keyless and *is* reachable from blocked networks, but
it **refuses cross-origin browser requests**:

| Request | Result |
|---|---|
| no `Origin` | `200` |
| `Origin: https://kalshi.com` | `200` |
| `Origin: https://example.com` | `403` |
| `Origin: https://0xanedi.github.io` | `403` |
| `OPTIONS` preflight | `403` |

A static client-side app cannot call it without a server proxy, so it was not used.

## Why this is in the repo

Because the first symptom looked like a dashboard bug ("Decision Markets page shows no data"),
and the actual cause was the network. Writing it down is cheaper than rediscovering it.

## GitHub SSH

Outbound SSH to `github.com:22` timed out on this network. HTTPS with Git Credential Manager
worked, and that is what this repo is configured for (a per-repo `credential.https://github.com.username`
hint keeps the account scoped to this repository).
