# secret-source-file

Trust fabric **file** secret source for Zavorth Plugin OS.

Stores secrets in a local plain JSON file under the workspace:

```
.zavorth/secrets/store.json
```

Shape:

```json
{
  "entries": {
    "MY_TOKEN": "…"
  }
}
```

Also reads a legacy `secrets.json` in the same directory if `store.json` is missing.

**Capability outputs never include secret values** — only names and presence.

## Capabilities

| Capability           | Usage             | Permission               | Output notes                             |
| -------------------- | ----------------- | ------------------------ | ---------------------------------------- |
| `secret.file.status` | `{}`              | —                        | `exists`, `entryCount`, relative `path`  |
| `secret.file.set`    | `{ name, value }` | `filesystem.write`       | `{ ok, name, present: true }` (no value) |
| `secret.file.has`    | `{ name }`        | `secret.read` (optional) | `{ ok, present, name }`                  |
| `secret.file.delete` | `{ name }`        | `filesystem.write`       | `{ ok, name, deleted }`                  |
| `secret.file.list`   | `{}`              | —                        | `names` only                             |

## Specialized registrar

When `ctx.registerSecretSource` exists:

| Field        | Value             |
| ------------ | ----------------- |
| id           | `file`            |
| capabilityId | `secret.file.has` |
| kind         | `secret_source`   |

## Path confinement

All reads/writes are limited to `workspace/.zavorth/secrets/`.
Paths that escape that directory are rejected.

## Safety

- Soft-fail on I/O and parse errors
- Plain local file (not encrypted) — soft plugin; do not use for high-assurance secrets
- Values never returned after set/list/has/status
- Pure Node JS (`node:fs`, `node:path`), no extra deps

## Enable

```bash
zavorth plugins enable secret-source-file --yes
```
