# Quickstart

This is the shortest product path into Zavorth: install once, run `zavorth start`, open Home, then connect only the tools you actually need.

## Requirements

- Node runtime 18 or newer
- npm
- a terminal on Windows, macOS or Linux
- provider or channel credentials only when you decide to enable live connectors

## 10-Minute Path

From the published package:

```bash
npm install -g zavorth@latest
zavorth start
zavorth go
zavorth connectors doctor
zavorth demo browser
```

From this repository:

```bash
npm install
npm run zavorth:start
npm run go
npm run zavorth:connectors
npm run zavorth:demo:check
```

Expected flow:

1. `start` shows the single product path: setup preview, Home, optional visual demo and connector doctor.
2. `go` opens or prints the local Home route at `/dashboard`.
3. `connectors doctor` tells you exactly what is missing for GitHub, Telegram and Discord.
4. `demo browser` opens the local visual demo without requiring live secrets.
5. The smoke check verifies the demo without requiring GitHub, Telegram or Discord tokens.

## Product Home

The first screen is Home, not an internal control plane:

- Inbox
- Tasks
- Approvals
- Receipts
- Connectors

Open it with:

```bash
zavorth go
```

`zavorth onboard` is a friendly alias for the same first-run setup path.
Use `zavorth onboard journey` only when you want the older read-only onboarding
overview.

Use a dry run when you only want to inspect the launch path:

```bash
zavorth go --dry-run
```

## GitHub checklist

GitHub is used by Governed Review. Reading a PR is separate from posting a comment.

```bash
gh auth status
zavorth review github --pr=<number> --repo=<owner/repo>
```

Posting a PR comment stays approval-aware:

```bash
zavorth review github --pr=<number> --repo=<owner/repo> --post-comment --approval-id=<approval-id>
```

Rules:

- Do not paste GitHub tokens into chat.
- Use `gh auth login`, `GH_TOKEN`, `GITHUB_TOKEN` or a SecretRef-backed setup.
- PR comments, patches and live agents remain gated by approval and receipts.

## Telegram checklist

Telegram is a channel over the same governed runtime, not a separate brain.

```bash
zavorth connectors doctor telegram
zavorth connectors setup telegram
zavorth connectors setup telegram --apply --allowed-user=<your-telegram-user-id>
```

Minimum live setup signals:

- `TELEGRAM_BOT_TOKEN` as a local env var or SecretRef
- `TELEGRAM_ALLOWED_USER_IDS` or `ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED`
- approval routing enabled for risky tasks

Daily assistant example:

```text
corrija o arquivo e rode npm test
aprovar <approvalId>
```

The first message should wait for approval. The second should resume execution and return a receipt.

## Discord checklist

Discord starts with a minimal native bot scaffold: bot token, guild allowlist and optional channel/owner policy. The setup command writes placeholders and allowlist values only; it does not paste or invent the bot token.

```bash
zavorth connectors doctor discord
zavorth connectors setup discord
zavorth connectors setup discord --apply --guild=<guild-id> --channel=<channel-id> --owner=<owner-user-id>
```

Minimum live setup signals:

- `DISCORD_BOT_TOKEN` as a local env var or SecretRef
- `DISCORD_ALLOWED_GUILD_IDS`
- `DISCORD_ALLOWED_CHANNEL_IDS`, `DISCORD_OWNER_USER_IDS` or `ZAVORTH_CHANNEL_POLICY_DISCORD_ALLOWED`
- command exposure left at `minimal` until the channel smoke passes

## Smoke

The deterministic demo smoke does not need secrets or live network access:

```bash
npm run zavorth:demo:check
```

It verifies:

- the 10-minute quickstart contract
- Home at `/dashboard`
- GitHub Governed Review fixture
- Telegram approval loop fixture
- Discord connector setup fixture
- exact connector doctor output

## Everyday Commands

```bash
zavorth start
zavorth demo
zavorth demo browser
zavorth connectors doctor
zavorth go
zavorth chat
zavorth run "review this repo"
zavorth doctor --simple
zavorth receipts
zavorth connectors
zavorth providers
```

## Safety

- Raw provider keys should not be pasted into chat.
- Credentials should be represented as `SecretRef` metadata or local environment configuration.
- Sensitive actions require policy, approval and receipts.
- Demo and smoke commands never pretend unconfigured connectors are live.
- Connector setup writes only scaffold/allowlists with `--apply`; raw secrets stay local or in SecretRefs.

## Next

- [CLI](/docs/34-zavorth-cli.md)
- [Web Dashboard](/docs/07-web.md)
- [Telegram](/docs/06-telegram.md)
- [Discord](/docs/08-discord.md)
- [Channel Mesh](/docs/33-channel-mesh.md)
- [Security](/docs/05-security.md)
