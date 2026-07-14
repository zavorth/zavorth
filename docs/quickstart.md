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
zavorth setup
zavorth start
zavorth open
zavorth ready
```

For the product-level check that summarizes install, providers, channels,
dashboard, terminal, quiet autonomy and clean home isolation:

```bash
zavorth ready --product
```

From this repository:

```bash
npm install
npx zavorth setup
npx zavorth start
npx zavorth open
```

Expected flow:

1. `setup` opens First Light for provider, model, channels, Mnemos and approvals.
2. `start` starts or resumes the local runtime.
3. `open` opens or prints the local Zavorth Control route at `/control`.
4. `ready` tells you whether provider, channels, approvals and runtime are usable.

## Product Home

The first screen is Home, not an internal control plane:

- Inbox
- Tasks
- Approvals
- Receipts
- Connectors

Open it with:

```bash
zavorth open
```

`zavorth setup` is the first-run Studio. `zavorth onboard` remains a compatibility
alias for existing operators.

Use the dry-run option when you only want to inspect the launch path:

```bash
zavorth start --dry-run
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
zavorth channels telegram
zavorth connectors doctor telegram
zavorth channels telegram --apply --allowed-users=<your-telegram-user-id>
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
zavorth channels discord
zavorth connectors doctor discord
zavorth channels discord --apply --allowed-guilds=<guild-id> --allowed-channels=<channel-id> --owners=<owner-user-id>
```

Minimum live setup signals:

- `DISCORD_BOT_TOKEN` as a local env var or SecretRef
- `DISCORD_ALLOWED_GUILD_IDS`
- `DISCORD_ALLOWED_CHANNEL_IDS`, `DISCORD_OWNER_USER_IDS` or `ZAVORTH_CHANNEL_POLICY_DISCORD_ALLOWED`
- command exposure left at `minimal` until the channel smoke passes

## Public demo (offline)

Fixture-first product demo (not a live agent session):

```bash
zavorth demo
zavorth connectors doctor
zavorth demo browser
```

Static Trust Loop visual demo (approve → receipt):

- path: `assets/zavorth-demo/index.html`
- website mirror: `/demo` on zavorth-website

Maintainer validation for this path is documented in [operations.md](./operations.md).

Also see:

- [demo-scripts.md](./product/demo-scripts.md) — Script A (offline Trust Loop) and Script B (with provider)
- [public-demo-trust-loop.md](./product/public-demo-trust-loop.md)
- [golden-path.md](./product/golden-path.md)

## Smoke

The daily readiness check does not need users to know internal scripts:

```bash
zavorth ready
zavorth doctor
```

For maintainers, stable checks verify:

- the 10-minute quickstart contract
- Zavorth Control at `/control`
- GitHub Governed Review fixture
- Telegram approval loop fixture
- Discord connector setup fixture
- exact connector doctor output
- product certification output

Before publishing a build or refreshing the public repository presentation, run:

```bash
npm run release:check
npm run qa:zavorth-product-certification --silent
npm run qa:zavorth-release-hardening
```

## Everyday Commands

```bash
zavorth setup
zavorth start
zavorth open
zavorth ready
zavorth chat
zavorth run "review this repo"
zavorth doctor --simple
zavorth receipts
zavorth connectors
zavorth providers
zavorth providers add
zavorth channels telegram
zavorth actions lookup capabilities
zavorth actions usage
zavorth actions lifecycle
```

## Safety

- Raw provider keys should not be pasted into chat.
- Credentials should be represented as `SecretRef` metadata or local environment configuration.
- Sensitive actions require policy, approval and receipts.
- Demo and smoke commands never pretend unconfigured connectors are live.
- Provider and channel wizards write only with explicit `--apply`; raw secrets are captured by secret prompts or env references and never printed.

## Next

- [CLI](/docs/zavorth-cli.md)
- [Capabilities](/docs/capabilities.md)
- [ZavorthControl](/docs/web-zavorthControl.md)
- [Telegram](/docs/telegram.md)
- [Discord](/docs/discord.md)
- [Channel Mesh](/docs/channel-mesh.md)
- [Security](/docs/security.md)
