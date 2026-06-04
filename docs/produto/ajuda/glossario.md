---
title: "Glossary"
description: "Key terms used in Zavorth, explained in plain language."
---

## A

**Approval**
A confirmation step before Zavorth does something sensitive. Zavorth shows you what it wants to do, you say yes or no. See [Approvals](/docs/produto/conceitos/aprovacoes).

**Approval card**
The UI element (in ZavorthControl, Telegram, or the CLI HUD) showing a pending action with Approve / Reject options.

## B

**Bootstrap**
The first-run wizard that calibrates Zavorth's identity, personality, language, and safety settings. Runs automatically via `zavorth setup`.

## C

**Capability Mesh**
The decision engine that chooses whether to use a native skill, compose existing skills, adapt a native capability, or create a new skill draft for a given request.

**Channel**
A communication surface Zavorth listens to and responds on — Telegram, Discord, WhatsApp, Slack, Signal, the browser dashboard, the CLI, etc.

**Channel Mesh**
The internal system that routes messages from all channels into the same Zavorth runtime, with per-channel policies applied.

**Cognitive Firewall**
A security layer between your message and execution. It classifies the intent before any tool runs — blocking malicious or unexpected requests.

## D

**Doctor**
The `zavorth doctor` command — runs a full diagnostic of the runtime, providers, channels, and configuration, and tells you what to fix.

## E

**Effect**
Anything Zavorth does that changes state — writing a file, running a command, sending a message. Effects are what the approval model governs (reading is never an effect).

**Episodic memory**
One of Zavorth's four memory tiers. Stores past runs, decisions, and receipts — what Zavorth did, when, and why.

## G

**Gateway**
The running Zavorth process that manages channels, providers, skills, and approvals. Analogous to a server — you start it with `zavorth start`.

## H

**HUD**
The terminal dashboard (`zavorth hud`) showing active tasks, approvals, receipts, and runtime status. Named after a heads-up display.

## I

**IDENTITY.md**
One of four personalization files. Stores the agent's name, role, mascot, and how it presents itself.

## L

**Learning Loop**
The system that watches your repeated workflows and proposes auto-skills. Always preview-first, never silent.

**LlmEgressGuard**
A security wrapper applied to every AI provider. Controls what the model can access externally — prevents the model from calling services you did not configure.

## M

**Mnemos**
Zavorth's memory system. Named after the concept of memory. Manages four tiers: Working, Episodic, Semantic, and Procedural.

## P

**Policy Broker**
The internal system that evaluates every proposed action against configured rules before execution — checking workspace, provider, channel, and mutation boundaries.

**Procedural memory**
One of Zavorth's four memory tiers. Stores your habits and preferences — how you like things done.

**Provider**
An AI model service — Gemini, Claude, OpenAI, a local Ollama model, or any OpenAI-compatible endpoint.

**Provider Mesh**
The internal system that manages multiple configured providers and can route requests between them.

**Pulse**
The `zavorth pulse` command — a fast daily briefing: best next action, pending approvals, recent receipts, active risks.

## R

**Ready**
`zavorth ready` — the launch check. Returns `Pronto` (all good), `Attention` (usable with gaps), or `Blocked` (a required contract failed), plus the next action.

**Receipt**
A permanent log entry created after every action Zavorth takes. Contains what ran, what changed, how long it took, and what approval was given.

**Rollback**
Undoing a reversible action using its receipt ID: `zavorth rollback <id>`.

## S

**Satellite PWA**
A browser-based companion app that pairs to Zavorth from a mobile browser — no app store required. In development.

**SecretRef**
A reference to a credential stored securely, used instead of a raw API key in configuration or prompts. Example: `OPENAI_API_KEY` (the env var name, not the value).

**Semantic memory**
One of Zavorth's four memory tiers. Stores synthesized project knowledge — architecture decisions, technology choices, project facts.

**Skill**
A Markdown file (`SKILL.md`) that teaches Zavorth how to do a specific task. See [Skills](/docs/produto/skills).

**SOUL.md**
One of four personalization files. Stores Zavorth's personality — tone, warmth, humor, initiative, candor, collaboration style.

**Swarm**
Zavorth's multi-agent system. Spawns parallel subagents to handle different parts of a complex task, then synthesizes the results.

## T

**Transaction Plane**
The subsystem that handles financial or high-risk actions with a dedicated preview step before execution.

**Trust Lens**
A risk context overlay visible in the HUD and ZavorthControl. Shows why an action is classified as sensitive and what policy governs it.

## U

**USER.md**
One of four personalization files. Stores your name, language preference, pronouns, and how you like to be addressed.

## W

**Working memory**
One of Zavorth's four memory tiers. Active session context — what was said in the last few exchanges.

## Z

**ZavorthControl**
The browser dashboard at `http://localhost:3000/control`. The primary visual interface for chat, approvals, receipts, and runtime management.
