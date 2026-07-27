# obsidian

Local Obsidian vault bridge for Zavorth.

## Setup

```bash
set OBSIDIAN_VAULT=C:\path\to\your\vault
zavorth plugins enable obsidian --yes
```

## Capabilities

- `obsidian_status`
- `obsidian_list`
- `obsidian_search`
- `obsidian_read`
- `obsidian_write` (approval-gated)

Writes stay inside the vault root; path traversal is rejected.
