# notion

Notion API bridge for Plugin OS.

## Capabilities

- `notion.status`
- `notion.search` — `{ query }`
- `notion.page.create` — `{ title, content?, parentPageId? }` requires `approved=true`

Env: `NOTION_API_KEY`, optional `NOTION_PARENT_PAGE_ID`
