---
title: "Discord"
description: "Connect Zavorth to Discord with a native bot, slash commands, and server allowlists."
---

Zavorth connects to Discord as a native bot with slash commands and configurable server/channel allowlists. You control who can interact with it and how much it exposes.

## What you need

- A Discord account with developer access
- A server (guild) where you have admin permissions

## Setup

<Steps>
  <Step title="Create a Discord application and bot">
    1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
    2. Click **New Application**, give it a name
    3. Go to **Bot** → **Add Bot**
    4. Copy the **Token** — keep it private
    5. Under **Privileged Gateway Intents**, enable **Message Content Intent**
    6. Go to **OAuth2 → URL Generator** → select `bot` + `applications.commands`
    7. Copy the generated URL, open it in your browser, and invite the bot to your server
  </Step>

  <Step title="Find your server and channel IDs">
    In Discord, enable Developer Mode under **Settings → Advanced → Developer Mode**.
    Right-click your server → **Copy Server ID**.
    Right-click a channel → **Copy Channel ID**.
  </Step>

  <Step title="Run the Discord wizard">
    ```bash
    zavorth channels discord
    ```

    Or set directly in `.env`:
    ```env
    DISCORD_BOT_TOKEN=your_bot_token_here
    DISCORD_ALLOWED_GUILD_IDS=your_server_id
    DISCORD_ALLOWED_CHANNEL_IDS=your_channel_id
    ```
  </Step>

  <Step title="Apply and verify">
    ```bash
    zavorth channels discord --apply \
      --allowed-guilds your_server_id \
      --allowed-channels your_channel_id \
      --owners your_discord_user_id

    zavorth connectors doctor discord
    ```
  </Step>

  <Step title="Start and test">
    ```bash
    zavorth start
    ```

    In your Discord channel, type a message. If the bot is set to `minimal` exposure, use a slash command like `/zavorth ask what can you do`.
  </Step>
</Steps>

## Command exposure modes

Discord exposure is configurable — especially important for public servers:

| Mode | What it shows |
|---|---|
| `none` | No slash commands registered |
| `minimal` | Only `/task`, `/plan`, `/help` — recommended for public servers |
| `operator` | Full command catalog including operational commands |

```env
DISCORD_COMMAND_EXPOSURE=minimal
```

Operational commands in `operator` mode are owner-only by default on public servers.

## Public server mode

If your Discord server has many users you do not control, enable public server mode:

```env
DISCORD_PUBLIC_SERVER_MODE=true
DISCORD_REQUIRE_OWNER_FOR_OPERATIONAL=true
DISCORD_BLOCK_MASS_MENTIONS=true
DISCORD_MAX_LINKS_PER_MESSAGE=3
DISCORD_ALLOW_ATTACHMENTS_IN_PUBLIC_SERVER_MODE=false
```

This locks down sensitive commands to server owners and applies basic spam protection.

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_ALLOWED_GUILD_IDS` | Yes | Comma-separated server IDs |
| `DISCORD_ALLOWED_CHANNEL_IDS` | No | Limit to specific channels |
| `DISCORD_OWNER_USER_IDS` | Recommended | Your Discord user ID for owner commands |
| `DISCORD_COMMAND_EXPOSURE` | No | `none`, `minimal` (default), or `operator` |
| `DISCORD_PUBLIC_SERVER_MODE` | No | Enable extra guardrails for public servers |
| `DISCORD_ALLOW_DMS` | No | Allow DMs (default: false) |

## Troubleshooting

**Bot is in the server but does not respond**
Check `DISCORD_ALLOWED_GUILD_IDS` and `DISCORD_ALLOWED_CHANNEL_IDS`. Run `zavorth connectors doctor discord`.

**Slash commands do not appear**
It can take up to an hour for Discord to register new slash commands globally. For instant registration, use a guild-specific command scope in your invite URL.

**"Missing Access" errors**
Verify the bot has the correct permissions in the channel: Read Messages, Send Messages, and Embed Links at minimum.

## Related

- [All channels](/docs/product/channels)
- [Approvals](/docs/product/concepts/approvals)
- [Getting started](/docs/product/start/getting-started)
