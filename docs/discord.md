# Discord

Discord is a daily assistant channel over the same governed runtime as Home, CLI and Telegram. It is not a separate agent and it should not become public by accident.

## Quick Setup

Preview first:

```bash
zavorth channels discord
```

Apply the minimal scaffold and allowlist:

```bash
zavorth channels discord --apply --allowed-guilds=<guild-id> --allowed-channels=<channel-id> --owners=<owner-user-id>
```

Then add the bot token locally or through your SecretRef workflow:

```text
DISCORD_BOT_TOKEN=<set locally, not in chat>
DISCORD_ALLOWED_GUILD_IDS=<guild-id>
DISCORD_ALLOWED_CHANNEL_IDS=<channel-id>
DISCORD_OWNER_USER_IDS=<owner-user-id>
DISCORD_PUBLIC_SERVER_MODE=false
DISCORD_COMMAND_EXPOSURE=minimal
```

Check readiness:

```bash
zavorth connectors doctor discord
```

## Safety

- Do not paste bot tokens into chat or PR comments.
- Keep `DISCORD_PUBLIC_SERVER_MODE=false` until tenant onboarding and allowlists are reviewed.
- Keep `DISCORD_COMMAND_EXPOSURE=minimal` until command routing is validated.
- Use owner IDs and channel allowlists before enabling any outbound send.
- Real sends and public rollout remain approval-gated and receipt-backed.

## Daily Use

Expected requests:

```text
show pending approvals
summarize today's tasks
approve <approvalId>
send me the latest receipt
```

When a request would post externally, write files, comment on a PR or run tools, Zavorth should stop at approval and return a receipt after the decision.
