# secrets-guardian

Non-blocking secret leak scanner for text, files, and tool writes.

## Why it exists

`security-guidance` catches dangerous **code** patterns. Secrets Guardian catches **credential** patterns (PATs, PEM keys, Stripe/OpenAI keys, DB URLs). Together they raise trust without blocking the agent.

## Capabilities

| Capability | Usage |
|------------|--------|
| `secrets.scan` | `{ text }` |
| `secrets.scan_path` | `{ path }` workspace-relative |
| `secrets.summary` | Recent ledger entries |

## Safety

- Never echoes matched secret material (`redacted: true`)
- Path must stay inside workspace
- Soft-fail, non-blocking hooks
- Ledger: `.zavorth/secrets-guardian/findings.jsonl`

## Enable

```bash
zavorth plugins enable secrets-guardian --yes
```
