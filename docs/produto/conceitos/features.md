---
title: "Features"
description: "Everything Zavorth can do, in one place."
---

## Highlights

<Columns>
  <Card title="Channels" icon="message-square" href="/docs/produto/canais">
    Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email, and 20+ more.
  </Card>
  <Card title="AI models" icon="cpu" href="/docs/produto/providers">
    14+ providers built in. Use Gemini, Claude, GPT-4o, DeepSeek, or any local model.
  </Card>
  <Card title="Skills" icon="package" href="/docs/produto/skills">
    Install ready-made skills or teach Zavorth your own workflows.
  </Card>
  <Card title="Memory" icon="brain" href="/docs/produto/conceitos/memoria">
    Remembers decisions, preferences, and project context across sessions.
  </Card>
  <Card title="Approvals" icon="shield" href="/docs/produto/conceitos/aprovacoes">
    Everything sensitive shows you a preview and waits for your OK.
  </Card>
</Columns>

## Full list

### Channels

- **Built-in**: Telegram, Discord, WhatsApp (Cloud API + local bridge), Slack, Signal, iMessage (macOS bridge), Microsoft Teams, Email (SMTP/IMAP)
- **Catalogued**: Matrix, Mattermost, Feishu/Lark, Google Chat, WeChat/WeCom, QQ Bot, IRC, LINE, Zalo, Twitch, Nostr, Synology Chat, Home Assistant, and more
- Group chat support with mention-based activation
- Per-channel safety policy (allowlists, blocked senders, open/closed mode)
- Every channel uses the same runtime — not separate bots, one Zavorth

### AI models and providers

- **14+ providers built in**: Gemini, Google GenAI SDK, OpenAI, Anthropic (Claude), Claude via Vertex AI, Claude via AWS Bedrock, DeepSeek, OpenRouter (200+ models), MiniMax, Qwen, Ollama, LM Studio, vLLM, AI Gateway, OpenCode
- **Any OpenAI-compatible endpoint**: Groq, Mistral, xAI (Grok), Perplexity, Together AI, Fireworks, Cerebras, SambaNova, Moonshot AI, NVIDIA NIM, GitHub Models, Vercel AI Gateway, DeepInfra, HuggingFace, and any custom endpoint
- Switch providers without restarting: `zavorth providers switch`
- Guided wizard to add a new provider: `zavorth providers add`
- Provider readiness check with live probe: `zavorth providers test <name>`
- Every provider is wrapped with egress security — Zavorth controls what the model can access

### Skills

- Install ready-made skills from the skill library
- Create new skills from conversations — Zavorth can draft a skill after it sees you do the same task twice
- Import skills from compatible `SKILL.md` sources
- Skills are audited before install: risk score, license, provenance
- Skill evolution: existing skills can be improved — always preview-first, never silent

### Memory

- **4 tiers**: Working (active session), Episodic (past runs and receipts), Semantic (project knowledge), Procedural (your habits and preferences)
- SQLite full-text search across all sessions — ask about a decision from three weeks ago
- Local wiki (`.zavorth/wiki`) stores synthesized project knowledge in readable Markdown
- Memory is never silently promoted — promotion requires your approval
- Raw secrets are never stored in memory

### Approvals and safety

- Every sensitive action shows a preview before executing
- Approval by chat message, by Telegram tap, or by clicking in the dashboard
- Full receipt after every approved action — what ran, what changed, what it cost
- Rollback support for reversible actions
- Cognitive Firewall between your message and execution — intent is classified before any tool runs
- LLM Egress Guard on every provider — the model cannot reach external services beyond what you configured
- Docker and Firecracker sandboxes for running untrusted code

### Dashboard and interfaces

- **ZavorthControl** — browser dashboard with chat, approvals, receipts, channel status, and provider health
- **CLI** — full terminal interface with `zavorth ask`, `zavorth run`, `zavorth hud`, `zavorth pulse`
- **Satellite PWA** — browser-based companion for mobile, no app store required
- **Headless mode** — one-shot automation: `zavorth -p "review this repo" --json`

### Personality and identity

- Full setup at first run: name, personality, language, tone, initiative level, approval boundaries
- Consistent identity across every channel — same Zavorth, different formatting
- Quick style presets: short, dev, mentor, executive
- Recalibrate any time: `zavorth recalibrate --voice` or just tell it what to change
- Persona is stored in plain Markdown files you can read and edit directly

## Related

- [Channel setup](/docs/produto/canais)
- [Provider setup](/docs/produto/providers)
- [Skills](/docs/produto/skills)
- [How approvals work](/docs/produto/conceitos/aprovacoes)
