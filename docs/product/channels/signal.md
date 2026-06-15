---
title: "Signal"
description: "Connect Zavorth to Signal via a local signal-cli bridge. Private by design."
---

Signal is a local bridge — Zavorth talks to Signal via `signal-cli` running on your machine. There is no official Signal Bot API, so this is more involved than Telegram or Discord, but gives you a fully private channel.

## What you need

- A dedicated phone number for Signal (do not use your personal Signal account — use a second number)
- Java 17+ installed (required by signal-cli)
- `signal-cli` installed on your machine

<Warning>
Use a dedicated phone number for your Signal bot. Sharing a personal Signal account with signal-cli can cause account issues.
</Warning>

## Install signal-cli

```bash
# Download the latest release from GitHub
# https://github.com/AsamK/signal-cli/releases

# Verify
signal-cli --version
```

## Register a Signal account

```bash
# Register with your dedicated number
signal-cli -a +15555550123 register

# Verify with the SMS code you receive
signal-cli -a +15555550123 verify 123-456
```

## Setup

<Steps>
  <Step title="Configure Zavorth">
    ```env
    SIGNAL_ENABLED=true
    SIGNAL_TRANSPORT=signal-cli
    SIGNAL_CLI_PATH=signal-cli
    SIGNAL_ACCOUNT_NUMBER=+15555550123
    SIGNAL_ALLOWED_RECIPIENTS=+15555559876
    ```
  </Step>

  <Step title="Start signal-cli in JSON-RPC mode">
    Zavorth talks to signal-cli via JSON-RPC. Start it as a background service:

    ```bash
    signal-cli -a +15555550123 jsonRpc
    ```

    Set the socket URL:
    ```env
    SIGNAL_JSONRPC_URL=unix:///tmp/signal-cli.sock
    ```
  </Step>

  <Step title="Verify">
    ```bash
    zavorth connectors doctor signal
    zavorth start
    ```

    Send a message from `SIGNAL_ALLOWED_RECIPIENTS` to your bot number.
  </Step>
</Steps>

## Security defaults

Signal in Zavorth is deliberately restrictive:

- **Closed by default** — only numbers in `SIGNAL_ALLOWED_RECIPIENTS` can interact
- **No broadcast** — Zavorth never sends to a group unless explicitly configured
- **Dedicated account** — the Signal account should only be used for Zavorth

```env
ZAVORTH_CHANNEL_POLICY_SIGNAL_OPEN=false
ZAVORTH_CHANNEL_POLICY_SIGNAL_ALLOWED=+15555559876
```

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `SIGNAL_ENABLED` | Yes | Set to `true` |
| `SIGNAL_TRANSPORT` | Yes | `signal-cli` |
| `SIGNAL_CLI_PATH` | No | Path to signal-cli binary (default: `signal-cli`) |
| `SIGNAL_ACCOUNT_NUMBER` | Yes | Your bot's phone number |
| `SIGNAL_JSONRPC_URL` | Yes | signal-cli JSON-RPC socket or URL |
| `SIGNAL_ALLOWED_RECIPIENTS` | Yes | Comma-separated allowed numbers |

## Troubleshooting

**signal-cli not found**
Make sure it is installed and on your PATH: `which signal-cli` or set `SIGNAL_CLI_PATH` to the full path.

**Messages not received**
Ensure signal-cli is running in JSON-RPC mode and `SIGNAL_JSONRPC_URL` is correct. Run `zavorth connectors doctor signal`.

**Account registration issues**
Signal rate-limits registrations. Use a dedicated number and register once.

## Related

- [All channels](/docs/product/channels)
- [Approvals](/docs/product/concepts/approvals)
