# Information Tools

Tools for searching the internet and obtaining temporal data.

## Available Tools

### `web_search`
Searches current information on the internet and returns ranked results.
- Returns title, URL, and snippet for each result
- Supports Portuguese, English, and Spanish queries
- News quality gate: checks freshness and result count
- Use when the user asks about news, prices, weather, scores, or other current data

### `get_datetime`
Returns the current system date and time with time zone support.
- Format: English long date plus ISO 8601

## When Not To Use

- For local file reads, use the `filesystem` skill
