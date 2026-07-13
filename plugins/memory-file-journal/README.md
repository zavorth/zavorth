# memory-file-journal

Append-only JSONL journal memory for Zavorth Plugin OS (Wave 3).

## Store

`<workspace>/.zavorth/memory-file-journal/journal.jsonl`

Each line is a JSON object:

```json
{ "id": "<uuid>", "at": "<ISO timestamp>", "text": "...", "tags": [], "key": "optional" }
```

## Capabilities

- `memory.journal.status` — path, line count (scan capped), ok
- `memory.journal.append` — `{ text|content|value, tags?, key? }`
- `memory.journal.search` — `{ query, limit? }` (scans last 5000 lines)
- `memory.journal.tail` — `{ limit? }` recent entries

Also registers `bindMemoryBackend` (`memory-file-journal`) mapping write→append, read→get by id/key, search→search.

## Enable

```bash
zavorth plugins enable memory-file-journal --yes
```
