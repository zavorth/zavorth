# calendar

Local file calendar Plugin OS package.

## Capabilities

- `calendar.status`
- `calendar.list` — `{ limit? }`
- `calendar.create` — `{ title, start, end }` dry-run unless `approved=true`

Storage: `.zavorth/calendar/events.json` (CalendarTool soft-require when available).
