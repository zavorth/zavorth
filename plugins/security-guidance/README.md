# security-guidance

Non-blocking security pattern scanner for Zavorth Plugin OS.

## Hook

- `tool.after_execute` — scans write-like context for dangerous patterns (~15 rules)

## Capability

- `security.scan` — `{ text }`

Never blocks or throws; warnings only, ledger at `.zavorth/security-guidance/warnings.jsonl`.

## Enable

```bash
zavorth plugins enable security-guidance --yes
```
