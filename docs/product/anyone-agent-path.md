# Everyday Agent Path

Local-first product path with reversible learning, simple setup, and stable channels.

> Learns from the operator with safe undo. Useful in chat, without jargon.

## Capabilities

| Area | User experience | Service |
|------|------------------------|---------|
| Learning | Preferences and routines with receipts and undo | `ZavorthLearningRuntimeHubService` |
| First-run | Language, preferred surface, and autonomous learning choice | `ZavorthFirstRunHumanOnboardingService` |
| Capabilities | Human-readable capability map | `ZavorthHumanSuperpowersService` |
| Reach | Desktop, Telegram, WhatsApp Cloud; experimental Baileys | `ZavorthHumanReachService` |

## Learning

1. After a successful turn, the runtime can store preferences when `learning.mode=autonomous`.
2. On the next turn, preferences enter the system prompt.
3. Experience: **Forget** card.
4. Telegram: "what did you learn?", "undo learning ..."
5. CLI `anyone digest` / `undo` uses the same hub.

```text
turn ok -> write -> trusted-preferences.json
next turn -> formatContextBlock -> prompt
undo / forget -> undo
```

## First-run

State: `data/runtime/first-run-human.json`

1. Language
2. Preferred surface (app / Telegram / web / terminal)
3. Learning yes/no

- Telegram intercepts messages until completion or skip.
- Experience exposes `snapshot.firstRun` and choice cards
- Natural setup phrases are interpreted by the runtime instead of fixed keyword lists.

## Capabilities

Conversation, preferences, files, web, routines, Telegram, WhatsApp Cloud, learned items, and local skills.

- Experience: `snapshot.superpowers`
- Telegram: "what can you do?", "help me with files"
- The agent prompt receives a summarized block of ready capabilities.

Trust: `Available now` / `Learned from the operator` / `Needs setup` / `Experimental`.

## Reach

Stable: Desktop, Telegram, WhatsApp Cloud API.

Experimental: WhatsApp Baileys in an isolated process.

- Experience: `snapshot.reach`
- Telegram: "where can I find you?", "how to configure Telegram", "WhatsApp guide"
- Surface preference comes from first-run when available.

## Diagnostic CLI

```bash
npm run anyone
npx tsx scripts/zavorth-anyone-agent-path.ts

zavorth anyone
zavorth anyone onboard --lang pt --surface desktop
zavorth anyone digest
zavorth anyone undo <id>
zavorth anyone powers
zavorth anyone reach
zavorth anyone learn-on
zavorth anyone learn-off
```

The CLI only projects the same runtime services.
