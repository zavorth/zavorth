---
title: "Agent Identity & Personality"
description: "Learn how to customize Zavorth's name, personality, tone, and working style across all channels."
---

# Agent Identity & Personality 🦊

Zavorth is not a generic chatbot. It is designed to be an agent with a **customizable personality, name, and visual identity** that remains consistent across all of your communication channels (Telegram, Discord, WhatsApp, Slack, etc.).

By defining a unique identity, you transform Zavorth from a simple CLI runner into a bespoke personal assistant that matches your workflow and collaboration preferences.

## Core Concepts

Zavorth's identity system is built on three main pillars:

1. **Consistent Persona**: The agent uses the same name, tone of voice, and stylistic preferences whether you talk to it via terminal, Telegram on your phone, or a browser tab.
2. **Behavioral Calibration**: You can configure how verbose, formal, creative, or cautious the agent is when making plans and asking for approvals.
3. **Channel-Specific Rendering**: While the core persona is unified, Zavorth adapts its output formatting (Markdown, rich cards, system notifications) to look natural on the active messaging platform.

---

## Calibrating the Soul of Zavorth

The agent's behaviors and cognitive boundaries are governed by two main configuration files in your repository:

- `SOUL.md`: Defines the core character, baseline values, motivations, and rules of engagement.
- `IDENTITY.md`: Establishes the agent's official name, pronouns, avatar, language preferences, and communication style.

### The Configuration Process

You can calibrate your agent's identity using the CLI setup wizard:

```bash
zavorth setup --personality
```

This interactive tool guides you through adjusting key parameters:
- **Tone**: Choose between *Formal*, *Technical*, *Friendly*, or *Direct*.
- **Verbosity**: Configure how much detail is included in planned steps and explanations.
- **Safety Margin**: Adjust how proactively the agent requests manual approval for borderline sensitive tasks.

---

## Customizing Avatars and Names

To customize the visual representation of your agent on supported channels (like Telegram and Discord):

1. **Set Name**: Update the `name` field inside `IDENTITY.md`.
2. **Set Profile Picture**: Place a square PNG image in your `.zavorth` configuration folder named `avatar.png`.
3. **Synchronize**: Run the sync command to push the new identity settings to your connected channels:
   ```bash
   zavorth sync-identity
   ```

By customizing its persona, you make Zavorth uniquely yours.
