export function buildRuntimeShellHtmlPart3(): string {
  return `            <strong id="eval-control-plane-datasets-state">Sem leitura</strong>
            <p id="eval-control-plane-datasets-summary" class="muted-copy">
              Clusters de fluxo, replay/resume pressure, traces e baseline historica aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Coverage</p>
            <strong id="eval-control-plane-coverage-state">Sem leitura</strong>
            <p id="eval-control-plane-coverage-summary" class="muted-copy">
              Tasks, workflows, approvals, traces e sinks observaveis que alimentam este painel aparecem aqui.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="eval-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar evals</button>
          <button id="eval-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:evals">Copiar ops:evals</button>
        </div>
        <p id="eval-control-plane-status" class="muted-copy section-note">
          Valide o token para revisar scorecards, regressions, traces e baseline deste host.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Scorecards</p>
            <ul id="eval-control-plane-scorecards" class="handoff-list compact">
              <li>Valide o token para ver os principais fluxos e seus baselines.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Regressoes</p>
            <ul id="eval-control-plane-regressions" class="handoff-list compact">
              <li>Valide o token para ver os maiores gargalos desta janela.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Datasets, traces e tendencia</p>
            <ul id="eval-control-plane-datasets" class="handoff-list compact">
              <li>Valide o token para revisar datasets operacionais, traces, coverage e comparacoes.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="hub-control-plane-card" class="handoff-card">
        <p class="profile-tag">Track 5</p>
        <h2>Hub + MCP product plane</h2>
        <p class="muted-copy section-note">
          Esta leitura junta Integration Hub, plugin plane, platform plane, skill plane e MCP num cockpit unico para discovery, trust, sync e doctor.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Postura</p>
            <strong id="hub-control-plane-state">Valide o token</strong>
            <p id="hub-control-plane-summary" class="muted-copy">
              O consolidado do Hub + MCP aparece aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Integrations & plugins</p>
            <strong id="hub-control-plane-integrations-state">Sem leitura</strong>
            <p id="hub-control-plane-integrations-summary" class="muted-copy">
              Conectores, plugins trusted e itens configuraveis aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Platform & skills</p>
            <strong id="hub-control-plane-platform-state">Sem leitura</strong>
            <p id="hub-control-plane-platform-summary" class="muted-copy">
              Registry remoto, colecoes, recipes e skills prontas aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">MCP</p>
            <strong id="hub-control-plane-mcp-state">Sem leitura</strong>
            <p id="hub-control-plane-mcp-summary" class="muted-copy">
              Servidores MCP, tools, resources e doctor ficam consolidados aqui.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="hub-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar hub</button>
          <button id="hub-control-plane-sync-action" type="button" class="action-button secondary compact-action" hidden>Sincronizar registry</button>
          <button id="hub-control-plane-mcp-doctor-action" type="button" class="action-button secondary compact-action" hidden>Rodar doctor MCP</button>
          <button id="hub-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:hub">Copiar ops:hub</button>
        </div>
        <p id="hub-control-plane-status" class="muted-copy section-note">
          Valide o token para revisar surfaces, acoes e itens em destaque do Hub + MCP.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Surfaces</p>
            <ul id="hub-control-plane-surfaces" class="handoff-list compact">
              <li>Valide o token para ver Integration Hub, platform, skills, plugins e MCP no mesmo plano.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="hub-control-plane-actions" class="handoff-list compact">
              <li>Valide o token para revisar sync, doctor e proximos passos deste ecossistema.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Destaques</p>
            <ul id="hub-control-plane-featured" class="handoff-list compact">
              <li>Valide o token para revisar conectores, plugins, skills e MCPs destacados.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="qa-control-plane-card" class="handoff-card">
        <p class="profile-tag">QA release</p>
        <h2>QA, budgets e release gates</h2>
        <p class="muted-copy section-note">
          Esta leitura junta benchmarks, smokes, regressions e gate de release num plano unico para decidir se o host esta pronto para alpha ou beta.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Postura</p>
            <strong id="qa-control-plane-state">Valide o token</strong>
            <p id="qa-control-plane-summary" class="muted-copy">
              O consolidado da QA release aparece aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Benchmarks</p>
            <strong id="qa-control-plane-benchmarks-state">Sem leitura</strong>
            <p id="qa-control-plane-benchmarks-summary" class="muted-copy">
              Boot, runtime flow e sidecars aparecem aqui com budget e idade do relatorio.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Smokes & regressions</p>
            <strong id="qa-control-plane-regressions-state">Sem leitura</strong>
            <p id="qa-control-plane-regressions-summary" class="muted-copy">
              A suite critica e o smoke suite aparecem aqui com falhas, ausencia e stale.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Release</p>
            <strong id="qa-control-plane-release-state">Sem leitura</strong>
            <p id="qa-control-plane-release-summary" class="muted-copy">
              Alpha e beta aparecem aqui com gate pronto ou pendente.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="qa-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar QA</button>
          <button id="qa-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:qa">Copiar ops:qa</button>
          <button id="qa-control-plane-copy-alpha" type="button" class="action-button secondary compact-action" data-copy="npm run release:alpha">Copiar release:alpha</button>
          <button id="qa-control-plane-copy-beta" type="button" class="action-button secondary compact-action" data-copy="npm run release:beta">Copiar release:beta</button>
        </div>
        <p id="qa-control-plane-status" class="muted-copy section-note">
          Valide o token para revisar budgets, relatorios e gates de release deste host.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Budgets</p>
            <ul id="qa-control-plane-benchmarks" class="handoff-list compact">
              <li>Valide o token para revisar boot, runtime flow e sidecars contra os budgets versionados.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Smokes e regressions</p>
            <ul id="qa-control-plane-smokes" class="handoff-list compact">
              <li>Valide o token para revisar smoke suite e regressions criticas deste host.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Release profiles</p>
            <ul id="qa-control-plane-release-gates" class="handoff-list compact">
              <li>Valide o token para revisar o gate de alpha e beta sem depender de leitura manual de logs.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="release-ux-wizard-card" class="handoff-card">
        <p class="profile-tag">Etapa 44</p>
        <h2>Release wizard</h2>
        <p class="muted-copy section-note">
          Publish, diff, rollback e changelog ficam no mesmo fluxo preview-first para reduzir medo de publicar ou reverter.
        </p>
        <div class="ops-summary-grid">
          <article id="release-ux-readiness" class="ops-summary-card">
            <p class="profile-tag">Readiness</p>
            <strong>Preview-first</strong>
            <p class="muted-copy">
              Leia canal, versao, risco e presenca remota antes de escolher alpha, beta ou rollback.
            </p>
          </article>
          <article id="release-ux-diff" class="ops-summary-card">
            <p class="profile-tag">Diff humano</p>
            <strong>Publish comparavel</strong>
            <p class="muted-copy">
              Compare previous/latest com deltas por docs e remote console antes de aprovar o release.
            </p>
          </article>
          <article id="release-ux-rollback" class="ops-summary-card">
            <p class="profile-tag">Rollback</p>
            <strong>Preflight + evidencia</strong>
            <p class="muted-copy">
              Rollback permanece dry-run, com risco, target, evidencia e confirmacao explicita.
            </p>
          </article>
          <article id="release-ux-changelog" class="ops-summary-card">
            <p class="profile-tag">Changelog</p>
            <strong>Operacional</strong>
            <p class="muted-copy">
              Gere resumo legivel a partir de publish history e telemetry sem payload bruto.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button type="button" class="action-button secondary compact-action" data-copy="npm run release:wizard">Copiar release:wizard</button>
          <button type="button" class="action-button secondary compact-action" data-copy="npm run release:diff">Copiar release:diff</button>
          <button type="button" class="action-button secondary compact-action" data-copy="npm run release:rollback-preview">Copiar rollback preview</button>
          <button type="button" class="action-button secondary compact-action" data-copy="npm run release:changelog">Copiar changelog</button>
        </div>
      </section>

      <section id="governance-control-plane-card" class="handoff-card">
        <p class="profile-tag">Governance</p>
        <h2>Governance, tenants e policy</h2>
        <p class="muted-copy section-note">
          Esta leitura junta tenants, trust decisions, allowlists, channels, nodes, plugins, platform e transports numa camada unica de governanca operacional.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Postura</p>
            <strong id="governance-control-plane-state">Valide o token</strong>
            <p id="governance-control-plane-summary" class="muted-copy">
              A postura consolidada da Governance aparece aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Tenants</p>
            <strong id="governance-control-plane-tenants-state">Sem leitura</strong>
            <p id="governance-control-plane-tenants-summary" class="muted-copy">
              Tenants compartilhados, pessoais, onboarding e public servers aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Trust</p>
            <strong id="governance-control-plane-trust-state">Sem leitura</strong>
            <p id="governance-control-plane-trust-summary" class="muted-copy">
              Approvals, MCP, plugins trusted e capabilities sensiveis aparecem neste resumo.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Policy surfaces</p>
            <strong id="governance-control-plane-policy-state">Sem leitura</strong>
            <p id="governance-control-plane-policy-summary" class="muted-copy">
              Channels, nodes, platform, transports e teams ficam conectados ao mesmo contrato.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="governance-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar governance</button>
          <button id="governance-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:governance">Copiar ops:governance</button>
        </div>
        <p id="governance-control-plane-status" class="muted-copy section-note">
          Valide o token para revisar decisions, allowlists e policy por superficie.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Trust decisions</p>
            <ul id="governance-control-plane-decisions" class="handoff-list compact">
              <li>Valide o token para ver decisoes allow/ask/deny/defer/audit.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Policy surfaces</p>
            <ul id="governance-control-plane-surfaces" class="handoff-list compact">
              <li>Valide o token para ver tenants, trust, channels, nodes, plugins, platform, transports e teams.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="governance-control-plane-actions" class="handoff-list compact">
              <li>Valide o token para revisar proximos passos de governanca.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="tenant-team-ops-card" class="handoff-card">
        <p class="profile-tag">Etapa 42</p>
        <h2>Tenant/team ops</h2>
        <p class="muted-copy section-note">
          Identidade, policy, permissoes e isolamento ficam segmentados por workspace, projeto, tenant e time.
        </p>
        <div class="ops-summary-grid">
          <article id="tenant-team-identity" class="ops-summary-card">
            <p class="profile-tag">Identidade</p>
            <strong>Tenant scopes</strong>
            <p class="muted-copy">
              TenantId, plataforma, boundary, policy profile e status de governanca ficam normalizados.
            </p>
          </article>
          <article id="tenant-team-policy" class="ops-summary-card">
            <p class="profile-tag">Policy</p>
            <strong>Escopos vivos</strong>
            <p class="muted-copy">
              Tenants, channels, teams e workspace apontam para comandos de revisao e allowlist.
            </p>
          </article>
          <article id="tenant-team-permissions" class="ops-summary-card">
            <p class="profile-tag">Permissoes</p>
            <strong>Owners e allowlists</strong>
            <p class="muted-copy">
              Owners, guilds, channels e acoes guiadas aparecem por tenant antes de automacoes amplas.
            </p>
          </article>
          <article id="tenant-team-isolation" class="ops-summary-card">
            <p class="profile-tag">Isolamento</p>
            <strong>Memoria + artifacts</strong>
            <p class="muted-copy">
              Cada contexto recebe escopo proprio para reduzir mistura entre clientes, projetos e ambientes.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button type="button" class="action-button secondary compact-action" data-copy="npm run tenant:ops">Copiar tenant:ops</button>
          <button type="button" class="action-button secondary compact-action" data-copy="npm run tenant:ops:json">Copiar tenant JSON</button>
          <button type="button" class="action-button secondary compact-action" data-copy="npm run ops:governance">Copiar ops:governance</button>
        </div>
      </section>

      <section id="replay-learning-control-plane-card" class="handoff-card">
        <p class="profile-tag">Replay learning</p>
        <h2>Replay, artifacts e learning loop</h2>
        <p class="muted-copy section-note">
          Esta leitura transforma replay, artifacts, memoria e learning em pontos reutilizaveis de comparacao, retomada e promocao operacional.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Replay</p>
            <strong id="replay-learning-state">Valide o token</strong>
            <p id="replay-learning-summary" class="muted-copy">
              Timeline, compare runs e restore context aparecem aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Artifacts</p>
            <strong id="replay-learning-artifacts-state">Sem leitura</strong>
            <p id="replay-learning-artifacts-summary" class="muted-copy">
              Artifacts reutilizaveis e resume prompts ficam visiveis neste recorte.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Learning</p>
            <strong id="replay-learning-learning-state">Sem leitura</strong>
            <p id="replay-learning-learning-summary" class="muted-copy">
              Candidatos pendentes, promovidos e de alta confianca aparecem com proximo passo claro.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Memory</p>
            <strong id="replay-learning-memory-state">Sem leitura</strong>
            <p id="replay-learning-memory-summary" class="muted-copy">
              Pressao da memoria, procedimentos e pontos de restore ficam ligados ao mesmo plano.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="replay-learning-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Replay learning</button>
          <button id="replay-learning-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:replay-learning">Copiar ops:replay-learning</button>
        </div>
        <p id="replay-learning-status" class="muted-copy section-note">
          Valide o token para revisar timeline, artifacts reutilizaveis, learning promotions e memory pressure.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="replay-learning-actions" class="handoff-list compact">
              <li>Valide o token para revisar compare, resume e learning promotions.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Artifacts reutilizaveis</p>
            <ul id="replay-learning-artifacts" class="handoff-list compact">
              <li>Valide o token para ver artifacts com prompt de retomada.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Timeline</p>
            <ul id="replay-learning-timeline" class="handoff-list compact">
              <li>Valide o token para comparar replay, workflows e artifacts recentes.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="artifact-replay-workbench-card" class="handoff-card">
        <p class="profile-tag">Etapa 43</p>
        <h2>Artifact and Replay Workbench</h2>
        <p class="muted-copy section-note">
          Esta bancada junta indice de artifacts, comparacao entre runs, replay redigido, learning marks e export controlado de evidencias.
        </p>
        <div class="ops-summary-grid">
          <article id="artifact-workbench-index" class="ops-summary-card">
            <p class="profile-tag">Indice</p>
            <strong>Artifacts por run</strong>
            <p class="muted-copy">Agrupa artifacts por workspace, task e workflow para retomada sem garimpar logs.</p>
          </article>
          <article id="artifact-workbench-compare" class="ops-summary-card">
            <p class="profile-tag">Compare</p>
            <strong>Runs lado a lado</strong>
            <p class="muted-copy">Compara objetivo, status, artifacts e pontos de retomada entre execucoes.</p>
          </article>
          <article id="artifact-workbench-redaction" class="ops-summary-card">
            <p class="profile-tag">Redaction</p>
            <strong>Replay seguro</strong>
            <p class="muted-copy">Replay bruto nao entra no bundle; evidencias ficam como resumo e referencia.</p>
          </article>
          <article id="artifact-workbench-learning" class="ops-summary-card">
            <p class="profile-tag">Learning</p>
            <strong>Marcar boas sessoes</strong>
            <p class="muted-copy">Sessoes boas viram marks em review antes de qualquer promocao para memoria.</p>
          </article>
          <article id="artifact-workbench-export" class="ops-summary-card">
            <p class="profile-tag">Export</p>
            <strong>Evidencia controlada</strong>
            <p class="muted-copy">Exporta referencias, hashes e resumos; payloads e secrets ficam fora.</p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="artifact-workbench-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run artifact:workbench">Copiar workbench</button>
          <button id="artifact-workbench-copy-json" type="button" class="action-button secondary compact-action" data-copy="npm run artifact:workbench -- --json">Copiar JSON</button>
          <button id="artifact-workbench-copy-profile" type="button" class="action-button secondary compact-action" data-copy="npm run ops:replay-learning -- --export-profile">Copiar export profile</button>
        </div>
      </section>

      <section id="ecosystem-control-plane-card" class="handoff-card">
        <p class="profile-tag">Ecosystem</p>
        <h2>Ecossistema, SDKs e third-party platform</h2>
        <p class="muted-copy section-note">
          Esta leitura junta SDKs oficiais, guias publicos, publish, recipes e o catalogo do platform plane num cockpit unico para integradores e operadores.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Ecossistema</p>
            <strong id="ecosystem-control-plane-state">Valide o token</strong>
            <p id="ecosystem-control-plane-summary" class="muted-copy">
              SDKs, guides e publish aparecem aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">SDKs</p>
            <strong id="ecosystem-control-plane-sdk-state">Sem leitura</strong>
            <p id="ecosystem-control-plane-sdk-summary" class="muted-copy">
              O estado dos SDKs TypeScript e Python fica visivel aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Registry</p>
            <strong id="ecosystem-control-plane-registry-state">Sem leitura</strong>
            <p id="ecosystem-control-plane-registry-summary" class="muted-copy">
              Registry remoto, colecoes, recipes e itens em review ficam consolidados aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Publish</p>
            <strong id="ecosystem-control-plane-publish-state">Sem leitura</strong>
            <p id="ecosystem-control-plane-publish-summary" class="muted-copy">
              Bundles preparados, publicados e warnings de provenance aparecem aqui.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="ecosystem-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Ecosystem</button>
          <button id="ecosystem-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:ecosystem">Copiar ops:ecosystem</button>
        </div>
        <p id="ecosystem-control-plane-status" class="muted-copy section-note">
          Valide o token para revisar SDKs, guides, recipes e artefatos de publish do ecossistema.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="ecosystem-control-plane-actions" class="handoff-list compact">
              <li>Valide o token para revisar SDKs, guides e proximos passos do ecossistema.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Guias por tipo</p>
            <ul id="ecosystem-control-plane-guides" class="handoff-list compact">
              <li>Valide o token para ver client, node, plugin e recipe num plano unico.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Publish recente</p>
            <ul id="ecosystem-control-plane-publish" class="handoff-list compact">
              <li>Valide o token para revisar bundles, signatures e readiness do publish.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="distributed-runtime-control-plane-card" class="handoff-card">
        <p class="profile-tag">Distributed runtime</p>
        <h2>Runtime distribuido e superficies avancadas</h2>
        <p class="muted-copy section-note">
          Esta leitura junta channels avancados, fleet do Node Mesh, remote transports e superficies oficiais em uma postura unica para o runtime distribuido.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Distribuido</p>
            <strong id="distributed-runtime-control-plane-state">Valide o token</strong>
            <p id="distributed-runtime-control-plane-summary" class="muted-copy">
              Channel Mesh, Node Mesh, transports e surfaces aparecem aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Channels</p>
            <strong id="distributed-runtime-channels-state">Sem leitura</strong>
            <p id="distributed-runtime-channels-summary" class="muted-copy">
              O recorte dos canais avancados, attachments e threads aparece aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Fleet</p>
            <strong id="distributed-runtime-fleet-state">Sem leitura</strong>
            <p id="distributed-runtime-fleet-summary" class="muted-copy">
              Online, fila, stale e cobertura das capabilities avancadas aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Transports</p>
            <strong id="distributed-runtime-transports-state">Sem leitura</strong>
            <p id="distributed-runtime-transports-summary" class="muted-copy">
              Bridges, sidecars e node-hosts remotos aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Surfaces</p>
            <strong id="distributed-runtime-surfaces-state">Sem leitura</strong>
            <p id="distributed-runtime-surfaces-summary" class="muted-copy">
              Shell web, CLI, Telegram, Discord e remoto oficial aparecem aqui.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="distributed-runtime-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Distributed runtime</button>
          <button id="distributed-runtime-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:distributed">Copiar ops:distributed</button>
        </div>
        <p id="distributed-runtime-control-plane-status" class="muted-copy section-note">
          Valide o token para revisar channels, fleet, transports e surfaces do runtime distribuido.`;
}
