# Zavorth Memory

## Project Identity

- **Name:** Zavorth — "Your AI that does things — and proves it"
- **Version:** 2.0.0 (2026-06-22)
- **License:** MIT (updated 2026-06-25)
- **Stack:** TypeScript (Node.js), Next.js dashboard, Jest tests
- **Mascot:** Kael the fox (visual identity, not a separate agent)
- **Color:** #00e88f (Zavorth green)

## Scale (as of 2026-06-25)

- ~2 million lines of code (TS/TSX/JS/MJS)
- 5,788 TypeScript files in src/
- 345K lines of tests
- 60+ LLM/media/ecosystem providers
- 29 registered channel gateways (35+ including surfaces)
- 88+ built-in tools
- 88+ native skills
- 27 security modules in src/security/
- 15-component governed learning ecosystem

## Architecture Summary

Runtime governado com receipts auditáveis. Todo pathway de ação sensível segue:
normalizar intenção → preview → classificar risco → Policy Broker → aprovar → executar → receipt → rollback.

**Planos principais:** Surface Plane (CLI, Dashboard, API, canais), Gateway Spine (estado de sessão),
Policy Plane (aprovações, bloqueios, guards), Execution Plane (tools, subagents, skills, providers),
Swarm v2 (multi-agente com orçamento), Memory & Artifact Plane, Capability Plane.

## License Update (2026-06-25)

Arquivos atualizados de Proprietary/UNLICENSED para MIT:
- `LICENSE` — texto MIT completo
- `package.json` — "license": "MIT"
- `packages/create-zavorth/package.json` — "license": "MIT"
- `sdk/typescript/package.json` — já era MIT (não precisou alteração)

## Provider Catalog Update (2026-06-25)

Providers adicionados aos manifests de catálogo que existiam no dashboard/code mas não nos manifests:

**longTailProviderActivationProviders.ts** (+21): deepinfra, fireworks, glm, kimi, kimi-coding-apikey, alicode, alicode-intl, blackbox, nebius, siliconflow, hyperbolic, longcat, pollinations, aimlapi, novita, piapi, getgoapi, laozhang, puter, scaleway, cloudflare-ai

**zavorthProviderCertificationPack.ts** (+35): cursor, cline, deepinfra, fireworks, glm, kimi, kimi-coding-apikey, alicode, alicode-intl, blackbox, nebius, siliconflow, hyperbolic, qoder, qwen, kiro, longcat, pollinations, aimlapi, novita, piapi, getgoapi, laozhang, puter, scaleway, cloudflare-ai, vertex, perplexity-search, serper-search, brave-search, exa-search, tavily-search

**mediaProviders.ts** (+5): assemblyai, elevenlabs, huggingface, cartesia, playht

**zavorthProviderCapabilityProviders.ts** (+7): assemblyai, cartesia, playht, sdwebui, huggingface, deepinfra, runway, fal

## Self-Learning Ecosystem (underdocumented, verified 2026-06-25)

O Zavorth possui ecossistema completo de auto-aprendizado com 15 componentes governados:

### Loop Central
- `ZavorthNativeLearningLoopService.ts` (616 linhas) — hub que processa observações, passa por firewall de segurança, gera candidatos tipados: auto-skill-candidate, procedural-memory, skill-improvement-candidate, user-model-update, approved-nudge

### Skill Auto-Criação e Evolução
- `ZavorthSkillEvolutionService.ts` (1.107 linhas) — pipeline de 7 estágios: sintetizar → scan → sandbox → eval gate (score 0.8+) → mutation plan → install → rollback. Bloqueia prompt injection e alto risco
- `ZavorthSkillCuratorLiveLoopService.ts` (1.083 linhas) — quality scoring 0-100, duplicate detection, maintenance proposals
- `SkillCuratorPlaneService.ts` (1.085 linhas) — curator periódico com lifecycle states (active/stale/archived), LLM reviewer opcional
- `SkillQuarantinePipelineService.ts` — holds drafts isolados até validação

### Dream Cycle (Consolidação de Memória)
- `MnemosDreamCycleService.ts` (313+ linhas) — consolidação periódica: merge duplicatas, poda obsoletos, resolve contradições por recência, quarentena secrets. Requer aprovação para aplicar. Mínimo 24h entre ciclos, 5 sessões, 30min idle

### Learning OS Adaptativo (3 Faixas)
- `ZavorthAdaptiveLearningOsService.ts` (622 linhas)
  - Verde: preferências de baixo risco (estilo, idioma) — aplicadas silenciosamente
  - Amarelo: drafts e candidatos — staged para digest review
  - Vermelho: mudanças sensíveis (inferências psicológicas, segurança) — aprovação explícita
