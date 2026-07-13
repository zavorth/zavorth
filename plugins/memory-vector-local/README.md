# memory-vector-local

Local bag-of-words / hashed embedding memory for Zavorth Plugin OS (Wave 3).

No external ML dependencies (no TensorFlow). Soft semantic-ish search via 128-dim hashed vectors and cosine similarity.

## Store

`<workspace>/.zavorth/memory-vector-local/store.json`

Entries shape:

```json
{
  "id": "<id>",
  "text": "...",
  "tags": [],
  "vector": [0.1, ...],
  "updatedAt": "<ISO timestamp>"
}
```

## Embedding

1. Tokenize lowercase alphanumeric words
2. Hash each token into a 128-dim bucket (signed FNV-style)
3. L2-normalize the vector
4. Rank search results by cosine similarity

## Capabilities

- `memory.vector.status` — path, entry count, dim
- `memory.vector.upsert` — `{ id?|key?, text|value, tags? }`
- `memory.vector.search` — `{ query, limit? }` ranked by cosine
- `memory.vector.get` — `{ id|key }`

Also registers `bindMemoryBackend` (`memory-vector-local`) with write/search/read.

## Enable

```bash
zavorth plugins enable memory-vector-local --yes
```
