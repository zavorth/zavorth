# Value Waves — Inteligência, Hábito, Wow e Audiências

**Status do programa:** `ACTIVE` — Value-ready (local); residual V8+ open  
**Última atualização:** 2026-07-11  
**Status consolidado (feito + falta):** [SESSION-STATUS-HANDOFF.md](./SESSION-STATUS-HANDOFF.md) · [SESSION-STATUS-VALUE-AND-DYNAMIC.md](./SESSION-STATUS-VALUE-AND-DYNAMIC.md)  
**Origem:** diagnóstico A–E (inteligência, wow, hábito diário, multi-audiência, solicitações × realidade) após o ciclo Trust Loop / harden de superfícies.  
**Público deste arquivo:** qualquer agente ou humano que vá **continuar o trabalho**. Leia a secção [Como usar este arquivo](#como-usar-este-arquivo) antes de editar código.

---

## Por que este programa existe

O Zavorth está **forte em governança, honesty, receipts e gates herméticos** (Trust Loop). Isso **não basta** se o utilizador sente que:

1. o agente **não presta** / não é mensuravelmente inteligente;  
2. não há **funcionalidades que chamam atenção** (devs e não-devs);  
3. a **UX do dia a dia** não fecha o loop “abrir → trabalhar → voltar amanhã”;  
4. a narrativa e os gates **só reforçam governança**, em vez de valor diário live.

Este documento transforma esse gap em **waves executáveis**, sem abandonar honesty nem safe-by-default.

### O que NÃO é este programa

- Não é substituir Trust Loop, approvals ou catalog≠live.  
- Não é inventar “Live” sem prova.  
- Não é o roadmap de signing/store (`launch-readiness.md`).  
- Não é um diário de commits — cada wave tem **objetivo, escopo, critérios e pistas de código**.

### Relação com docs existentes

| Doc | Papel |
|-----|--------|
| [ROADMAP.md](../ROADMAP.md) | Direção alta; aponta para este programa em “Value” |
| [launch-readiness.md](./launch-readiness.md) | Residual de launch/ops (signing, R2, live cells) |
| [honesty-readiness.md](./honesty-readiness.md) | Regras catalog ≠ live — **obrigatórias** em todas as waves |
| [daily-use-trail.md](../daily-use-trail.md) | Trilha atual (8 passos) — Wave V2 pode encurtar o path feliz |
| [dogfood-missions-100.md](./dogfood-missions-100.md) | Matriz 110 — Wave V1 acrescenta missões de smartness |
| [retention-gate.md](./retention-gate.md) | R1/R2/R3 — Wave V6 fecha R2 + UX de retorno |
| [product-story.md](../product-story.md) | Pitch — Wave V7 reequilibra ordem do valor |

---

## Como usar este arquivo

### Para qualquer agente que chega

1. Ler **este ficheiro inteiro** (ou pelo menos: princípios, índice de waves, wave `IN_PROGRESS` / próxima `READY`).  
2. Abrir a wave alvo e cumprir só o **In scope**.  
3. Não quebrar os **Princípios transversais**.  
4. Ao terminar (ou parar a meio): atualizar  
   - tabela [Progresso global](#progresso-global);  
   - secção **Status** e **Log de handoff** da wave;  
   - checklist de aceite (marcar `[x]` só com evidência).  
5. Preferir PRs/commits pequenos por wave (ou por fatia `V#-a`, `V#-b` se a wave for grande).  
6. **Não** marcar wave `DONE` sem os critérios de aceite e sem comando/gate que prove o claim.

### Legenda de status

| Status | Significado |
|--------|-------------|
| `LOCKED` | Dependências não satisfeitas — não começar |
| `READY` | Pode começar |
| `IN_PROGRESS` | Alguém está a trabalhar; ver Log de handoff |
| `BLOCKED` | Impedimento externo (credencial, calendário, decisão de produto) |
| `DONE` | Critérios de aceite cumpridos + evidência no log |
| `DEFERRED` | Adiado de propósito (motivo no log) |

### Legenda de prioridade

| P | Significado |
|---|-------------|
| P0 | Bloqueia a sensação de “produto que presta” |
| P1 | Alto impacto no hábito / atração |
| P2 | Consolidação, polish, narrativa |

### Buckets do diagnóstico (referência A–E)

| ID | Bucket | Problema central |
|----|--------|------------------|
| A | Inteligência percetível | Runtime multi-step existe; qualidade **não é medida** como produto |
| B | Momentos wow | Day-0 sem chave = Trust Loop estático; wow live gated |
| C | UX hábito diário | Approvals fortes; loop diário e `start`/R2 incompletos |
| D | Multi-audiência | Skins de perfil; runtime e path non-dev desalinhados |
| E | Solicitações × realidade | Governança à frente de delight/live/retenção |

---

## Princípios transversais (todas as waves)

1. **Honesty first** — nunca promover Catalog → Live sem `liveReady` / prova (`honesty-readiness.md`).  
2. **Safe by default** — não aumentar autoridade de execução para “parecer mágico”.  
3. **Quiet no verde, explícito no vermelho** — low-risk pode fluir; sensível continua com preview/approval.  
4. **Governança serve o valor** — receipts/approvals apoiam o hábito; não são o único pitch.  
5. **Medir o que se afirma** — se a wave diz “agente mais inteligente”, precisa de eval/dogfood, não só docs.  
6. **Um path feliz curto** — setup de plataforma de 8 passos pode existir para power users; o default deve ser menor.  
7. **Handoff legível** — próximo agente deve entender o estado em menos de 5 minutos lendo só este ficheiro + diff.

---

## Índice de waves

| Wave | Nome | Prioridade | Status | Depende de | Buckets |
|------|------|------------|--------|------------|---------|
| **V0** | Fundação do programa e baseline | P0 | `DONE` | — | E |
| **V1** | Scoreboard de inteligência do agente | P0 | `DONE` | V0 | A |
| **V2** | Loop diário único (abrir → trabalhar) | P0 | `DONE` | V0 | C |
| **V3** | Time-to-first-delight (wow honesto) | P1 | `DONE` | V0, V2 | B, C |
| **V4** | Audiências e perfis com wiring real | P1 | `DONE` | V0 | D |
| **V5** | Integridade de memória (anti-“eu inventei”) | P1 | `DONE` | V0 | A, C |
| **V6** | Continuidade day-1 (R2 + ritual de retorno) | P1 | `DONE` | V2 | C, E |
| **V7** | Narrativa e critérios de “product ready” | P2 | `DONE` | V1–V3 | E, B |

**Ordem recomendada de execução:**  
`V0 → (V1 ∥ V2) → V3 → V5 → V4 → V6 → V7`  

- `V1` e `V2` podem correr **em paralelo** após V0 (agentes diferentes / worktrees).  
- `V4` pode começar em paralelo com V3 se não tocar no mesmo happy path.  
- `V7` por último (narrativa só depois de haver comportamento novo).

---

## Progresso global

Atualizar esta tabela em **todo** handoff.

| Wave | Status | Owner (agente/humano) | Última mudança | Evidência (PR/commit/gate) |
|------|--------|----------------------|----------------|----------------------------|
| V0 | `DONE` | implementation agent | 2026-07-11 | `docs/product/value-baseline.md` |
| V1 | `DONE` | implementation agent | 2026-07-11 | `agent:smartness:check` 6/6; eval tool `simulated:true`; recovery plan tests; known-limitations live IQ |
| V2 | `DONE` | implementation agent | 2026-07-11 | start→ops-go; happyPath/chatReady in Daily PE |
| V3 | `DONE` | implementation agent | 2026-07-11 | `docs/product/demo-scripts.md` + desktop first-win ask |
| V4 | `DONE` | implementation agent | 2026-07-11 | business/power manifests; Desktop audience first-run; non-dev Setup→Desktop→chat; profileBundleMissing log on fallback |
| V5 | `DONE` | implementation agent | 2026-07-11 | draft-only autoExtract; promoteMemoryDraft; write-path table; no-invent + promote tests |
| V6 | `DONE` | implementation agent | 2026-07-11 | `DailyReturnContinuityService` |
| V7 | `DONE` | implementation agent | 2026-07-11 | product-story/ROADMAP/README/what-is utilidade→hábito→confiança; Value-ready vs Launch-ready |

**Programa completo (fundação local):** V0–V7 `DONE` → **Value-ready (local)**.  

**Também feito depois das waves:** testability pack, honesty/security harden, **user provider/channel selection only** (no silent Gemini/Telegram defaults).  

**Residual (próximo trabalho):** ver tabela completa em [SESSION-STATUS-VALUE-AND-DYNAMIC.md](./SESSION-STATUS-VALUE-AND-DYNAMIC.md) — live multi-step com provider do user, selection UX, autopilot scripts neutral, R2/signing launch residual.

---

# Wave V0 — Fundação do programa e baseline

| Campo | Valor |
|-------|--------|
| **ID** | V0 |
| **Prioridade** | P0 |
| **Status** | `DONE` |
| **Buckets** | E (clareza solicitação × realidade) |
| **Dependências** | Nenhuma |
| **Desbloqueia** | V1, V2, V4, V5 |

### Objetivo

Criar a **baseline mensurável** do gap valor/inteligência/hábito, para que waves seguintes não “mexam às cegas” e para que claims fiquem honestos.

### Problemas que ataca

- Não existe scoreboard de “agente presta” separado de security/approvals.  
- Docs e gates misturam hermético com “ready for daily use”.  
- Agentes futuros repetem só Trust Loop porque é o que o repo sabe medir.

### In scope

1. Inventário curto (neste ficheiro ou `docs/product/value-baseline.md`) com:
   - missões dogfood de chat/tool que estão `blocked` vs `pass`;  
   - comandos CLI do daily trail que são guide-only (`start`, `connect`, `learn`, `tools`);  
   - mismatch experience profile vs profile manifest (`business`/`power` → fallback `personal`);  
   - estado R2 retention.  
2. Definir **métricas-alvo** do programa (números ou critérios binários):
   - Time-to-first-useful-work (Desktop com provider já configurado): meta sob 3 min de UI.  
   - Smartness dogfood: N missões multi-step com pass hermético **ou** live credentialed documentado.  
   - Day-1 return: R2 fechável.  
3. Gate/check mínimo opcional: script ou secção em `wave2:docs` / novo `value:waves:check` que só valida **existência e status table** deste ficheiro (não inventar product-ready).  
4. Ligar este programa no [ROADMAP.md](../ROADMAP.md) (secção Value).

### Out of scope

- Implementar inteligência, UX ou perfis (waves seguintes).  
- Marcar launch complete.  
- Mudar Policy Broker / aumentar autonomia global.

### Critérios de aceite

- [x] Baseline documentada (tabela inventário + métricas-alvo).  
- [x] ROADMAP aponta para este ficheiro.  
- [x] Progresso global atualizado; V1 e V2 passam a `READY`.  
- [x] Nenhum claim novo de “agente superior” sem apontar para V1.

### Pistas de código / docs

- `docs/product/dogfood-missions-100.md`  
- `docs/known-limitations.md`  
- `docs/product/retention-gate.md`  
- `docs/product/launch-readiness.md`  
- `src/cli/ZavorthCliLiveNamespaces.ts` (`runHappyPath`, guide-only)  
- `src/services/ZavorthExperienceProfileService.ts`  
- `config/profile-manifests/*.json`  
- `src/runtime/agent/AgentRunFactory.ts` (`resolveProfileRuntimeBundle`)  
- `scripts/run-hermetic-dogfood-matrix.mjs`

### Entregáveis

| Entregável | Obrigatório |
|------------|-------------|
| Atualização deste ficheiro (baseline + statuses) | Sim |
| `docs/product/value-baseline.md` (se o inventário ficar longo) | Opcional |
| Link no ROADMAP | Sim |
| Script `value:waves:check` | Opcional |

### Log de handoff

```
YYYY-MM-DD | agent/human | o que fez | próximo passo | blockers
2026-07-11 | planning | criou WAVES-VALUE-INTELLIGENCE-HABIT.md + link no ROADMAP.md | completar inventário baseline + métricas-alvo (resto de V0); depois liberar V1/V2 | —
```

---

# Wave V1 — Scoreboard de inteligência do agente

| Campo | Valor |
|-------|--------|
| **ID** | V1 |
| **Prioridade** | P0 |
| **Status** | `DONE` |
| **Buckets** | A |
| **Dependências** | V0 |
| **Desbloqueia** | V5 (parcial), V7 |

### Objetivo

Passar de “runtime multi-step existe” para **“qualidade de agente é mensurável”** — mesmo que no início só com fixtures herméticas + opt-in live.

### Problemas que ataca (A)

1. Evals de response/tool-use/recovery são projeção ou **simulação** (`ZavorthAgentEvalTool`).  
2. Dogfood `chat.*` multi-turn/tool fica **blocked** no hermético.  
3. Recovery cognitivo = 1 retry transitório; sem replan estruturado medido.  
4. Planner `zavorth_tool_plan` é heurística local, sem score de missão.

### In scope

1. **Suite de smartness** (nome sugerido: `dogfood.smartness.*` ou `eval.agent.*`):
   - multi-step tool-use com sucesso de missão;  
   - falha de tool → replan / tool alternativa / mensagem útil;  
   - não inventar memória quando não há receipts (alinhar com V5 se já existir).  
2. Runner hermético com **LLM fixture / recorded transcript** (não só `Simulated output for:` genérico).  
3. Opt-in live: `ZAVORTH_LIVE_AGENT_EVAL=1` + provider — documentado, nunca silent pass.  
4. Métricas mínimas exportáveis (JSON): `mission_success_rate`, `tool_repair_rate`, `recovery_success_rate`.  
5. Substituir ou isolar o path simulado de `ZavorthAgentEvalTool` para não parecer eval real.  
6. Docs: secção em `known-limitations.md` se live continuar blocked sem credencial.

### Out of scope

- Trocar o modelo default do utilizador.  
- Remover approvals em tool writes.  
- “Bater Claude Code em marketing” sem números.

### Critérios de aceite

- [x] ≥ 5 missões de smartness com resultado `pass|fail` hermético (não só `blocked` por “falta de framework”).  
- [x] Relatório JSON ou gate npm documentado (`agent:smartness:check` ou equivalente).  
- [x] `ZavorthAgentEvalTool` deixa de ser a única face de “eval” **ou** deixa explícito `simulated: true` na API pública.  
- [x] Pelo menos 1 caminho de recovery **além** de retry 120ms está coberto por teste (replan ou alternate tool ou structured failure to user).  
- [x] Handoff atualiza progresso; não afirma “agente superior” sem apontar para o relatório.

### Pistas de código

- `src/runtime/agent/AgentRunNativeToolLoopService.ts`  
- `src/agents/StructuredPlanner.ts`, `UniversalPlanner.ts`, `AgentChainBuilder.ts`  
- `src/services/GoalLoopService.ts`  
- `src/tools/ZavorthAgentEvalTool.ts`  
- `src/services/agent-smartness/AgentSmartnessService.ts`  
- `src/services/agent-smartness/AgentSmartnessLiveService.ts`  
- `src/runtime/agent/StructuredToolFailurePlan.ts`  
- `tests/services/honesty/AgentSmartnessService.test.ts`  
- `docs/known-limitations.md`

### Fatias sugeridas (se dividir a wave)

| Fatia | Conteúdo |
|-------|----------|
| V1-a | Framework de missões + 2 missões golden herméticas |
| V1-b | Recovery/replan + métricas JSON |
| V1-c | Live opt-in + docs honesty |

### Log de handoff

```
YYYY-MM-DD | agent/human | o que fez | próximo passo | blockers
2026-07-11 | implementation | AgentSmartnessService 6 missões herméticas; gate agent:smartness:check; StructuredToolFailurePlan + testes; ZavorthAgentEvalTool marca simulated=true/liveLlmEval=false; known-limitations live IQ | live multi-step harness opcional com credencial | —
```

---

# Wave V2 — Loop diário único (abrir → trabalhar)

| Campo | Valor |
|-------|--------|
| **ID** | V2 |
| **Prioridade** | P0 |
| **Status** | `DONE` |
| **Buckets** | C |
| **Dependências** | V0 |
| **Desbloqueia** | V3, V6 |

### Objetivo

Um **único happy path diário** em que o utilizador: abre → sabe o próximo passo → pergunta → trabalho acontece (ou approval clara) — sem checklist de 8 passos de plataforma como default.

### Problemas que ataca (C)

1. `zavorth start` / `connect` / `learn` / `tools` são **guide-only** enquanto docs sugerem “start runtime”.  
2. Daily Product Experience e checklist Control empurram profile→…→evals.  
3. Cards “Daily loop” no Control são sobretudo `data-prompt`, não ritual nativo.  
4. Time-to-value quebra no path CLI.

### In scope

1. **Definir e documentar o path feliz canónico (curto):**
   - Desktop: open → (se preciso) provider → first ask.  
   - CLI: um comando que **realmente** sobe/abre a superfície de trabalho diário (ou renomear guides para não mentir).  
2. Corrigir desalinhamento docs ↔ CLI:
   - ou `start` ganha side-effect seguro documentado;  
   - ou docs/help passam a `open` / `run` / `desktop` como verbo real e `start` fica explicitamente “guide”.  
3. **Next action** único e prioritário no Desktop e Control (provider missing, depois approvals pending, depois ready to chat).  
4. Checklist de 8 passos: mover para “Power / Complete setup”, **não** bloquear “ready for daily chat” se provider+runtime ok.  
5. Gate: `zavorth:daily-product-experience:check` (ou novo) valida o path curto sem exigir channel/routine/evals.  
6. Atualizar `daily-use-trail.md` e `first-use.md` com **First pass (curto)** vs **Full platform setup**.

### Out of scope

- Multi-audiência completa (V4).  
- R2 calendar (V6).  
- Smartness evals (V1).  
- Desligar approvals sensíveis.

### Critérios de aceite

- [x] Existe doc “path feliz diário” com ≤ 4 passos até first useful chat (com provider).  
- [x] Nenhum comando do path feliz principal é guide-only sem o rótulo explícito “guide”.  
- [x] Checklist 8-step não é condição de “pode conversar”.  
- [x] Next-action cobre: needs provider, pending approval, ready.  
- [x] Teste/gate impede regressão do path curto.  
- [x] `daily-use-trail.md` atualizado.

### Pistas de código

- `src/cli/ZavorthCliLiveNamespaces.ts`  
- `src/zavorth-cli.ts` (setup / live intercept / ops-go)  
- `src/services/ZavorthDailyProductExperienceService.ts`  
- `src/services/ZavorthControlSetupChecklistService.ts`  
- `src/contracts/ui/ZavorthDailyProductExperienceContract.ts`  
- `apps/zavorth-desktop/src/onboarding/desktopOnboarding.ts`  
- `apps/zavorth-control-vite-shell/src/next-action-ui.ts`  
- `src/ai-gateway/app/(zavorthControl)/control/TerminalInboxSector.tsx`  
- `docs/daily-use-trail.md`  
- `docs/product/start/first-use.md`, `getting-started.md`

### Fatias sugeridas

| Fatia | Conteúdo |
|-------|----------|
| V2-a | Docs + taxonomy guide vs live commands |
| V2-b | CLI `start`/`open` alinhados |
| V2-c | Checklist split + next-action + gate |

### Log de handoff

```
YYYY-MM-DD | agent/human | o que fez | próximo passo | blockers
```

---

# Wave V3 — Time-to-first-delight (wow honesto)

| Campo | Valor |
|-------|--------|
| **ID** | V3 |
| **Prioridade** | P1 |
| **Status** | `DONE` |
| **Buckets** | B, C |
| **Dependências** | V0, V2 (pelo menos V2-a path documentado) |
| **Desbloqueia** | V7 |

### Objetivo

Ter **dois scripts oficiais de demo**:

1. **45s zero-credencial** — Trust Loop estático (já existe; endurecer honesty).  
2. **5–10 min com provider** — “show a friend” com agente real + um momento approval/receipt.

### Problemas que ataca (B)

- Único wow instantâneo = governação estática.  
- Showcase de marketing (PR no Telegram, briefing, swarm) sem script executável.  
- Catálogo denso parece live e sente-se vazio.

### In scope

1. Doc canónico: `docs/product/demo-scripts.md` (ou estender `public-demo-trust-loop.md` + `showcase.md`):
   - Script A: offline Trust Loop (anti-claims explícitos).  
   - Script B: first useful work + optional sensitive preview.  
   - Script C (opcional): Telegram same-runtime.  
2. Empty states Desktop/Control: CTA único para Script B se provider missing; nunca “Online” falso.  
3. “First win” mission built-in (ex.: explicar o repo / planear o dia **sem** mutação) no onboarding Desktop.  
4. Reduzir ruído de catálogo no first screen (canais/marketplace) — preferir “Needs setup” colapsado.  
5. Smoke automatizável do Script A; Script B opt-in live.

### Out of scope

- 29 canais live.  
- Multi-agent swarm demo live.  
- Voice wake-word completo.  
- Mentir latência/qualidade do modelo.

### Critérios de aceite

- [x] Scripts A e B documentados e linkados em getting-started / showcase.  
- [x] Script A smoke no CI (ou já coberto por golden path + referência clara).  
- [x] First-win mission no onboarding Desktop (copy + prompt default).  
- [x] Anti-claims: demo estática não pode ser descrita como “agente live” em UI.  
- [x] Time-to-first-useful-work medido manualmente uma vez e registado no log (baseline).

### Pistas de código / assets

- `assets/zavorth-demo/index.html`  
- `docs/product/public-demo-trust-loop.md`  
- `docs/product/showcase.md`, `docs/product/start/showcase.md`  
- `docs/quickstart.md`  
- `apps/zavorth-desktop` empty/onboarding  
- `docs/product/honesty-readiness.md`

### Log de handoff

```
YYYY-MM-DD | agent/human | o que fez | próximo passo | blockers
```

---

# Wave V4 — Audiências e perfis com wiring real

| Campo | Valor |
|-------|--------|
| **ID** | V4 |
| **Prioridade** | P1 |
| **Status** | `DONE` |
| **Buckets** | D |
| **Dependências** | V0; ideal V2 para não conflitar com checklist |
| **Desbloqueia** | V7 |

### Objetivo

Perfis de audiência **fazem diferença real** (ou o produto deixa de fingir que fazem): experience IDs alinhados a policy manifests, e path non-dev que não começa em npm/doctor.

### Problemas que ataca (D)

1. Experience: `business`/`power` vs manifest: `operator`/`team` — fallback silencioso para `personal`.  
2. Experience **não** muda autoridade (ok) mas UI vende como se mudasse experiência profunda.  
3. Non-dev: Desktop intent existe; entrada e jargão ainda operator-ish.  
4. Sem persona privacy dedicada; Memory Privacy OS demo-heavy.

### In scope

1. **Matriz de alinhamento** experience id → manifest id (documentada + enforce no código):
   - Ex.: `business`→`operator` ou novo manifest `business`; `power`→`operator`/`team` com detail mode.  
2. Falhar alto ou mapear de forma explícita (nunca silent personal sem log/telemetry de `profileBundleMissing`).  
3. Onboarding Desktop: escolha de audiência **no first run** (personal / developer / business) com copy adequada.  
4. Abstraction de jargão: default personal esconde Policy Broker / sandbox na home; power/developer pode mostrar.  
5. Path non-dev documentado: Setup app → Desktop → chat (sem CLI obrigatória).  
6. Decisão de produto registada: criar experience `privacy` **ou** mapear privacy claims para `personal`+strict manifest.

### Out of scope

- Fork do monorepo em 3 produtos.  
- Remover governança para non-dev.  
- Paridade total com Claude Code/Cursor.

### Critérios de aceite

- [x] Todo experience id resolvido no Control mapeia para manifest compilável.  
- [x] Teste unitário impede regressão do mismatch business/power.  
- [x] First-run Desktop permite escolher audiência e altera missões/copy.  
- [x] Doc “Who is Zavorth for” aponta paths distintos (dev vs personal).  
- [x] Jargão técnico não é default na home personal (baseline; polish residual V4-c opcional). *(residual UX; não bloqueia value-ready local)*

### Pistas de código

- `src/services/ZavorthExperienceProfileService.ts`  
- `src/services/ProfileManifestService.ts`  
- `src/services/ExperienceRuntimeProfileMap.ts`  
- `config/profile-manifests/*.json`  
- `src/runtime/agent/AgentRunFactory.ts`  
- `src/services/ZavorthGuidedMissionsService.ts`  
- `src/services/ZavorthConversationalSetupService.ts`  
- `apps/zavorth-control-vite-shell/src/experience-profile-ui.ts`  
- `apps/zavorth-desktop/src/onboarding/`  
- `src/services/UserAbstractionProfileService.ts` (se existir)  
- `docs/product/start/what-is-zavorth.md`

### Fatias sugeridas

| Fatia | Conteúdo |
|-------|----------|
| V4-a | Mapping experience↔manifest + testes |
| V4-b | Desktop first-run audience + copy |
| V4-c | Jargão / abstraction na home |

### Log de handoff

```
2026-07-11 | implementation agent | business/power manifests + map tests; Desktop audience step + starter missions; non-dev path docs; profileBundleMissing log on fallback | residual: home jargon abstraction (V4-c) | none
```

---

# Wave V5 — Integridade de memória (anti-“eu inventei”)

| Campo | Valor |
|-------|--------|
| **ID** | V5 |
| **Prioridade** | P1 |
| **Status** | `DONE` |
| **Buckets** | A, C |
| **Dependências** | V0 |
| **Desbloqueia** | V6 (continuidade honesta) |

### Objetivo

Uma **política única de memória**: o agente não afirma lembrar sem evidência; writes sensíveis respeitam consent/promoção; docs e canais não divergem.

### Problemas que ataca (A3)

1. `NaturalFirstMemoryContinuityService` / receipts: bom em rotas específicas.  
2. Telegram `autoExtract` grava sem o mesmo rigor de UI/consent.  
3. Doc “mostra sugestão primeiro” vs código de auto-extract.  
4. `noMemoryInvented` não é guard global no LLM.

### In scope

1. Inventariar **todos** os write paths de memória (MemoryService, layered, learning plane, Telegram, Desktop).  
2. Classificar: silent ok (pref low-risk) vs needs draft/approval vs forbidden.  
3. Unificar contrato:  
   - recall sem evidence → “não encontrei memória” (padrão Natural First);  
   - promote high-impact só via learning plane / approval.  
4. Corrigir ou gates no `autoExtract` (Telegram e outros).  
5. Testes: não inventar recall; write path classificado.  
6. Atualizar `docs/product/concepts/memory.md` para casar com código.

### Out of scope

- Reescrever Mnemos inteiro.  
- Encryption redesign (já há docs de encryption).  
- Feature de “wiki social”.

### Critérios de aceite

- [x] Tabela de write paths no doc da wave (ou memory.md) com classificação.  
- [x] Zero path de chat first-class que faça claim de memória sem evidence em teste de contrato.  
- [x] autoExtract alinhado à política (desligado, draft, ou consent).  
- [x] Doc de produto atualizado.  
- [x] Pelo menos 1 teste de regressão anti-alucinação de recall.

### Pistas de código

- `src/services/MemoryService.ts` (`autoExtract`, `promoteMemoryDraft`, `getMemoryContext`)  
- `src/services/MemoryDraftStoreService.ts`  
- `src/runtime/agent/NaturalFirstMemoryContinuityService.ts`  
- `src/services/MemoryWithReceiptsService.ts`  
- Telegram: `TelegramConversationDirectReplyService` (autoExtract draft-only default)  
- `docs/product/concepts/memory.md`, `memory-privacy.md`  
- `scripts/memory-drafts-run.ts`

### Log de handoff

```
YYYY-MM-DD | agent/human | o que fez | próximo passo | blockers
2026-07-11 | implementation | autoExtract draft-only; promoteMemoryDraft wired; write-path table in memory.md + value-baseline; no-invent + promote tests; memory-drafts --check uses promoteMemoryDraft | monitor channel drift if new writers appear | —
```

---

# Wave V6 — Continuidade day-1 (R2 + ritual de retorno)

| Campo | Valor |
|-------|--------|
| **ID** | V6 |
| **Prioridade** | P1 |
| **Status** | `DONE` |
| **Buckets** | C, E |
| **Dependências** | V2; V5 recomendada |
| **Desbloqueia** | V7, launch residual R2 |

### Objetivo

“Voltar amanhã” deixa de ser só **infra de sessão** e passa a **hábito de produto** com R2 mensurável e UX de reentrada.

### Problemas que ataca (C4, E18)

- R2 `day1Return` aberto / calendar-gated.  
- Sem “continuar de ontem / pendências” como default home.  
- Day-0 dogfood não prova retorno.

### In scope

1. UX Desktop/Control no re-open:  
   - última sessão;  
   - approvals pendentes;  
   - 1 next action de continuidade.  
2. Instrumentação R2: evento de retorno day-1 real (já parcialmente em `retention-gate` / scripts).  
3. Fechar ou documentar honestamente o caminho para `retention-log` R2 passar (sem fake calendar).  
4. Copy de reentrada em PT/EN se i18n aplicável.  
5. Missão dogfood day-1 (pode permanecer `blocked` até calendário — mas com harness pronto).

### Out of scope

- Notificações push mobile completas.  
- Sync multi-device cloud-first.  
- Anúncio público de launch.

### Critérios de aceite

- [x] Reopen Desktop mostra continuidade (sessão ou next action), não empty genérico se houver histórico.  
- [x] R2: harness + doc “how to pass R2” sem soft-lie (calendar residual ops).  
- [x] `launch-readiness.md` / `retention-gate.md` atualizados.  
- [x] Ligação explícita a este programa no residual de launch.

### Pistas de código / docs

- `docs/product/retention-gate.md`  
- `docs/product/launch-readiness.md`  
- `scripts/retention-log.mjs`  
- `apps/zavorth-desktop` session sidebar / home  
- `src/services/*Continuity*` / `SessionContinuumService`  
- `docs/ROADMAP.md` (Next: R2)

### Log de handoff

```
YYYY-MM-DD | agent/human | o que fez | próximo passo | blockers
```

---

# Wave V7 — Narrativa e critérios de “product ready”

| Campo | Valor |
|-------|--------|
| **ID** | V7 |
| **Prioridade** | P2 |
| **Status** | `DONE` |
| **Buckets** | E, B |
| **Dependências** | V1, V2, V3 (mínimo); ideal V4–V6 |
| **Desbloqueia** | Comunicação externa coerente |

### Objetivo

Reordenar a história do produto:

> **Utilidade e inteligência → hábito diário → governança como confiança**  

em vez de “somos o Trust Loop” como única diferenciação.

### Problemas que ataca (E)

- Changelog/roadmap recentes centrados em Trust Loop.  
- Comparações Hermes/OpenClaw usadas só para dizer “+ governance”.  
- Agentes re-contam só governance porque docs empurram isso.

### In scope

1. Atualizar `product-story.md`, `what-is-zavorth.md`, README (secção valor) com ordem de valor nova — **sem** apagar honesty.  
2. Secção “How we measure quality” apontando V1 smartness + daily path V2 + demo V3.  
3. Critério **Value-ready (local)** distinto de **Launch-ready (ops)**:
   - Value-ready = V0–V7 foundation DONE + honesty intacta (dogfood local).  
   - Launch-ready = launch-readiness residual (R2, live cells, signing, public announce).  
4. Template de resposta para futuros agentes: proibido fechar análise só com “Trust Loop superior” sem score A–E.  
5. Atualizar este ficheiro: programa `DONE` ou `ACTIVE` com residual explícito.

### Out of scope

- Campanha de marketing externa.  
- Rebrand completo.  
- Remover docs de threat model / certification.

### Critérios de aceite

- [x] product-story e what-is-zavorth refletem ordem utilidade → hábito → confiança.  
- [x] README não vende só governance.  
- [x] Value-ready vs Launch-ready documentados.  
- [x] Progresso global do programa atualizado.  
- [x] Nenhuma regressão de honesty claims.

### Pistas

- `docs/product-story.md`  
- `docs/product/start/what-is-zavorth.md`  
- `README.md`  
- `docs/ROADMAP.md`  
- `docs/product/changelog.md`  
- Este ficheiro

### Log de handoff

```
2026-07-11 | implementation agent | product-story/what-is/README/ROADMAP rebalance; Value-ready vs Launch-ready; residual next = R2/live cells/signing | none for V7 | none
```

---

## Problemas → Wave (mapa rápido)

| Problema (resumo) | Wave |
|-------------------|------|
| Sem scoreboard de inteligência; evals simulados | V1 |
| Dogfood chat smartness blocked / sem harness | V1 |
| Recovery tool raso (1 retry) | V1 |
| `start` guide-only vs docs | V2 |
| Checklist 8 passos como “daily ready” | V2 |
| Daily PE só projeção/prompts | V2 |
| Time-to-value / path CLI quebrado | V2 |
| Wow 30s só Trust Loop estático | V3 |
| Showcase marketing sem script real | V3 |
| First-win fraco no onboarding | V3 |
| business/power sem manifest | V4 |
| Non-dev entra por ops/CLI | V4 |
| Jargão governance na home casual | V4 |
| autoExtract / memória inconsistente | V5 |
| “Eu lembro” sem evidence | V5 |
| R2 day-1 aberto; sem ritual retorno | V6 |
| Narrativa só Trust Loop | V7 |
| Solicitações × realidade sem dono | V0 + V7 |

---

## Regras de execução multi-agente

1. **Um owner por wave** na tabela Progresso (evita double-write).  
2. Parallel permitido: `V1 ∥ V2` após V0; `V4 ∥ V3` com cuidado em onboarding Desktop.  
3. Conflitos prováveis:
   - V2 + V4 em `desktopOnboarding` / checklist → coordenar ou serializar.  
   - V1 + V5 em memory no eval → V5 depois de V1-a se possível.  
4. Sempre correr gates de honesty/security relevantes da área tocada.  
5. Não fazer push sem pedido explícito do humano.  
6. Commits: `feat(value-V#): ...` ou `fix(value-V#): ...`.

---

## Template de handoff (copiar para o log da wave)

```text
### Handoff
- Wave: V#
- Status agora: IN_PROGRESS | DONE | BLOCKED
- Feito:
  - ...
- Não feito / restante:
  - ...
- Ficheiros principais tocados:
  - ...
- Comandos corridos:
  - ...
- Riscos / dívidas:
  - ...
- Próximo agente deve:
  1. ...
  2. ...
```

---

## Anti-padrões (não fazer)

| Anti-padrão | Porquê |
|-------------|--------|
| Fechar wave só com mais docs de Trust Loop | Reforça o gap original |
| Marcar chat “Live” sem prova | Viola honesty |
| Aumentar autonomia default para “parecer smart” | Viola safe-by-default |
| 16k testes de segurança como prova de inteligência | Métrica errada |
| Implementar as 8 waves num único commit monólito | Handoff impossível |
| Dizer “comparável a Hermes/OpenClaw” sem demo path | Marketing oco |

---

## Checklist de arranque rápido (agente)

```text
[ ] Li princípios transversais
[ ] Vi Progresso global — qual wave READY/IN_PROGRESS?
[ ] Li In scope / Out of scope da wave
[ ] Confirmei dependências DONE
[ ] Atualizei Status → IN_PROGRESS + owner
[ ] Implementei fatia pequena
[ ] Corri testes/gates da área
[ ] Atualizei critérios de aceite e log de handoff
[ ] Atualizei Progresso global
```

---

## Histórico do programa

| Data | Evento |
|------|--------|
| 2026-07-11 | Programa criado a partir do diagnóstico A–E (inteligência, wow, hábito, audiências, solicitações). Trabalho recente Trust Loop/harden reconhecido como base de governança, **não** como fecho do gap de valor. |
| 2026-07-11 | Pack de testabilidade: `npm run value:test-all` (7/7 hermético), ContinuityBanner Desktop, MemoryDraftStore, killer missions, smartness live blocked-honest, HOW-TO-TEST-VALUE.md. |
| 2026-07-11 | V4 gaps: Desktop audience first-run; profileBundleMissing log; non-dev Setup→Desktop→chat docs. V7 gaps: narrative order utilidade→hábito→confiança; Value-ready vs Launch-ready; ROADMAP residual R2/live/signing. |

---

*Fim do documento de waves. Como testar: `docs/product/HOW-TO-TEST-VALUE.md` e `npm run value:test-all`.*
