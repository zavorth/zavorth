# Telegram

Telegram is one of Zavorth's fastest live channels, but it is not a separate brain. It routes into the same Gateway, Policy Broker, sessions and approvals used by the ZavorthControl and CLI.

## Role

Use Telegram for:

- quick requests from mobile;
- approval prompts;
- action cards;
- short diff summaries;
- learning review prompts;
- status checks;
- continuing existing sessions;
- channel and runtime notifications.

Use the ZavorthControl when you need denser visibility, artifacts, diffs or a full operational view.

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
| `/control` | Link to Zavorth Control |

Commands are intentionally secondary. The expected daily path is natural language plus guided buttons where Telegram supports them.

## Experience Core Cards

When Telegram is connected to the Experience Core, these natural messages can
return the same state shown in CLI and `/control`:

```text
status
o que esta bloqueado?
ver diff
o que voce aprendeu?
rode validacao
```

Cards stay compact: state, risk, recommended action, receipt id/link when
available and safe inline buttons. Callback payloads are opaque and short; they
must not contain full diffs, shell commands, secrets, raw paths with sensitive
tokens, or logs.

Status cards include the shared Zavorth Pulse and active response profile. On
short channels the default profile is concise, but the user can still ask for
`estilo dev`, `estilo executivo` or `estilo mentor`; this changes formatting,
not security policy.

Telegram callback buttons are backed by a server-side registry:

- `callback_data` stays under Telegram's 64-byte limit;
- callback ids expire by TTL;
- the originating user, chat and session are validated before any decision;
- deployments can set `ZAVORTH_TELEGRAM_EXPERIENCE_CALLBACK_STORE` to keep
  callback ids across local process restarts without putting secrets or diffs
  into Telegram payloads;
- expired or forbidden callbacks fail closed and ask the user to refresh status;
- long diffs and logs are summarized in chat and reviewed in `/control` or CLI.

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
- no full diffs or long logs in chat;
- no raw secrets in chat;
- approval scopes shown before sensitive work;
- no privileged learning or safety-policy changes from chat buttons;
- links back to `/control` for dense review.
