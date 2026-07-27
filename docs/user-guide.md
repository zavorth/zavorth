# Zavorth User Guide

## Quick Start

```bash
zavorth setup
zavorth doctor
zavorth ready
zavorth chat
```

## Main Commands

| Command | Purpose |
| --- | --- |
| `zavorth setup` | Guided setup for providers, channels, and language |
| `zavorth chat` | Terminal chat session |
| `zavorth ask "..."` | Single governed question |
| `zavorth doctor` | System diagnostics |
| `zavorth ready` | Check whether the runtime is ready |

## Language

Zavorth can use the user's configured locale and can be overridden explicitly:

```bash
zavorth setup --lang en-US
```

Add new locales through locale resources, not hardcoded runtime branches.

## Instance Profiles

Run isolated Zavorth instances for different contexts, such as personal and work:

```bash
zavorth instance create work
zavorth instance use work
zavorth instance list
zavorth instance current
zavorth instance delete work
```

Each instance has its own database, memory, sessions, credentials, and configuration.

## Providers

```bash
zavorth providers list
zavorth providers doctor
```

## Messaging Channels

Use channel setup and doctor commands to configure Telegram, WhatsApp, web, desktop, or other registered channels.

## Cron and Automation

Prefer structured schedules and LLM-resolved intent. Natural-language scheduling should be converted into canonical schedule payloads before runtime execution.

## Security

- Approval gates require confirmation before sensitive actions.
- Receipts record each meaningful action.
- Scoped permissions expire and are limited by channel and action.
- Secrets never appear in logs or prompts.

## Desktop and Web

The UI provides navigation, session state, approval review, receipts, and runtime readiness without exposing raw internals.

## Troubleshooting

```bash
zavorth doctor
zavorth doctor --json
```
