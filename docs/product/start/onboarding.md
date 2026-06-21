---
title: "Making it yours"
description: "Zavorth is not a generic chatbot. Set it up with your name, your language, your personality, and your rules."
---

Zavorth is not a generic AI with a name slapped on it. When you run `zavorth setup` for the first time, it asks you a series of questions to build a real working relationship — one that stays consistent every time you use it, on every channel.

## What you can configure

### The agent's identity

You can name it whatever you want. Keep it as "Zavorth" or give it a completely different name. You can also define its role — a personal assistant, a coding partner, a project manager — and how it should present itself.

This identity stays consistent whether you're talking in Telegram, Discord, WhatsApp, or the browser dashboard.

### How it addresses you

Tell Zavorth your name, what pronouns to use (if any), and how formal or casual to be. It stores this and uses it every session, without you having to repeat it.

### Language

Zavorth supports any language. Set Portuguese, English, Spanish, or any other as the default. You can also tell it to use one language in the interface and another in personal conversations.

### Personality and working style

During setup, Zavorth asks:

- **Tone** — should it be warm and conversational, direct and efficient, technical, or somewhere in between?
- **Initiative** — should it jump in with suggestions, wait for explicit instructions, or balance both?
- **Density** — short answers by default, or detailed explanations unless you say otherwise?
- **Candor** — should it push back on weak ideas early, or stay neutral unless you ask?

These preferences go into a file called `SOUL.md` in your workspace. You can edit it directly or ask Zavorth to change it at any time.

### What needs your approval

You decide what Zavorth should always ask before doing:

- Writing or deleting files
- Running shell commands
- Sending messages or emails
- Making network requests
- Changing providers or configurations

More cautious by default means fewer surprises. You can relax these over time as you build trust.

## The setup flow

```bash
zavorth setup
```

Zavorth asks about 8-12 questions, one at a time. It writes your answers to the right files as it goes, so if you stop partway through, your answers are already saved.

You can also run the wizard for just one part:

```bash
zavorth setup --identity     # name, role, how it presents itself
zavorth setup --personality  # tone, style, initiative
zavorth setup --safety       # what needs approval
```

## Quick personality presets

If you want to switch styles temporarily without changing your permanent settings:

```bash
zavorth ask "use short style"      # brief, to the point
zavorth ask "use dev style"        # technical, less explanation
zavorth ask "use mentor style"     # patient, explains reasoning
zavorth ask "use executive style"  # structured, decision-first
```

These are temporary. Your configured personality is always the default.

## Changing things later

You do not have to redo everything. Recalibrate only what changed:

```bash
zavorth recalibrate --voice   # change tone and style
zavorth recalibrate --user    # update your name or preferences
zavorth recalibrate --safety  # update approval rules
```

Or just tell Zavorth naturally:

```
Call me by a different name from now on.
Be more direct when I ask for code reviews.
Always ask before running any shell commands.
```

Zavorth updates the right files when it hears something that should stick.

## What the files look like

Your personalization lives in four files in your workspace:

| File | What it stores |
|---|---|
| `IDENTITY.md` | Name, role, how the agent presents itself |
| `SOUL.md` | Tone, personality, collaboration style |
| `USER.md` | Your name, language, preferences |
| `AGENTS.md` | Operating rules, safety posture, approval boundaries |

These are plain Markdown files. You can read and edit them directly.

## Related

- [Getting started](/docs/product/start/getting-started)
- [How approvals work](/docs/product/concepts/approvals)
- [Channels](/docs/product/channels)
