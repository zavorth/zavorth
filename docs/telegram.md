# Telegram

Telegram is one of Zavorth's fastest live channels, but it is not a separate brain. It routes into the same Gateway, Policy Broker, sessions and approvals used by the Dashboard and CLI.

## Role

Use Telegram for:

- quick requests from mobile;
- approval prompts;
- status checks;
- continuing existing sessions;
- channel and runtime notifications.

Use the Dashboard when you need denser visibility, artifacts, diffs or a full operational view.

## Natural Requests

Telegram should accept ordinary language before falling back to slash commands:

```text
connect Zavorth to Discord
which channel is safest for approvals?
review this repository
use subagents to inspect the codebase
show pending approvals
```

When the request touches a channel, Zavorth opens the Channel Mesh. When it touches code or operations, it routes to the governed runtime.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `/start` | Start the bot and show the primary entry points |
| `/help` | Show available commands |
| `/status` | Show runtime status |
| `/channels` | Show channel readiness and actions |
| `/models` | Show provider/model options when enabled |
| `/approvals` | Show pending approvals |
| `/dashboard` | Link to the web Dashboard |

Commands are intentionally secondary. The expected daily path is natural language plus guided buttons where Telegram supports them.

## Safety

Telegram updates are normalized before reaching runtime controllers. The Gateway should preserve:

- `chatId`;
- `userId`;
- thread/topic identifiers when present;
- transport type;
- channel policy identity.

The bot should apply channel policy before routing commands. Supergroup topics can be scoped with thread-aware allowlists and blocklists.

## Channel Policy

Keep Telegram closed by default for serious use:

```text
ZAVORTH_CHANNEL_POLICY_TELEGRAM_OPEN=false
ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED=chat:-1001234567890,thread:-1001234567890:777
ZAVORTH_CHANNEL_POLICY_TELEGRAM_BLOCKED=user:999999999
```

## UX Standard

Telegram should feel first-class without becoming privileged:

- concise responses;
- inline buttons when safe;
- fallback text for unsupported actions;
- no raw secrets in chat;
- approval scopes shown before sensitive work;
- links back to `/dashboard` for dense review.
