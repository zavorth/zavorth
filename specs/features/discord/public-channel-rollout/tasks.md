# Tasks: Rollout publico por canais no Discord

**Feature ID:** `discord/public-channel-rollout`  
**Status:** active

## Entrega

- [x] T1. Definir o objetivo do rollout por canal no `spec.md`
- [x] T2. Mapear os arquivos reais no `plan.md`
- [ ] T3. Configurar os `DISCORD_ALLOWED_CHANNEL_IDS` do servidor real
- [ ] T4. Confirmar que `TenantContextService` e `TenantRegistryService` promovem o onboarding corretamente
- [ ] T5. Confirmar que `DiscordGateway` bloqueia qualquer canal fora da allowlist
- [ ] T6. Cobrir regressao em readiness/diagnostics
- [ ] T7. Validar `npm run build` e `npm run ops:access`
- [ ] T8. Liberar um canal piloto antes de abrir mais canais
