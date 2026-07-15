# secret-source-env

Trust fabric **env** secret source for Zavorth Plugin OS.

Reports whether allowlisted `process.env` names are **present**.
**Never returns secret values.**

## Default allowlist

| Name                 |
| -------------------- |
| `OPENAI_API_KEY`     |
| `ANTHROPIC_API_KEY`  |
| `XAI_API_KEY`        |
| `GITHUB_TOKEN`       |
| `GH_TOKEN`           |
| `TELEGRAM_BOT_TOKEN` |
| `DISCORD_BOT_TOKEN`  |
| `EXA_API_KEY`        |
| `MEM0_API_KEY`       |
| `FIRECRAWL_API_KEY`  |

Extra names: set `ZAVORTH_SECRET_ENV_ALLOWLIST=FOO,BAR` (comma-separated).

## Capabilities

| Capability          | Usage      | Output notes                                                        |
| ------------------- | ---------- | ------------------------------------------------------------------- |
| `secret.env.status` | `{}`       | Allowlist entries with `present` flags only                         |
| `secret.env.get`    | `{ name }` | `{ ok, present, name }` — never value; `not_allowlisted` if unknown |
| `secret.env.list`   | `{}`       | Allowlisted names + present flags                                   |

`secret.env.get` requests `secret.read` (optional permission) before probing.

## Specialized registrar

When `ctx.registerSecretSource` exists:

| Field        | Value            |
| ------------ | ---------------- |
| id           | `env`            |
| capabilityId | `secret.env.get` |
| kind         | `secret_source`  |

## Safety

- Soft-fail on errors
- Values never returned or logged
- Unknown names rejected (`reason: not_allowlisted`)
- Pure Node JS, no extra deps

## Enable

```bash
zavorth plugins enable secret-source-env --yes
```
