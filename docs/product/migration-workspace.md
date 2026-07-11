# Workspace migration (any agent home)

Import identity, skills, memory, and config from **any** local agent or workspace home using structural detection. Optional named profiles add a **risk migration report** on top — they are structure labels, not import requirements.

## Quick start

```bash
# Preview (default) — structural import + migration risk report
zavorth import-workspace ./any-agent-home --preview

# Auto-detect profile fingerprint (default --profile)
zavorth import-workspace ./any-agent-home --profile auto --preview

# Force a structure label when you know the layout
zavorth import-workspace ./agent-home --profile openclaw-home --preview
zavorth import-workspace ./agent-home --profile hermes-home --preview
zavorth import-workspace ./agent-home --profile generic --preview

# Apply only with explicit consent (still holds secret-like by default)
zavorth import-workspace ./any-agent-home --apply --consent
```

Aliases for the same structural import:

```bash
zavorth migrate ./any-agent-home --preview
zavorth migrate --auto --preview
```

## Profile flags

| `--profile` | Meaning |
| --- | --- |
| `auto` (default) | Detect strongest fingerprint among known layouts |
| `generic` / `generic-agent-home` | Generic agent-home shape (IDENTITY/AGENTS, memory/, skills/) |
| `openclaw-home` | Structure label for `.openclaw` / `openclaw.json` / SOUL+skills / agents+SOUL layouts |
| `hermes-home` | Structure label for `.hermes` / hermes config / `cli-config.yaml`+skills layouts |

Profiles are **optional**. Universal structural import always runs underneath whether or not a named profile matches.

## What gets imported

Structural signals include:

- Identity markdown (`IDENTITY.md`, `SOUL.md`, `USER.md`, `AGENTS.md`, …)
- `skills/` / `skill-library/`
- `memory/` / `MEMORY.md`
- config files and plugin packs

Product brand is **not** required. Fingerprint names like `openclaw-home` are labels only.

## Secrets

- Secret-like files (`.env`, tokens, key material) are **never auto-imported**.
- Migration reports note **presence only** — raw values are redacted and never serialized.
- To intentionally include secret-like *references* in an apply path, pass `--include-secret-like` with `--apply --consent`. Prefer rotating credentials after any import.

```bash
# Still blocked without consent
zavorth import-workspace ./home --include-secret-like --apply --consent
```

## Safety defaults

1. **Preview is default** — no files copied until apply.
2. **Apply requires `--consent`** (or `--yes`).
3. Secret-like items stay held unless explicitly included.
4. Executable plugins / MCP remain held or disabled until higher-trust enable.
5. Optional Trust Loop receipt is appended for the migration report (`system` / `marketplace` kind); use `--no-proof` to skip.

## Related

- [Universal Capability Fabric](../capability-fabric.md)
- [Capabilities](../capabilities.md)
- [Security](../security.md)
