# Zavorth Memory

## Project Identity

- **Name:** Zavorth â€” "Your AI that does things â€” and proves it"
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

Runtime governado com receipts auditÃ¡veis. Todo pathway de aÃ§Ã£o sensÃ­vel segue:
normalizar intenÃ§Ã£o â†’ preview â†’ classificar risco â†’ Policy Broker â†’ aprovar â†’ executar â†’ receipt â†’ rollback.

**Planos principais:** Surface Plane (CLI, Dashboard, API, canais), Gateway Spine (estado de sessÃ£o),
Policy Plane (aprovaÃ§Ãµes, bloqueios, guards), Execution Plane (tools, subagents, skills, providers),
Swarm v2 (multi-agente com orÃ§amento), Memory & Artifact Plane, Capability Plane.

## License Update (2026-06-25)

Arquivos atualizados de Proprietary/UNLICENSED para MIT:
- `LICENSE` â€” texto MIT completo
- `package.json` â€” "license": "MIT"
- `packages/create-zavorth/package.json` â€” "license": "MIT"
- `sdk/typescript/package.json` â€” jÃ¡ era MIT (nÃ£o precisou alteraÃ§Ã£o)

## Provider Catalog Update (2026-06-25)

Providers adicionados aos manifests de catÃ¡logo que existiam no dashboard/code mas nÃ£o nos manifests:

**longTailProviderActivationProviders.ts** (+21): deepinfra, fireworks, glm, kimi, kimi-coding-apikey, alicode, alicode-intl, blackbox, nebius, siliconflow, hyperbolic, longcat, pollinations, aimlapi, novita, piapi, getgoapi, laozhang, puter, scaleway, cloudflare-ai

**zavorthProviderCertificationPack.ts** (+35): cursor, cline, deepinfra, fireworks, glm, kimi, kimi-coding-apikey, alicode, alicode-intl, blackbox, nebius, siliconflow, hyperbolic, qoder, qwen, kiro, longcat, pollinations, aimlapi, novita, piapi, getgoapi, laozhang, puter, scaleway, cloudflare-ai, vertex, perplexity-search, serper-search, brave-search, exa-search, tavily-search

**mediaProviders.ts** (+5): assemblyai, elevenlabs, huggingface, cartesia, playht

**zavorthProviderCapabilityProviders.ts** (+7): assemblyai, cartesia, playht, sdwebui, huggingface, deepinfra, runway, fal

## Self-Learning Ecosystem (underdocumented, verified 2026-06-25)

O Zavorth possui ecossistema completo de auto-aprendizado com 15 componentes governados:

### Loop Central
- `ZavorthNativeLearningLoopService.ts` (616 linhas) â€” hub que processa observaÃ§Ãµes, passa por firewall de seguranÃ§a, gera candidatos tipados: auto-skill-candidate, procedural-memory, skill-improvement-candidate, user-model-update, approved-nudge

### Skill Auto-CriaÃ§Ã£o e EvoluÃ§Ã£o
- `ZavorthSkillEvolutionService.ts` (1.107 linhas) â€” pipeline de 7 estÃ¡gios: sintetizar â†’ scan â†’ sandbox â†’ eval gate (score 0.8+) â†’ mutation plan â†’ install â†’ rollback. Bloqueia prompt injection e alto risco
- `ZavorthSkillCuratorLiveLoopService.ts` (1.083 linhas) â€” quality scoring 0-100, duplicate detection, maintenance proposals
- `SkillCuratorPlaneService.ts` (1.085 linhas) â€” curator periÃ³dico com lifecycle states (active/stale/archived), LLM reviewer opcional
- `SkillQuarantinePipelineService.ts` â€” holds drafts isolados atÃ© validaÃ§Ã£o

### Dream Cycle (ConsolidaÃ§Ã£o de MemÃ³ria)
- `MnemosDreamCycleService.ts` (313+ linhas) â€” consolidaÃ§Ã£o periÃ³dica: merge duplicatas, poda obsoletos, resolve contradiÃ§Ãµes por recÃªncia, quarentena secrets. Requer aprovaÃ§Ã£o para aplicar. MÃ­nimo 24h entre ciclos, 5 sessÃµes, 30min idle

### Learning OS Adaptativo (3 Faixas)
- `ZavorthAdaptiveLearningOsService.ts` (622 linhas)
  - Verde: preferÃªncias de baixo risco (estilo, idioma) â€” aplicadas silenciosamente
  - Amarelo: drafts e candidatos â€” staged para digest review
  - Vermelho: mudanÃ§as sensÃ­veis (inferÃªncias psicolÃ³gicas, seguranÃ§a) â€” aprovaÃ§Ã£o explÃ­cita
- Scanner tÃ©cnico bloqueia prompt injection antes da classificaÃ§Ã£o semÃ¢ntica

### Replay Learning
- `ZavorthReplayLearningService.ts` (775 linhas) â€” "digital twin" de sessÃµes, rastreia preferÃªncias, estilo, padrÃµes de debug. Modo suggest-only
- `ZavorthReplayLearningControlPlaneService.ts` (345 linhas) â€” artifacts, candidates, timeline, resume prompts

### Memory e Procedural Learning
- `ZavorthMemoryLearningLoopService.ts` â€” SQLite + FTS5, search, layer management, skill candidate assessment
- `ZavorthMnemosProceduralMemoryService.ts` â€” extrai hÃ¡bitos do operador como regras tipadas com risk scoring

### Skill Import e Marketplace
- `UniversalSkillIntakeService.ts` â€” scan directories e ZIPs em 7 perfis de fonte
- `UniversalSkillTrustImportService.ts` â€” materializa candidatos aprovados em skill-library/imported/
- `SkillImportService.ts` â€” import governado com audit trail e license classification

### TrajetÃ³ria e AutoconsciÃªncia
- `ZavorthTrajectoryExportService.ts` â€” exporta trajectories de receipts, logs, memory, mnemos
- `CapabilityDiscoveryService.ts` â€” auto-descobre e cataloga capacidades do prÃ³prio Zavorth

## 29 Channel Gateways (verified 2026-06-25)

**Dedicados (10):** Telegram (mais maduro, 90+ arquivos), Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email, Instagram, Simple

**Via factory/registry (19 adicionais):** Matrix, LINE, Google Chat, Feishu/Lark, IRC, QQ, Zalo, WeCom, Weixin/WeChat, Yuanbao (Tencent), SMS, Home Assistant, Voice Call, Google Meet, Twitch, Nextcloud Talk, Mattermost, Synology Chat, ClickClack, Nostr

**Modos de conexÃ£o:**
- API nativa (3): Matrix, LINE, Zalo
- Webhook (12): Slack, Teams, Email, Google Chat, Feishu, QQ, WeCom, Mattermost, Synology, ClickClack, Nextcloud Talk, Instagram
- Bridge local (8): WhatsApp, iMessage, Weixin, Yuanbao, Voice Call, Google Meet, IRC, Nostr
- Bot HTTP API (2): SMS, Twitch

**SuperfÃ­cies adicionais:** Web Dashboard, CLI, REST API, WebSocket

