# spotify-soft

Optional **Spotify Web API** lifestyle plugin for Zavorth Plugin OS.

Soft-fail status and playback helpers when a user access token is configured.
Complements the core `zavorth_spotify` tool with Plugin OS capabilities.

## Env

| Variable                                  | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `SPOTIFY_ACCESS_TOKEN` or `SPOTIFY_TOKEN` | User OAuth access token (required for API calls) |
| `SPOTIFY_CLIENT_ID`                       | Optional; presence reported in status            |
| `SPOTIFY_CLIENT_SECRET`                   | Optional; presence only (never returned)         |

Status reports **presence only** — never secret values.

## Capabilities

| Capability            | Usage                            | Notes                                               |
| --------------------- | -------------------------------- | --------------------------------------------------- |
| `spotify.status`      | `{}`                             | `tokenConfigured`, `clientIdConfigured`, setup tips |
| `spotify.now_playing` | `{}`                             | Track name, artists, `is_playing`                   |
| `spotify.pause`       | `{}`                             | `PUT /v1/me/player/pause`                           |
| `spotify.play`        | `{ body?, uris?, context_uri? }` | `PUT /v1/me/player/play` (body optional)            |
| `spotify.search`      | `{ query, limit? }`              | Track search via `/v1/search`                       |

## Safety

- Requests `network.external` before any HTTP call
- Soft-fail when token missing, permission denied, or HTTP errors
- Never returns or logs access tokens / client secrets
- Pure Node (`fetch`), no extra deps
- Permissions `network.external` and `secret.read` are optional (`required: false`)

## OAuth setup (summary)

1. Create an app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Use Authorization Code or PKCE to obtain a **user** access token
3. Recommended scopes:
   - `user-read-currently-playing`
   - `user-read-playback-state`
   - `user-modify-playback-state`
4. Export `SPOTIFY_ACCESS_TOKEN` (or `SPOTIFY_TOKEN`)
5. Premium is typically required for play/pause Web API control

## Enable

```bash
zavorth plugins enable spotify-soft --yes
```
