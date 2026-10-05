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

## Why this is in the repo

Because the first symptom looked like a dashboard bug ("Decision Markets page shows no data"),
and the actual cause was the network. Writing it down is cheaper than rediscovering it.

## GitHub SSH

Outbound SSH to `github.com:22` timed out on this network. HTTPS with Git Credential Manager
worked, and that is what this repo is configured for (a per-repo `credential.https://github.com.username`
hint keeps the account scoped to this repository).
