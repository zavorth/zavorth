# cost-tracker

LLM cost and latency ledger for Zavorth Plugin OS.

## Hooks

- `llm.before_request` — record start
- `llm.after_request` — record tokens / duration

## Ledger

`.zavorth/cost-tracker/ledger.jsonl`

## Capabilities

- `cost.summary`
- `cost.reset`

## Enable

```bash
zavorth plugins enable cost-tracker --yes
```
