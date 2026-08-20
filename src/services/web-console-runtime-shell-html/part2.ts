export function buildRuntimeShellHtmlPart2(): string {
  return `          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Deliveries</p>
            <ul id="automation-control-plane-deliveries" class="handoff-list compact">
              <li>Validate token to review app, email, and webhook registered by Scheduled runs.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="watch-mode-card" class="handoff-card system-supervisor-card">
        <p class="profile-tag">Watch Mode</p>
        <h2>Supervisao visual of the desktop</h2>
        <p class="muted-copy section-note">
          Watch Mode follows screenshots, asks for approval before mutable actions, supports pause/resume/stop, and leaves a short visual replay.
        </p>
        <div class="ops-summary-grid system-supervisor-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Estado</p>
            <strong id="watch-mode-state">Validate token</strong>
            <p id="watch-mode-summary" class="muted-copy">
              O run visual supervised aparece here assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Policy</p>
            <strong id="watch-mode-policy-state">strict approval</strong>
            <p id="watch-mode-policy-summary" class="muted-copy">
              Allowlisted apps and sites help reduce friction, but the host remains supervised by default.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Approvals</p>
            <strong id="watch-mode-approval-state">Validate token</strong>
            <p id="watch-mode-approval-summary" class="muted-copy">
              every action sensitive pede handoff before tocar in the UI.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Replay</p>
            <strong id="watch-mode-replay-state">Validate token</strong>
            <p id="watch-mode-replay-summary" class="muted-copy">
              Current screenshot and short timeline appear here for visual audit.
            </p>
          </article>
        </div>
        <div class="system-supervisor-action-form">
          <input id="watch-mode-target-window" class="auth-input" type="text" placeholder="Janela alvo, ex.: Chrome" autocomplete="off" />
          <input id="watch-mode-site-url" class="auth-input" type="text" placeholder="Site optional, ex.: docs.example.com" autocomplete="off" />
          <input id="watch-mode-objective" class="auth-input" type="text" placeholder="Objetivo natural, ex.: review o zavorthControl" autocomplete="off" />
          <label class="inline-check"><input id="watch-mode-strict-approval" type="checkbox" checked /> strict approval</label>
          <button id="watch-mode-start-action" type="button" class="action-button compact-action" hidden>Iniciar Watch Mode</button>
          <button id="watch-mode-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Watch Mode</button>
          <button id="watch-mode-allow-app-action" type="button" class="action-button secondary compact-action" hidden>Allowlist app</button>
          <button id="watch-mode-allow-site-action" type="button" class="action-button secondary compact-action" hidden>Allowlist site</button>
          <button id="watch-mode-strict-on-action" type="button" class="action-button secondary compact-action" hidden>Strict on</button>
          <button id="watch-mode-strict-off-action" type="button" class="action-button secondary compact-action" hidden>Strict off</button>
          <button id="watch-mode-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:watch-mode" hidden>Copy ops:watch-mode</button>
          <button id="watch-mode-pause-action" type="button" class="action-button secondary compact-action" hidden>Pausar</button>
          <button id="watch-mode-resume-action" type="button" class="action-button secondary compact-action" hidden>resume</button>
          <button id="watch-mode-stop-action" type="button" class="action-button secondary compact-action" hidden>Parar</button>
        </div>
        <p id="watch-mode-status" class="muted-copy section-note">
          Validate the token to operate supervised Watch Mode on this host.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Preview</p>
            <img id="watch-mode-preview" alt="Preview of the Watch Mode" hidden style="width:100%;border-radius:16px;border:1px solid rgba(15,108,92,0.12);" />
            <p id="watch-mode-preview-empty" class="muted-copy">O screenshot mais recente aparece here when o Watch Mode estiver active.</p>
            <p id="watch-mode-next-step" class="muted-copy section-note">No run active ainda.</p>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Approvals pending</p>
            <ul id="watch-mode-approvals" class="handoff-list compact">
              <li>Validate token to review pending visual approvals.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Timeline visual</p>
            <ul id="watch-mode-timeline" class="handoff-list compact">
              <li>Validate token to review Watch Mode screenshots, actions, and handoffs.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="session-workspace-card" class="handoff-card">
        <h2>Workspace of the session</h2>
        <p class="muted-copy section-note">
          is and a control UI operational of the session: live chat, approvals, diffs, capabilities, resources, companions and health in the same plane of the gateway.
        </p>
        <div class="action-row compact-remote-actions">
          <button id="session-workspace-action" type="button" class="action-button secondary compact-action" hidden>Atualizar workspace</button>
        </div>
        <p id="session-workspace-status" class="muted-copy section-note">
          Validate token to load a session active, o state leve and o history canonical.
        </p>
        <div class="ops-summary-grid">
          <article id="session-workspace-session-card" class="ops-summary-card">
            <p class="profile-tag">Session current</p>
            <strong id="session-workspace-state">Validate token</strong>
            <p id="session-workspace-summary" class="muted-copy">
              O shell protegido mostra here a session active, tarefas, approvals and continuidade.
            </p>
            <ul id="session-workspace-details" class="handoff-list compact">
              <li>Validate token to load a session active of the gateway.</li>
            </ul>
          </article>
          <article id="session-workspace-approvals-card" class="ops-summary-card">
            <p class="profile-tag">Approvals</p>
            <strong id="session-workspace-approvals-state">Validate token</strong>
            <p id="session-workspace-approvals-summary" class="muted-copy">
              A queue pending de approvals aparece here assim que o shell protegido for liberado.
            </p>
            <ul id="session-workspace-approvals" class="handoff-list compact">
              <li>Validate token to review pending permissions and task gates.</li>
            </ul>
          </article>
          <article id="session-workspace-replay-card" class="ops-summary-card">
            <p class="profile-tag">Replay rapido</p>
            <strong id="session-workspace-replay-state">Validate token</strong>
            <p id="session-workspace-replay-summary" class="muted-copy">
              Replay, continuidade and handoff canonicos aparecem here assim que o shell protegido for liberado.
            </p>
            <ul id="session-workspace-replay" class="handoff-list compact">
              <li>Validate token to review replay, timeline, and next handoff.</li>
            </ul>
          </article>
          <article id="session-workspace-tools-card" class="ops-summary-card">
            <p class="profile-tag">Tool cards and diffs</p>
            <strong id="session-workspace-tools-state">Validate token</strong>
            <p id="session-workspace-tools-summary" class="muted-copy">
              Edited files, artifacts, and tool patches appear here in near real time.
            </p>
            <ul id="session-workspace-tools" class="handoff-list compact">
              <li>Validate token to review tool runs, changed files, and diffs.</li>
            </ul>
          </article>
          <article id="session-workspace-diffs-card" class="ops-summary-card">
            <p class="profile-tag">Diffs and artifacts</p>
            <strong id="session-workspace-diffs-state">Validate token</strong>
            <p id="session-workspace-diffs-summary" class="muted-copy">
              Consolidated diffs, touched files, and canonical artifacts appear here by tool run.
            </p>
            <ul id="session-workspace-diffs" class="handoff-list compact">
              <li>Validate token to review diffs and artifacts of the session active.</li>
            </ul>
          </article>
          <article id="session-workspace-capabilities-card" class="ops-summary-card">
            <p class="profile-tag">Capabilities</p>
            <strong id="session-workspace-capabilities-state">Validate token</strong>
            <p id="session-workspace-capabilities-summary" class="muted-copy">
              Capabilities declaradas, dormentes and pending de approval aparecem here for the current session.
            </p>
            <ul id="session-workspace-capabilities" class="handoff-list compact">
              <li>Validate token to review on-demand packs and capability plans.</li>
            </ul>
          </article>
          <article id="session-workspace-selfmod-card" class="ops-summary-card">
            <p class="profile-tag">Selfmod</p>
            <strong id="session-workspace-selfmod-state">Validate token</strong>
            <p id="session-workspace-selfmod-summary" class="muted-copy">
              Previews, apply and rollback of the selfmod aparecem here when a session trouxer changes evolutivas.
            </p>
            <ul id="session-workspace-selfmod" class="handoff-list compact">
              <li>Validate token to review selfmod previews, plans, and rollback.</li>
            </ul>
          </article>
          <article id="session-workspace-resources-card" class="ops-summary-card">
            <p class="profile-tag">Resources</p>
            <strong id="session-workspace-resources-state">Validate token</strong>
            <p id="session-workspace-resources-summary" class="muted-copy">
              Host pressure, top consumers, and safe actions to relieve RAM/CPU appear here.
            </p>
            <ul id="session-workspace-resources" class="handoff-list compact">
              <li>Validate token to review host resources and pressure signals.</li>
            </ul>
          </article>
          <article id="session-workspace-companions-card" class="ops-summary-card">
            <p class="profile-tag">Companions</p>
            <strong id="session-workspace-companions-state">Validate token</strong>
            <p id="session-workspace-companions-summary" class="muted-copy">
              WSL, Docker Desktop, ZavorthBridge, and Codex appear here with status, cost, and supervised actions.
            </p>
            <ul id="session-workspace-companions" class="handoff-list compact">
              <li>Validate token to review companions and safe actions on this host.</li>
            </ul>
          </article>
          <article id="session-workspace-health-card" class="ops-summary-card">
            <p class="profile-tag">Health and next actions</p>
            <strong id="session-workspace-health-state">Validate token</strong>
            <p id="session-workspace-health-summary" class="muted-copy">
              Warnings canonicos of the runtime and recommendations de cleanup aparecem here without need abrir o terminal.
            </p>
            <ul id="session-workspace-health" class="handoff-list compact">
              <li>Validate token to review warnings and next runtime actions.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="learning-memory-card" class="handoff-card">
        <h2>Learning loop and layered memory</h2>
        <p class="muted-copy section-note">
          O shell oficial mostra here o que o Zavorth aprendeu with runs de alta trust and quais procedimentos already podem ser reaproveitados.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Learning</p>
            <strong id="learning-state">Validate token</strong>
            <p id="learning-summary" class="muted-copy">
              Learned candidates, review, promotion, and quarantine appear here as soon as the protected shell is released.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="learning-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar learning</button>
            </div>
            <p id="learning-status" class="muted-copy section-note">
              Validate token to review learned drafts and promote only items that passed the gate.
            </p>
            <ul id="learning-details" class="handoff-list compact">
              <li>Validate token to review candidates, score, provenance, and review actions.</li>
            </ul>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Memory</p>
            <strong id="memory-layered-state">Validate token</strong>
            <p id="memory-layered-summary" class="muted-copy">
              Episodic, semantic and procedural memory aparecem here assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="memory-layered-refresh-action" type="button" class="action-button secondary compact-action" hidden>Refresh memory</button>
            </div>
            <div class="auth-row">
              <input id="memory-layered-query" class="auth-input" type="text" placeholder="Search episode, fact, or procedure" autocomplete="off" />
              <button id="memory-layered-search-action" type="button" class="action-button secondary compact-action" hidden>Search memory</button>
            </div>
            <p id="memory-layered-status" class="muted-copy section-note">
              Validate token to review budgets, procedures, and layered recall trail.
            </p>
            <ul id="memory-layered-details" class="handoff-list compact">
              <li>Validate the token to review reusable procedures and memory budgets.</li>
            </ul>
            <ul id="memory-layered-search-results" class="handoff-list compact">
              <li>Search for an episode, fact, or procedure after validating the token.</li>
            </ul>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Quality</p>
            <strong id="ops-quality-state">Validate token</strong>
            <p id="ops-quality-summary" class="muted-copy">
              The protected shell shows the operational score combining runtime, learning, memory, and governance here.
            </p>
            <p id="ops-quality-status" class="muted-copy section-note">
              Validate the token to review score, recovery state, memory pressure, and pending learning queue.
            </p>
            <ul id="ops-quality-details" class="handoff-list compact">
              <li>Validate token to load o quality gate oficial from this machine.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="ops-mesh-card" class="handoff-card">
        <h2>Operational mesh</h2>
        <p class="muted-copy section-note">
          Resumo curto de nodes, channels, remote transports and integrations registered on this host.
        </p>
        <div class="ops-summary-grid">
          <article id="ops-nodes-card" class="ops-summary-card">
            <p class="profile-tag">Nodes</p>
            <strong id="ops-nodes-state">Validate token</strong>
            <p id="ops-nodes-summary" class="muted-copy">
              O doctor of the Node Mesh aparece here assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-nodes-action" type="button" class="action-button secondary compact-action" hidden>Ver doctor</button>
            </div>
            <p id="ops-nodes-status" class="muted-copy section-note">
              Validate token to review current host nodes, queue, and pairing.
            </p>
            <ul id="ops-nodes-details" class="handoff-list compact">
              <li>Validate token to review current host nodes, queue, and pairing.</li>
            </ul>
            <div id="ops-nodes-panel" class="ops-detail-panel" hidden>
              <p class="profile-tag">Panel of the foco</p>
              <strong id="ops-nodes-panel-title">Node Mesh</strong>
              <p id="ops-nodes-panel-summary" class="muted-copy">
                Open the panel to review trust, maintenance and capabilities of the node foco.
              </p>
              <div id="ops-nodes-panel-actions"></div>
              <ul id="ops-nodes-panel-details" class="handoff-list compact">
                <li>Open the panel to review trust, maintenance and capabilities of the node foco.</li>
              </ul>
            </div>
          </article>
          <article id="ops-channels-card" class="ops-summary-card">
            <p class="profile-tag">Channels</p>
            <strong id="ops-channels-state">Validate token</strong>
            <p id="ops-channels-summary" class="muted-copy">
              O Channel Mesh aparece here assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-channels-action" type="button" class="action-button secondary compact-action" hidden>Ver Channel Mesh</button>
            </div>
            <p id="ops-channels-status" class="muted-copy section-note">
              Validate token to review channel readiness, pairing, and promotion without falling back to legacy paths.
            </p>
            <ul id="ops-channels-details" class="handoff-list compact">
              <li>Validate token to review channel readiness, pairing, and promotion without falling back to legacy paths.</li>
            </ul>
            <div id="ops-channels-panel" class="ops-detail-panel" hidden>
              <p class="profile-tag">Panel of the foco</p>
              <strong id="ops-channels-panel-title">Channel Mesh</strong>
              <p id="ops-channels-panel-summary" class="muted-copy">
                Open the panel to review policy, transport and next passo of the channel foco.
              </p>
              <div id="ops-channels-panel-actions"></div>
              <ul id="ops-channels-panel-details" class="handoff-list compact">
                <li>Open the panel to review policy, transport and next passo of the channel foco.</li>
              </ul>
            </div>
          </article>
          <article id="ops-keepalive-card" class="ops-summary-card">
            <p class="profile-tag">Supervisao local</p>
            <strong id="ops-keepalive-state">Verificando</strong>
            <p id="ops-keepalive-summary" class="muted-copy">
              O keepalive supervised acompanha AIGateway, gateway and node-host.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-keepalive-action" type="button" class="action-button secondary compact-action" data-copy="npm run ops:remote:keepalive">Copy keepalive</button>
              <button id="ops-keepalive-smoke" type="button" class="action-button secondary compact-action" data-copy="npm run test:transports:smoke">Copy smoke remote</button>
            </div>
            <p id="ops-keepalive-status" class="muted-copy section-note">
              local keepalive snapshot not loaded yet.
            </p>
            <ul id="ops-keepalive-details" class="handoff-list compact">
              <li>Load the snapshot to see latency, readiness, and last keepalive signal.</li>
            </ul>
          </article>
          <article id="ops-transports-card" class="ops-summary-card">
            <p class="profile-tag">Transportes</p>
            <strong id="ops-transports-state">Validate token</strong>
            <p id="ops-transports-summary" class="muted-copy">
              O remote plan aparece here assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-transports-action" type="button" class="action-button secondary compact-action" hidden>Ver remote plan</button>
            </div>
            <p id="ops-transports-status" class="muted-copy section-note">
              Validate token to review health, attention, and recovery for the remote plan.
            </p>
            <ul id="ops-transports-details" class="handoff-list compact">
              <li>Validate token to review health, attention, and recovery for the remote plan.</li>
            </ul>
            <div id="ops-transports-panel" class="ops-detail-panel" hidden>
              <p class="profile-tag">Panel of the foco</p>
              <strong id="ops-transports-panel-title">Remote plan</strong>
              <p id="ops-transports-panel-summary" class="muted-copy">
                Open the panel to review readiness, history and actions of the transport foco.
              </p>
              <div id="ops-transports-panel-actions"></div>
              <ul id="ops-transports-panel-details" class="handoff-list compact">
                <li>Open the panel to review readiness, history and actions of the transport foco.</li>
              </ul>
            </div>
          </article>
          <article id="ops-extensions-card" class="ops-summary-card">
            <p class="profile-tag">Integrations</p>
            <strong id="ops-extensions-state">Validate token</strong>
            <p id="ops-extensions-summary" class="muted-copy">
              O catalog de integrations aparece here assim que o shell protegido for liberado.
            </p>
            <div class="action-row compact-remote-actions">
              <button id="ops-extensions-action" type="button" class="action-button secondary compact-action" hidden>Ver catalog</button>
            </div>
            <p id="ops-extensions-status" class="muted-copy section-note">
              Validate token to review workspaces, plugins, commands and loaded hooks.
            </p>
            <ul id="ops-extensions-details" class="handoff-list compact">
              <li>Validate token to review workspaces, plugins, commands and loaded hooks.</li>
            </ul>
            <div id="ops-extensions-panel" class="ops-detail-panel" hidden>
              <p class="profile-tag">Panel of the foco</p>
              <strong id="ops-extensions-panel-title">catalog de integrations</strong>
              <p id="ops-extensions-panel-summary" class="muted-copy">
                Open the panel to review workspaces, plugins, commands, hooks and local visibility.
              </p>
              <div id="ops-extensions-panel-actions"></div>
              <ul id="ops-extensions-panel-details" class="handoff-list compact">
                <li>Open the panel to review workspaces, commands, hooks and local visibility.</li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section id="eval-control-plane-card" class="handoff-card">
        <p class="profile-tag">Channel mesh</p>
        <h2>Eval and observabilidade operational</h2>
        <p class="muted-copy section-note">
          read mode turns real tasks, approvals, workflows, traces, and artifacts into scorecards, datasets, historical trends, and operational regressions.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Postura</p>
            <strong id="eval-control-plane-state">Validate token</strong>
            <p id="eval-control-plane-summary" class="muted-copy">
              A read consolidada de evals aparece here assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Scorecards</p>
            <strong id="eval-control-plane-scorecards-state">No reading</strong>
            <p id="eval-control-plane-scorecards-summary" class="muted-copy">
              Routes with better baseline, higher friction, and higher operational cost appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Datasets</p>`;
}
