# Known Issues — Experiência de Produto (Fase 21N)

**Fase:** 21N — Product Experience Polish & Surface Unification
**Data:** 2026-06-15
**Status:** Documentado para acompanhamento

---

## Sobre este documento

Este arquivo registra os issues conhecidos de experiência de produto identificados durante a auditoria da Fase 21N. Cada item inclui severidade, descrição, impacto ao tester e status atual.

**Severidade:**
- 🔴 **P1** — Bloqueante ou visualmente disruptivo; deve ser resolvido antes de qualquer entrega pública
- 🟡 **P2** — Impacto moderado; pode ser resolvido em iteração subsequente
- ⚪ **P3** — Cosmético ou de nicho; pode aguardar versão futura

---

## Issues Abertos

### [KI-21N-001] — Tela inicial pode parecer vazia sem workspace configurado

**Severidade:** 🔴 P1
**Superfície:** Desktop / CockpitDashboard
**Descrição:**
Ao abrir o Zavorth sem nenhum workspace configurado ou sem chaves de provider ativas, a tela inicial do cockpit pode exibir painéis em branco sem orientação clara de próximos passos.

**Impacto ao tester:**
O tester pode ficar confuso sobre como iniciar o uso do sistema.

**Status:** Mitigado com `CockpitDashboard.tsx` — exibição de guia de primeiro uso ativo se nenhum workspace confiado for detectado. Monitorar se o card aparece corretamente em todos os cenários de cold start.

---

### [KI-21N-002] — Mensagens de erro de CLI podem exibir caminhos internos em builds de desenvolvimento

**Severidade:** 🟡 P2
**Superfície:** CLI
**Descrição:**
Em builds de desenvolvimento local (não compilados), erros internos de module resolution do Node.js podem vazar caminhos absolutos da máquina do desenvolvedor nos stack traces exibidos na CLI.

**Impacto ao tester:**
Não afeta a build de produção. Em dev, pode confundir um tester que rodar diretamente via `ts-node` ou `tsx`.

**Status:** `ErrorNormalizationService` sanitiza mensagens de erro de saída da API/Zavorth. Stack traces nativos de Node.js não passam pelo normalizador; são expostos somente em modo dev. Recomenda-se usar sempre a build compilada (`dist/`) para testes internos.

---

### [KI-21N-003] — Labels de readiness no WorkspaceRuntimeReadinessCard estão em inglês

**Severidade:** 🟡 P2
**Superfície:** Desktop / WorkspaceRuntimeReadinessCard
**Descrição:**
Os campos de status do card de prontidão (`trustedWorkspace`, `providerReady`, `defaultModelSet`) estão rótulados em inglês técnico, sem tradução ou tooltip em português.

**Impacto ao tester:**
Testers não-técnicos podem não entender o significado de cada flag sem documentação adicional.

**Status:** Auditado. Os valores de status (✅/⚠️/❌) são universais. Labels em inglês mantidos por coerência interna; aguarda sprint de i18n dedicado.

---

### [KI-21N-004] — Nenhuma animação de loading visível no WorkspaceView durante fetch inicial

**Severidade:** ⚪ P3
**Superfície:** Desktop / DesktopWorkspaceView
**Descrição:**
Durante o carregamento inicial do workspace e fetch de status de providers, a UI pode apresentar um flash de conteúdo vazio antes de renderizar o estado real.

**Impacto ao tester:**
Perceptível apenas em máquinas lentas ou ao abrir o app pela primeira vez sem cache de DB local.

**Status:** Sem correção na 21N. O `CockpitDashboard` foi adicionado como fallback visual, mas o skeleton/spinner de carregamento ainda não está implementado. Agendar para ciclo pós-beta.

---

### [KI-21N-005] — CLI `status` pode omitir o nome do provider padrão se não configurado

**Severidade:** 🟡 P2
**Superfície:** CLI / comando `status`
**Descrição:**
Se nenhum provider estiver configurado, o comando `zavorth status` pode exibir `provider: —` sem orientação sobre como resolver.

**Impacto ao tester:**
Tester pode não saber que precisa executar `zavorth setup providers` para configurar um provider.

**Status:** Parcialmente mitigado pelo help inline do comando `setup`. Mensagem de status será aprimorada em ciclo pós-beta com call-to-action explicativo.

---

### [KI-21N-006] — InternalBetaDiagnosticsPanel não filtra erros de DB em foreign key violations

**Severidade:** 🟡 P2
**Superfície:** Desktop / InternalBetaDiagnosticsPanel
**Descrição:**
Em cenários de DB corrompido ou com schema desatualizado, o painel de diagnósticos pode exibir erros crus do SQLite como `FOREIGN KEY constraint failed`.

**Impacto ao tester:**
Erros técnicos de banco de dados seriam visíveis ao tester, causando confusão.

**Status:** `ErrorNormalizationService` captura mensagens de SQLite e as redireciona para o código `database_error`. Porém, o painel de diagnósticos usa formatação local independente. Normalização aplicada apenas no canal HTTP/API. Verificar se o painel usa o normalizador em sua próxima revisão.

---

## Issues Resolvidos na 21N

| ID | Descrição | Resolução |
| :--- | :--- | :--- |
| KI-21N-R01 | Referências a sistemas externos na documentação interna | Removidas em toda a pasta `docs/` e `docs/beta/` |
| KI-21N-R02 | Falta de aviso de risco em HPM/PTY na UI | Adicionado `ActionHint` com textos claros em pt-BR |
| KI-21N-R03 | API key exibida em texto claro no modal de setup | Campo com `type="password"` e nota de criptografia AES-256-GCM |
| KI-21N-R04 | Outputs de CLI com valores não inicializados ou representações internas de objeto | Verificado e resolvido via `ZavorthCliExperiencePolish.test.ts` |
| KI-21N-R05 | Tela inicial sem painel de cockpit integrado | `CockpitDashboard.tsx` criado e integrado ao `DesktopWorkspaceView` |
