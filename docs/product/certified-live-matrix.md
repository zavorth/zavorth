# Certified live matrix (honesty)

Maps which channel/provider paths are **structurally present** vs **live-certified**.

## Structure vs live

| Area | Structural (hermetic) | Live certified |
|------|----------------------|----------------|
| Channel factory (29) | Yes — unit tests / registry | Per-credential only |
| normalizeChannelId | Yes | N/A |
| Telegram / Discord / etc. | Adapter present | Needs tokens; otherwise blocked |
| Email outbox | Configurable | Optional `EMAIL_ENABLED` |
| AI gateway | Port/env local | Needs provider keys for chat |
| Web search tool | Policy present | Needs search provider |

## Dogfood mapping

- Hermetic pass: factory, aliases, docs honesty, optional email default-off
- Blocked without credentials: `dogfood.channels.02`–`04`, most `dogfood.chat.*` live turns

## Rule

Never mark a live cell green without a real credentialed run recorded in the dogfood log.
