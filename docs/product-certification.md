# Product Certification

Zavorth Product Certification is the short answer to a practical question:

> Is this installation usable for daily agent work, and what still needs setup?

It checks the product from the user's point of view: setup, provider routes,
channels, terminal use, dashboard readiness, long-session streaming, clean home
isolation, quiet autonomy, voice/satellite surfaces, release hygiene and public
docs.

## Run It

For normal use:

```bash
zavorth ready --product
```

For maintainers:

```bash
npm run qa:zavorth-product-certification --silent
```

For JSON output:

```bash
npm run zavorth:product-certification:json --silent
```

## Reading The Result

| Status | Meaning |
| --- | --- |
| `ready` | The product path is usable and no major setup item is missing. |
| `attention` | Zavorth is usable, but a credential, live proof, allowlist or optional setup item still needs review. |
| `blocked` | A required product path is missing or unsafe for normal use. |

Missing provider API keys, channel tokens or live canaries are setup state, not
fake failures. Zavorth should say what is missing instead of pretending a route
is live.

## Daily Product Loop

1. Run `zavorth setup`.
2. Start the runtime with `zavorth start`.
3. Open the dashboard with `zavorth open`.
4. Ask naturally in the dashboard or terminal.
5. Approve only real risk.
6. Review the result and receipt.
7. Check state with `zavorth ready --product`.

## What It Verifies

- The LLM receives the Agent Kernel Snapshot before deciding how to act.
- Provider routes have real execution paths, with credentials handled as setup.
- Channels are cataloged, governed and live-proofed when configured.
- Channel canaries show whether credentials, allowlists and proof receipts are ready.
- The dashboard streaming smoke covers a long normal session path with steering, traces and receipts.
- The terminal TUI exposes daily status without requiring internal knowledge.
- Clean installs use central home resolution and isolated state when configured.
- Quiet autonomy stays reversible and keeps risky boundaries behind approval.
- Voice and companion surfaces exist without claiming unavailable live setup.
- Release hygiene blocks personal paths, unsafe token URLs and public identity drift.
- Public docs describe current user behavior.
