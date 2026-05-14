# Plan: Rollout publico por canais no Discord

**Feature ID:** `discord/public-channel-rollout`  
**Status:** active

## 1. Arquitetura

- Componentes principais:
  - `src/gateways/DiscordGateway.ts`
  - `src/services/DiscordSurfacePolicyService.ts`
  - `src/services/TenantContextService.ts`
  - `src/services/TenantRegistryService.ts`
  - `src/services/RuntimeAccessReadinessService.ts`
  - `src/services/RuntimeDiagnosticsService.ts`
- Mudancas de fluxo:
  - leitura da allowlist por canal deve influenciar ingress, onboarding e readiness
  - o tenant compartilhado deve promover seu status quando owner/guild/channel/policy estiverem coerentes
- Riscos arquiteturais:
  - false ready no runtime
  - allowlist parcialmente aplicada entre gateway e tenancy
  - canal pai/thread tratados de forma incoerente

## 2. Arquivos E Modulos

- `src/gateways/DiscordGateway.ts`
- `src/services/DiscordSurfacePolicyService.ts`
- `src/services/TenantContextService.ts`
- `src/services/TenantRegistryService.ts`
- `src/services/RuntimeAccessReadinessService.ts`
- `src/services/RuntimeDiagnosticsService.ts`
- `tests/gateways/DiscordGateway.test.ts`
- `tests/services/RuntimeAccessReadinessService.test.ts`
- `tests/services/TenantRegistryService.test.ts`

## 3. Dados, Estado E Memoria

- Persistencia:
  - `tenant-registry.json`
  - `discord-bridge-status.json`
- Runtime state:
  - snapshot do Discord deve refletir guilds/canais allowlisted
- Sessao/tenant:
  - tenant compartilhado do Discord precisa carregar `allowedChannelIds` e onboarding coerente

## 4. Seguranca

- Boundaries:
  - servidor publico Discord tratado como shared tenant
- Permissoes:
  - operacao sensivel segue owner/operator-only
- Validacoes:
  - channel allowlist
  - public-server-mode
  - owner IDs configurados
  - guild allowlist coerente

## 5. Validacao

- Build:
  - `npm run build`
- Testes:
  - gateway do Discord
  - readiness
  - tenant registry
- Smoke operacional:
  - `npm run ops:access`
  - confirmar que a recomendacao de onboarding do Discord some

## 6. Rollout

- Sequencia de entrega:
  1. configurar `DISCORD_ALLOWED_CHANNEL_IDS`
  2. validar propagacao ao tenant context e readiness
  3. testar em canal piloto
  4. expandir para novos canais
- Criticos de parada:
  - comandos aceitos fora da allowlist
  - tenant ainda em onboarding depois de policy completa
- Rollback:
  - remover canais do `.env`
  - reiniciar supervisor
