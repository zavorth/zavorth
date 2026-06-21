---
title: "Troubleshooting"
description: "Common problems and how to fix them."
---

## Start here

Run the doctor command first — it checks everything in one go:

```bash
zavorth doctor
```

For a quick readable summary:
```bash
zavorth doctor --simple
```

For full technical details:
```bash
zavorth doctor --advanced
```

The output tells you exactly what is wrong and what to do. Most problems are diagnosed here.

---

## Zavorth does not respond

**Check the runtime is running:**
```bash
zavorth status
```

If it is not running, start it:
```bash
zavorth start
```

**Check the provider is configured:**
```bash
zavorth providers
```

If a provider shows `missing_auth`, add your API key:
```bash
zavorth providers add
```

---

## A channel is not connecting

**Run the channel doctor:**
```bash
zavorth connectors doctor telegram
zavorth connectors doctor discord
zavorth connectors doctor slack
```

This tells you exactly what credential or configuration is missing.

**Common causes:**

| Channel | Most common issue |
|---|---|
| Telegram | Bot token missing or wrong — check `TELEGRAM_BOT_TOKEN` |
| Discord | Bot not invited to the server, or `DISCORD_BOT_TOKEN` missing |
| WhatsApp | Webhook URL not configured in Meta portal, or QR expired (Baileys) |
| Slack | Event subscriptions not enabled, or missing bot scopes |
| Signal | signal-cli not running in JSON-RPC mode |
| Email | SMTP credentials wrong — use an app password, not your login password |

---

## Provider errors

**"API key invalid" or authentication errors:**
```bash
zavorth providers test <provider-name>
```

Double-check the key in your `.env`. Make sure there are no extra spaces or newlines.

**Model not found:**
Some models require a specific API tier. Check if the model you selected is available on your account.

**Rate limit errors:**
Zavorth automatically retries on rate limits. If it is happening frequently, switch to a model with higher limits or add a fallback provider.

---

## Zavorth is very slow

**Check which model is active:**
```bash
zavorth providers
```

Large models are slower. Try switching to a faster one:
```bash
zavorth providers switch --provider gemini --model gemini-2.5-flash
```

**Local models (Ollama, LM Studio) are slow:**
Smaller models run faster. For Ollama: `zavorth providers switch --provider ollama --model gemma2:2b`

---

## Approvals are not appearing

**In chat channels:** Approval requests are sent to the channel that triggered the task. If you sent a message from Telegram, the approval appears in Telegram.

**In ZavorthControl:** Open [http://localhost:3000/control](http://localhost:3000/control) — approvals appear in the dashboard immediately.

**Finding a pending approval:**
```bash
zavorth status          # shows pending approvals count
zavorth receipts        # shows recent activity
```

---

## Something ran that it should not have

**Check the receipts:**
```bash
zavorth receipts
```

Receipts log everything Zavorth did, including what was approved and by whom.

**Tighten approval settings:**
```bash
zavorth setup --safety
```

Or tell Zavorth directly:
```
Always ask before running any shell commands.
Always ask before writing files.
```

**For reversible actions, try rollback:**
```bash
zavorth rollback <receipt-id>
```

---

## Memory feels wrong or outdated

**Search memory:**
```bash
zavorth memory query "what you're looking for"
```

**Re-index after adding documents:**
```bash
zavorth memory ingest
```

**Check for stale entries:**
```bash
zavorth memory lint
```

---

## Setup wizard is stuck

If setup was interrupted:
```bash
zavorth setup          # re-run the full wizard
zavorth setup --safety  # run only the safety section
```

Each section saves as you go — you won't lose what was already configured.

---

## Getting more help

```bash
zavorth --help          # general help
zavorth <command> --help  # help for a specific command
zavorth doctor --json    # machine-readable diagnostics
```

If `doctor` reports something unexpected, the output has a **next safe action** telling you what to do.

## Related

- [Getting started](/docs/product/start/getting-started)
- [ZavorthControl](/docs/product/interfaces/zavorthcontrol)
- [Channels](/docs/product/channels)
- [Providers](/docs/product/providers)
