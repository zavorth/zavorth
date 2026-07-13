export function buildRuntimeShellHtmlPart2(): string {
  return `          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Deliveries</p>
            <ul id="automation-control-plane-deliveries" class="handoff-list compact">
              <li>Valide o token para revisar app, email e webhook registrados pela Scheduled runs.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="watch-mode-card" class="handoff-card system-overlord-card">
        <p class="profile-tag">Watch Mode</p>
        <h2>Supervisao visual do desktop</h2>
        <p class="muted-copy section-note">
          O Watch Mode acompanha screenshots, pede approval antes de acoes mutaveis, permite pause/resume/stop e deixa um replay visual curto do que aconteceu.
        </p>
        <div class="ops-summary-grid system-overlord-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Estado</p>
            <strong id="watch-mode-state">Valide o token</strong>
            <p id="watch-mode-summary" class="muted-copy">
              O run visual supervisionado aparece aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Policy</p>
            <strong id="watch-mode-policy-state">strict approval</strong>
            <p id="watch-mode-policy-summary" class="muted-copy">
              Apps e sites em allowlist ajudam a reduzir friccao, mas o host continua supervisionado por padrao.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Approvals</p>
            <strong id="watch-mode-approval-state">Valide o token</strong>
            <p id="watch-mode-approval-summary" class="muted-copy">
              Toda acao sensivel pede handoff antes de tocar na UI.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Replay</p>
            <strong id="watch-mode-replay-state">Valide o token</strong>
            <p id="watch-mode-replay-summary" class="muted-copy">
              Screenshot atual e timeline curta ficam aqui para auditoria visual.
            </p>
          </article>
        </div>
        <div class="system-overlord-action-form">
          <input id="watch-mode-target-window" class="auth-input" type="text" placeholder="Janela alvo, ex.: Chrome" autocomplete="off" />
          <input id="watch-mode-site-url" class="auth-input" type="text" placeholder="Site opcional, ex.: docs.example.com" autocomplete="off" />
          <input id="watch-mode-objective" class="auth-input" type="text" placeholder="Objetivo natural, ex.: revisar o zavorthControl" autocomplete="off" />
          <label class="inline-check"><input id="watch-mode-strict-approval" type="checkbox" checked /> strict approval</label>
          <button id="watch-mode-start-action" type="button" class="action-button compact-action" hidden>Iniciar Watch Mode</button>
          <button id="watch-mode-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Watch Mode</button>
          <button id="watch-mode-allow-app-action" type="button" class="action-button secondary compact-action" hidden>Allowlist app</button>
          <button id="watch-mode-allow-site-action" type="button" class="action-button secondary compact-action" hidden>Allowlist site</button>
          <button id="watch-mode-strict-on-action" type="button" class="action-button secondary compact-action" hidden>Strict on</button>
          <button id="watch-mode-strict-off-action" type="button" class="action-button secondary compact-action" hidden>Strict off</button>
          <button id="watch-mode-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:watch-mode" hidden>Copiar ops:watch-mode</button>
          <button id="watch-mode-pause-action" type="button" class="action-button secondary compact-action" hidden>Pausar</button>
          <button id="watch-mode-resume-action" type="button" class="action-button secondary compact-action" hidden>Retomar</button>
          <button id="watch-mode-stop-action" type="button" class="action-button secondary compact-action" hidden>Parar</button>
        </div>
        <p id="watch-mode-status" class="muted-copy section-note">
          Valide o token para operar o Watch Mode supervisionado deste host.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Preview</p>
            <img id="watch-mode-preview" alt="Preview do Watch Mode" hidden style="width:100%;border-radius:16px;border:1px solid rgba(15,108,92,0.12);" />
            <p id="watch-mode-preview-empty" class="muted-copy">O screenshot mais recente aparece aqui quando o Watch Mode estiver ativo.</p>
            <p id="watch-mode-next-step" class="muted-copy section-note">Nenhum run ativo ainda.</p>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Approvals pendentes</p>
            <ul id="watch-mode-approvals" class="handoff-list compact">
              <li>Valide o token para revisar approvals visuais pendentes.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Timeline visual</p>
            <ul id="watch-mode-timeline" class="handoff-list compact">
              <li>Valide o token para revisar screenshots, acoes e handoffs do Watch Mode.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="session-workspace-card" class="handoff-card">
        <h2>Workspace dthe session</h2>
        <p class="muted-copy section-note">
          Esta e a control UI operacional dthe session: chat vivo, approvals, diffs, capabilities, recursos, companions e health no mesmo plano do gateway.
        </p>
        <div class="action-row compact-remote-actions">
          <button id="session-workspace-action" type="button" class="action-button secondary compact-action" hidden>Atualizar workspace</button>
        </div>
        <p id="session-workspace-status" class="muted-copy section-note">
          Valide o token para carregar the session ativa, o estado leve e o historico canonico.
        </p>
        <div class="ops-summary-grid">
          <article id="session-workspace-session-card" class="ops-summary-card">
            <p class="profile-tag">Sessao atual</p>
            <strong id="session-workspace-state">Valide o token</strong>
            <p id="session-workspace-summary" class="muted-copy">
              O shell protegido mostra aqui the session ativa, tarefas, approvals e continuidade.
            </p>
            <ul id="session-workspace-details" class="handoff-list compact">
              <li>Valide o token para carregar the session ativa do gateway.</li>
            </ul>
          </article>
          <article id="session-workspace-approvals-card" class="ops-summary-card">
            <p class="profile-tag">Aprovacoes</p>
            <strong id="session-workspace-approvals-state">Valide o token</strong>
            <p id="session-workspace-approvals-summary" class="muted-copy">
              A fila pendente de approvals aparece aqui assim que o shell protegido for liberado.
            </p>
            <ul id="session-workspace-approvals" class="handoff-list compact">
              <li>Valide o token para revisar permissoes e task gates pendentes.</li>
            </ul>
          </article>
          <article id="session-workspace-replay-card" class="ops-summary-card">
            <p class="profile-tag">Replay rapido</p>
            <strong id="session-workspace-replay-state">Valide o token</strong>
            <p id="session-workspace-replay-summary" class="muted-copy">
              Replay, continuidade e handoff canonical aparecem aqui assim que o shell protegido for liberado.
            </p>
            <ul id="session-workspace-replay" class="handoff-list compact">
              <li>Valide o token para revisar replay, timeline e proximo handoff.</li>
            </ul>
          </article>
          <article id="session-workspace-tools-card" class="ops-summary-card">
            <p class="profile-tag">Tool cards e diffs</p>
            <strong id="session-workspace-tools-state">Valide o token</strong>
            <p id="session-workspace-tools-summary" class="muted-copy">
              Arquivos editados, artifacts e patches das tools aparecem aqui em tempo quase real.
            </p>
            <ul id="session-workspace-tools" class="handoff-list compact">
              <li>Valide o token para revisar tool runs, arquivos alterados e diffs.</li>
            </ul>
          </article>
          <article id="session-workspace-diffs-card" class="ops-summary-card">
            <p class="profile-tag">Diffs e artifacts</p>
            <strong id="session-workspace-diffs-state">Valide o token</strong>
            <p id="session-workspace-diffs-summary" class="muted-copy">
              Diffs consolidados, arquivos tocados e artifacts canonical aparecem aqui por tool run.
            </p>
            <ul id="session-workspace-diffs" class="handoff-list compact">
              <li>Valide o token para revisar diffs e artifacts dthe session ativa.</li>
            </ul>
          </article>
          <article id="session-workspace-capabilities-card" class="ops-summary-card">
            <p class="profile-tag">Capabilities</p>
            <strong id="session-workspace-capabilities-state">Valide o token</strong>
            <p id="session-workspace-capabilities-summary" class="muted-copy">
              Capabilities declaradas, dormentes e pendentes de approval aparecem aqui para the session atual.
            </p>
            <ul id="session-workspace-capabilities" class="handoff-list compact">
              <li>Valide o token para revisar packs sob demanda e plans de capability.</li>
            </ul>
          </article>
          <article id="session-workspace-selfmod-card" class="ops-summary-card">
            <p class="profile-tag">Selfmod</p>
            <strong id="session-workspace-selfmod-state">Valide o token</strong>
            <p id="session-workspace-selfmod-summary" class="muted-copy">
              Previews, apply e rollback do selfmod aparecem aqui quando the session trouxer mudancas evolutivas.
            </p>
            <ul id="session-workspace-selfmod" class="handoff-list compact">
              <li>Valide o token para revisar previews, plans e rollback do selfmod.</li>
            </ul>
          </article>
          <article id="session-workspace-resources-card" class="ops-summary-card">
            <p class="profile-tag">Resources</p>
            <strong id="session-workspace-resources-state">Valide o token</strong>
            <p id="session-workspace-resources-summary" class="muted-copy">
              Host pressure, top consumers e acoes seguras para aliviar RAM/CPU aparecem aqui.
            </p>
            <ul id="session-workspace-resources" class="handoff-list compact">
              <li>Valide o token para revisar recursos do host e sinais de pressao.</li>
            </ul>
          </article>
          <article id="session-workspace-companions-card" class="ops-summary-card">
            <p class="profile-tag">Companions</p>
            <strong id="session-workspace-companions-state">Valide o token</strong>
            <p id="session-workspace-companions-summary" class="muted-copy">
              WSL, Docker Desktop, ZavorthBridge e Codex aparecem aqui com status, custo e acoes supervisionadas.
            </p>
            <ul id="session-workspace-companions" class="handoff-list compact">
              <li>Valide o token para revisar companions e acoes seguras neste host.</li>
            </ul>
          </article>
          <article id="session-workspace-health-card" class="ops-summary-card">
            <p class="profile-tag">Health e proximas acoes</p>
            <strong id="session-workspace-health-state">Valide o token</strong>
            <p id="session-workspace-health-summary" class="muted-copy">
              Warnings canonical do runtime e recommendations de cleanup aparecem aqui sem precisar abrir o terminal.
            </p>
            <ul id="session-workspace-health" class="handoff-list compact">
              <li>Valide o token para revisar warnings e proximas acoes do runtime.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="learning-memory-card" class="handoff-card">
        <h2>Learning loop e memoria em camadas</h2>
        <p class="muted-copy section-note">
          O shell oficial mostra aqui o que o Zavorth aprendeu com runs de alta confianca e quais procedimentos ja podem ser reaproveitados.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Learning</p>
            <strong id="learning-state">Valide o token</strong>
            <p id="learning-summary" class="muted-copy">
              Candidatos aprendidos, review, promocao e quarentena aparecem aqui assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="learning-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar learning</button>
            </div>
            <p id="learning-status" class="muted-copy section-note">
              Valide o token para revisar drafts aprendidos e promover apenas o que passou pelo gate.
            </p>
            <ul id="learning-details" class="handoff-list compact">
              <li>Valide o token para revisar candidates, score, provenance e acoes de review.</li>
            </ul>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Memoria</p>
            <strong id="memory-layered-state">Valide o token</strong>
            <p id="memory-layered-summary" class="muted-copy">
              Episodic, semantic e procedural memory aparecem aqui assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="memory-layered-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar memoria</button>
            </div>
            <div class="auth-row">
              <input id="memory-layered-query" class="auth-input" type="text" placeholder="Buscar episodio, fato ou procedimento" autocomplete="off" />
              <button id="memory-layered-search-action" type="button" class="action-button secondary compact-action" hidden>Buscar memoria</button>
            </div>
            <p id="memory-layered-status" class="muted-copy section-note">
              Valide o token para revisar budgets, procedimentos e a trilha de recall por camada.
            </p>
            <ul id="memory-layered-details" class="handoff-list compact">
              <li>Valide o token para revisar procedimentos reutilizaveis e budgets da memoria.</li>
            </ul>
            <ul id="memory-layered-search-results" class="handoff-list compact">
              <li>Busque um episodio, fato ou procedimento depois de validar o token.</li>
            </ul>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Quality</p>
            <strong id="ops-quality-state">Valide o token</strong>
            <p id="ops-quality-summary" class="muted-copy">
              O shell protegido mostra aqui o score operacional que combina runtime, learning, memoria e governanca.
            </p>
            <p id="ops-quality-status" class="muted-copy section-note">
              Valide o token para revisar score, recovery state, pressao de memoria e fila pendente de aprendizado.
            </p>
            <ul id="ops-quality-details" class="handoff-list compact">
              <li>Valide o token para carregar o quality gate oficial dthis machine.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="ops-mesh-card" class="handoff-card">
        <h2>Malha operacional</h2>
        <p class="muted-copy section-note">
          Resumo curto de nodes, canais, transportes remotos e integrations registradas neste host.
        </p>
        <div class="ops-summary-grid">
          <article id="ops-nodes-card" class="ops-summary-card">
            <p class="profile-tag">Nodes</p>
            <strong id="ops-nodes-state">Valide o token</strong>
            <p id="ops-nodes-summary" class="muted-copy">
              O doctor do Node Mesh aparece aqui assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-nodes-action" type="button" class="action-button secondary compact-action" hidden>Ver doctor</button>
            </div>
            <p id="ops-nodes-status" class="muted-copy section-note">
              Valide o token para revisar nodes, fila e pairing do host atual.
            </p>
            <ul id="ops-nodes-details" class="handoff-list compact">
              <li>Valide o token para revisar nodes, fila e pairing do host atual.</li>
            </ul>
            <div id="ops-nodes-panel" class="ops-detail-panel" hidden>
              <p class="profile-tag">Painel do foco</p>
              <strong id="ops-nodes-panel-title">Node Mesh</strong>
              <p id="ops-nodes-panel-summary" class="muted-copy">
                Abra o painel para revisar trust, maintenance e capabilities do node foco.
              </p>
              <div id="ops-nodes-panel-actions"></div>
              <ul id="ops-nodes-panel-details" class="handoff-list compact">
                <li>Abra o painel para revisar trust, maintenance e capabilities do node foco.</li>
              </ul>
            </div>
          </article>
          <article id="ops-channels-card" class="ops-summary-card">
            <p class="profile-tag">Channels</p>
            <strong id="ops-channels-state">Valide o token</strong>
            <p id="ops-channels-summary" class="muted-copy">
              O Channel Mesh aparece aqui assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-channels-action" type="button" class="action-button secondary compact-action" hidden>Ver Channel Mesh</button>
            </div>
            <p id="ops-channels-status" class="muted-copy section-note">
              Valide o token para revisar readiness, pairing e promocao dos canais sem cair no legado.
            </p>
            <ul id="ops-channels-details" class="handoff-list compact">
              <li>Valide o token para revisar readiness, pairing e promocao dos canais sem cair no legado.</li>
            </ul>
            <div id="ops-channels-panel" class="ops-detail-panel" hidden>
              <p class="profile-tag">Painel do foco</p>
              <strong id="ops-channels-panel-title">Channel Mesh</strong>
              <p id="ops-channels-panel-summary" class="muted-copy">
                Abra o painel para revisar policy, transporte e proximo passo do canal foco.
              </p>
              <div id="ops-channels-panel-actions"></div>
              <ul id="ops-channels-panel-details" class="handoff-list compact">
                <li>Abra o painel para revisar policy, transporte e proximo passo do canal foco.</li>
              </ul>
            </div>
          </article>
          <article id="ops-keepalive-card" class="ops-summary-card">
            <p class="profile-tag">Supervisao local</p>
            <strong id="ops-keepalive-state">Verificando</strong>
            <p id="ops-keepalive-summary" class="muted-copy">
              O keepalive supervisionado acompanha AIGateway, gateway e node-host.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-keepalive-action" type="button" class="action-button secondary compact-action" data-copy="npm run ops:remote:keepalive">Copiar keepalive</button>
              <button id="ops-keepalive-smoke" type="button" class="action-button secondary compact-action" data-copy="npm run test:transports:smoke">Copiar smoke remoto</button>
            </div>
            <p id="ops-keepalive-status" class="muted-copy section-note">
              Snapshot local do keepalive not yet carregado.
            </p>
            <ul id="ops-keepalive-details" class="handoff-list compact">
              <li>Carregue o snapshot para ver latencia, readiness e ultimo sinal do keepalive.</li>
            </ul>
          </article>
          <article id="ops-transports-card" class="ops-summary-card">
            <p class="profile-tag">Transportes</p>
            <strong id="ops-transports-state">Valide o token</strong>
            <p id="ops-transports-summary" class="muted-copy">
              O plano remoto aparece aqui assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-transports-action" type="button" class="action-button secondary compact-action" hidden>Ver plano remoto</button>
            </div>
            <p id="ops-transports-status" class="muted-copy section-note">
              Valide o token para revisar health, attention e recover do plano remoto.
            </p>
            <ul id="ops-transports-details" class="handoff-list compact">
              <li>Valide o token para revisar health, attention e recover do plano remoto.</li>
            </ul>
            <div id="ops-transports-panel" class="ops-detail-panel" hidden>
              <p class="profile-tag">Painel do foco</p>
              <strong id="ops-transports-panel-title">Plano remoto</strong>
              <p id="ops-transports-panel-summary" class="muted-copy">
                Abra o painel para revisar readiness, history e acoes do transporte foco.
              </p>
              <div id="ops-transports-panel-actions"></div>
              <ul id="ops-transports-panel-details" class="handoff-list compact">
                <li>Abra o painel para revisar readiness, history e acoes do transporte foco.</li>
              </ul>
            </div>
          </article>
          <article id="ops-extensions-card" class="ops-summary-card">
            <p class="profile-tag">Integrations</p>
            <strong id="ops-extensions-state">Valide o token</strong>
            <p id="ops-extensions-summary" class="muted-copy">
              O catalogo de integrations aparece aqui assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-extensions-action" type="button" class="action-button secondary compact-action" hidden>Ver catalogo</button>
            </div>
            <p id="ops-extensions-status" class="muted-copy section-note">
              Valide o token para revisar workspaces, plugins, commands e hooks carregados.
            </p>
            <ul id="ops-extensions-details" class="handoff-list compact">
              <li>Valide o token para revisar workspaces, plugins, commands e hooks carregados.</li>
            </ul>
            <div id="ops-extensions-panel" class="ops-detail-panel" hidden>
              <p class="profile-tag">Painel do foco</p>
              <strong id="ops-extensions-panel-title">Catalog de integrations</strong>
              <p id="ops-extensions-panel-summary" class="muted-copy">
                Abra o painel para revisar workspaces, plugins, comandos, hooks e visibilidade local.
              </p>
              <div id="ops-extensions-panel-actions"></div>
              <ul id="ops-extensions-panel-details" class="handoff-list compact">
                <li>Abra o painel para revisar workspaces, comandos, hooks e visibilidade local.</li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section id="eval-control-plane-card" class="handoff-card">
        <p class="profile-tag">Channel mesh</p>
        <h2>Eval e observabilidade operacional</h2>
        <p class="muted-copy section-note">
          Esta leitura transforma tasks, approvals, workflows, traces e artifacts reais em scorecards, datasets, tendencia historica e regressions operacionais.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Postura</p>
            <strong id="eval-control-plane-state">Valide o token</strong>
            <p id="eval-control-plane-summary" class="muted-copy">
              A leitura consolidada de evals aparece aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Scorecards</p>
            <strong id="eval-control-plane-scorecards-state">Sem leitura</strong>
            <p id="eval-control-plane-scorecards-summary" class="muted-copy">
              Rotas com melhor baseline, maior friccao e maior custo operacional aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Datasets</p>`;
}
