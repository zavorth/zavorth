# media-video-gen

Optional-tier **video generation** soft stub for Plugin OS.

Video gen is expensive and vendor-specific. This package is honest: it reports **not fully available** by default and **never pretends success** without a real provider API.

## Env (optional)

| Variable              | Purpose                                                 |
| --------------------- | ------------------------------------------------------- |
| `VIDEO_GEN_API_KEY`   | Generic provider key for soft-try                       |
| `VIDEO_GEN_BASE_URL`  | Generic HTTPS base (POST `{base}/v1/video/generations`) |
| `RUNWAY_API_KEY`      | Presence reported for future providers                  |
| `LUMA_API_KEY`        | Presence reported for future providers                  |
| `REPLICATE_API_TOKEN` | Presence reported for future providers                  |

Status only reports **presence** booleans — never secret values.

## Capabilities

| Capability             | Usage                                           |
| ---------------------- | ----------------------------------------------- |
| `media.video.status`   | Availability, key presence, setup tips          |
| `media.video.generate` | `{ prompt, duration? }` — soft stub or soft-try |

### Soft-try rules

- Soft-try HTTP only when **both** `VIDEO_GEN_API_KEY` and `VIDEO_GEN_BASE_URL` are set
- Requires `requestPermission('network.external', ...)`
- Success only if the API returns a video URL or job id
- Otherwise returns `ok: false` with clear setup tips

## Specialized registrar

When `ctx.registerVideoGenProvider` exists, the plugin registers:

- `id`: `video-gen-optional`
- `capabilityId`: `media.video.generate`

## Safety

- Never returns secret values
- Network permission gated
- Soft-fail / honest stub without keys
- Pure Node, no extra deps

## Enable

```bash
zavorth plugins enable media-video-gen --yes
```
