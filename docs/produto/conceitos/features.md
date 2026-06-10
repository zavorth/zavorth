---
title: "Features"
description: "Everything Zavorth can do, in one place."
---

## Highlights

<Columns>
  <Card title="Channels" icon="message-square" href="/docs/produto/canais">
    Guided setup for Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email, and more.
  </Card>
  <Card title="AI models" icon="cpu" href="/docs/produto/providers">
    Provider and model routing with readiness checks, live probes, and local fallback options.
  </Card>
  <Card title="Skills" icon="package" href="/docs/produto/skills">
    Install ready-made skills or let Zavorth draft new workflows with review and receipts.
  </Card>
  <Card title="Memory" icon="brain" href="/docs/produto/conceitos/memoria">
    Remembers useful context with evidence, expiry, and a way to review or forget it.
  </Card>
  <Card title="Approvals" icon="shield" href="/docs/produto/conceitos/aprovacoes">
    Sensitive actions show a preview and wait for your OK.
  </Card>
</Columns>

## Full list

### Channels

- **Guided first-class setup**: Telegram, Discord, WhatsApp (Cloud API + local bridge), Slack, Signal, iMessage (macOS bridge), Microsoft Teams, Email (SMTP/IMAP)
- **Catalogued**: Matrix, Mattermost, Feishu/Lark, Google Chat, WeChat/WeCom, QQ Bot, IRC, LINE, Zalo, Twitch, Nostr, Synology Chat, Home Assistant, and more
- Group chat support with mention-based activation
- Per-channel safety policy: allowlists, blocked senders, open/closed mode
- Doctor/live proof gates external channels before they can become default routes
- Every connected channel uses the same runtime: not separate bots, one Zavorth

### AI models and providers

- **Provider catalog**: Gemini, Google GenAI SDK, OpenAI, Anthropic, Claude via Vertex AI, Claude via AWS Bedrock, DeepSeek, OpenRouter, MiniMax, Qwen, Ollama, LM Studio, vLLM, AI Gateway, OpenCode, and compatible routes
- **Any OpenAI-compatible endpoint**: Groq, Mistral, xAI, Perplexity, Together AI, Fireworks, Cerebras, SambaNova, Moonshot AI, NVIDIA NIM, GitHub Models, Vercel AI Gateway, DeepInfra, HuggingFace, and custom endpoints
- Switch providers without restarting: `zavorth providers switch`
- Guided wizard to add a new provider: `zavorth providers add`
- Provider readiness check with explicit live probe: `zavorth providers test <name> --live`
- Every provider is wrapped with egress security: Zavorth controls what the model can access

### Skills

- Install ready-made skills from the skill library
- Create new skills from repeated workflows; Zavorth can draft a skill after it sees a pattern
- Import skills from compatible `SKILL.md` sources
- Skills are audited before install: risk score, license, provenance, smoke checks
- Skill evolution can improve existing skills with preview, approval when needed, and receipts

### Memory

- **4 tiers**: Working (active session), Episodic (past runs and receipts), Semantic (project knowledge), Procedural (habits and preferences)
- SQLite full-text search across stored sessions, so you can ask about an older decision
- Local wiki (`.zavorth/wiki`) stores synthesized project knowledge in readable Markdown
- High-impact memory is never silently promoted; low-risk preferences stay reversible with receipts
- Raw secrets are never stored in memory

### Approvals and safety

- Every sensitive action shows a preview before executing
- Approval by chat message, by Telegram tap, or by clicking in the dashboard
- Full receipt after every approved action: what ran, what changed, what it cost
- Rollback support for reversible actions
- Cognitive Firewall between your message and execution: intent is classified before any tool runs
- LLM Egress Guard on every provider: the model cannot reach external services beyond what you configured
- Docker, gVisor, Firecracker, WSL, SSH, and cloud execution routes are readiness/proof gated

### Dashboard and interfaces

- **ZavorthControl**: browser dashboard with chat, approvals, receipts, channel status, provider health, and slash commands
- **CLI**: terminal interface with `zavorth ask`, `zavorth run`, `zavorth hud`, `zavorth pulse`
- **Satellite PWA**: browser-based companion for mobile approvals, no app store required
- **Headless mode**: one-shot automation with JSON output, for example `zavorth -p "review this repo" --json`

### Personality and identity

- First-run setup for name, personality, language, tone, initiative level, and approval boundaries
- Consistent identity across connected channels: same Zavorth, different formatting
- Quick style presets: short, dev, mentor, executive
- Recalibrate any time with the CLI, dashboard, voice flow, or a natural-language instruction
- Persona is stored in readable local files you can inspect and edit

## Related

- [Channel setup](/docs/produto/canais)
- [Provider setup](/docs/produto/providers)
- [Skills](/docs/produto/skills)
- [How approvals work](/docs/produto/conceitos/aprovacoes)