- Scanner técnico bloqueia prompt injection antes da classificação semântica

### Replay Learning
- `ZavorthReplayLearningService.ts` (775 linhas) — "digital twin" de sessões, rastreia preferências, estilo, padrões de debug. Modo suggest-only
- `ZavorthReplayLearningControlPlaneService.ts` (345 linhas) — artifacts, candidates, timeline, resume prompts

### Memory e Procedural Learning
- `ZavorthMemoryLearningLoopService.ts` — SQLite + FTS5, search, layer management, skill candidate assessment
- `ZavorthMnemosProceduralMemoryService.ts` — extrai hábitos do operador como regras tipadas com risk scoring

### Skill Import e Marketplace
- `UniversalSkillIntakeService.ts` — scan directories e ZIPs em 7 perfis de fonte
- `UniversalSkillTrustImportService.ts` — materializa candidatos aprovados em skill-library/imported/
- `SkillImportService.ts` — import governado com audit trail e license classification

### Trajetória e Autoconsciência
- `ZavorthTrajectoryExportService.ts` — exporta trajectories de receipts, logs, memory, mnemos
- `CapabilityDiscoveryService.ts` — auto-descobre e cataloga capacidades do próprio Zavorth

## 29 Channel Gateways (verified 2026-06-25)

**Dedicados (10):** Telegram (mais maduro, 90+ arquivos), Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email, Instagram, Simple

**Via factory/registry (19 adicionais):** Matrix, LINE, Google Chat, Feishu/Lark, IRC, QQ, Zalo, WeCom, Weixin/WeChat, Yuanbao (Tencent), SMS, Home Assistant, Voice Call, Google Meet, Twitch, Nextcloud Talk, Mattermost, Synology Chat, ClickClack, Nostr

**Modos de conexão:**
- API nativa (3): Matrix, LINE, Zalo
- Webhook (12): Slack, Teams, Email, Google Chat, Feishu, QQ, WeCom, Mattermost, Synology, ClickClack, Nextcloud Talk, Instagram
- Bridge local (8): WhatsApp, iMessage, Weixin, Yuanbao, Voice Call, Google Meet, IRC, Nostr
- Bot HTTP API (2): SMS, Twitch

**Superfícies adicionais:** Web Dashboard, CLI, REST API, WebSocket

## Comparison vs Competitors (2026-06-25)

### vs Hermes Agent (Nous Research, Python)
- Hermes: ~560K linhas código, ~621K testes, 20+ canais, learning loop + Kanban + 6 terminal backends
- Zavorth: ~2M linhas, 345K testes, 29 canais, learning loop mais governado (sandbox + eval gates)
- Zavorth tem quality scoring e duplicate detection de skills (Hermes não tem)
- Hermes roda em $5 VPS ou serverless (Daytona/Modal) — mais acessível em hosting
- Hermes tem profile system com instâncias isoladas

### vs OpenClaw (open source, TypeScript)
- OpenClaw: ~5.2M linhas, 25+ canais, plugin system extenso, ClawSweeper review
- Zavorth: ~2M linhas, 29 canais, 60+ providers (mais que OpenClaw)
- OpenClaw tem mais canais documentados e maduros (25+ vs 29 do Zavorth com maturidade variada)
- Zavorth tem pipeline de segurança mais denso (27 módulos em src/security/)
- Zavorth tem media pipeline completa (image, video, music, TTS, transcription) integrada no core

## Diferenciais Únicos do Zavorth

1. **Approval gates truly scoped** — permissões por tempo, canal, tipo de ação, com expiração
2. **Receipts auditáveis** — cada ação gera proof completa
3. **Cognitive firewall** — 27 módulos de segurança com Effect Policy Engine
4. **60+ providers** — catálogo mais extenso dos três projetos
5. **15-component learning ecosystem** — mais governado que Hermes (sandbox + eval gates)
6. **Quality scoring de skills** — pontuação 0-100, detection de duplicatas (único dos três)
7. **29 canais** — próximo do OpenClaw, à frente do Hermes
8. **Media pipeline completa** — 10 providers de imagem, 16 de vídeo, 3 de música, 15 de TTS, 6 de transcrição
9. **Swarm v2** — multi-agente com 300 papéis orçamentados e workers isolados
10. **Trajectory generation** — exporta dados de treinamento em jsonl/sharegpt/alpaca com redaction de secrets
