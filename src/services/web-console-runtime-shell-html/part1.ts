export function buildRuntimeShellHtmlPart1(input: { externalWebClientUrl: string; externalDocsUrl: string; legacyBannerBlock: string }): string {
  const { externalWebClientUrl, externalDocsUrl, legacyBannerBlock } = input;
  return `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zavorth Runtime</title>
    <base href="/" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="./styles.css" />
    <script type="module" src="./app.js"></script>
  </head>
  <body data-external-web-client-url="${externalWebClientUrl}" data-external-docs-url="${externalDocsUrl}">
    <main id="runtime-handoff" class="runtime-handoff-shell">
      ${legacyBannerBlock}
      <section class="hero-card">
        <p class="eyebrow">Zavorth Runtime</p>
        <h1>Runtime, terminal and API ficam here.</h1>
        <p class="hero-copy">
          Este repo oficial and a casa of the runtime, of the CLI and of the API of the Zavorth.
          A entrada principal and <code>/zavorthControl</code>.
          Este shell and um fallback interno de maintenance: ele resume runtime, sessions, approvals
          and the operational mesh when canonical zavorthControl assets are unavailable.
        </p>
        <div class="status-grid">
          <article class="status-pill">
            <span class="label">Runtime web</span>
            <strong id="runtime-shell-status">Verificando</strong>
          </article>
          <article class="status-pill">
            <span class="label">Auth web</span>
            <strong id="runtime-shell-auth">Verificando</strong>
          </article>
          <article class="status-pill">
            <span class="label">API base</span>
            <strong id="runtime-shell-origin">Detectando</strong>
          </article>
          <article class="status-pill">
            <span class="label">Gateway</span>
            <strong id="runtime-shell-gateway">Verificando</strong>
          </article>
          <article class="status-pill">
            <span class="label">Mesh rapido</span>
            <strong id="runtime-shell-mesh">Detectando</strong>
          </article>
        </div>
        <div class="action-row hero-actions">
          <button type="button" class="action-button" data-copy="npm run ops:go">Copy npm run ops:go</button>
          <button type="button" class="action-button secondary" data-copy="npm run cli -- status">Copy status of the CLI</button>
          <a id="open-zavorthControl" class="action-button secondary" href="/zavorthControl">Abrir zavorthControl</a>
        </div>
        <p class="muted-copy hero-note">
          path principal: <code>npm run ops:go</code>. Se you opera only por terminal, use
          <code>npm run cli -- status</code>, <code>npm run cli -- doctor</code> and <code>npm run cli:repl</code>.
        </p>
      </section>

      <section id="operator-cockpit-card" class="handoff-card">
        <p class="profile-tag">Cockpit</p>
        <h2>Operator cockpit</h2>
        <p class="muted-copy section-note">
          Estes nove blocos sao a read canonica of the Zavorth on this host: runtime, sessions, approvals, resources, companions, health, nodes, transports and integrations.
        </p>
        <div class="ops-summary-grid cockpit-summary-grid">
          <article id="cockpit-runtime-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Runtime</p>
            <strong id="cockpit-runtime-state">Verificando</strong>
            <p id="cockpit-runtime-summary" class="muted-copy">
              The runtime summary appears here as soon as the host responds.
            </p>
          </article>
          <article id="cockpit-sessions-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Sessions</p>
            <strong id="cockpit-sessions-state">Validate token</strong>
            <p id="cockpit-sessions-summary" class="muted-copy">
              A session ativa, o history and o envio cruzado aparecem here when the protected shell is released.
            </p>
          </article>
          <article id="cockpit-approvals-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Approvals</p>
            <strong id="cockpit-approvals-state">Validate token</strong>
            <p id="cockpit-approvals-summary" class="muted-copy">
              The approval queue for this session appears here when the protected shell is released.
            </p>
          </article>
          <article id="cockpit-resources-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Resources</p>
            <strong id="cockpit-resources-state">Validate token</strong>
            <p id="cockpit-resources-summary" class="muted-copy">
              Memory, host pressure, and top consumers appear here when the protected shell is released.
            </p>
          </article>
          <article id="cockpit-companions-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Companions</p>
            <strong id="cockpit-companions-state">Validate token</strong>
            <p id="cockpit-companions-summary" class="muted-copy">
              WSL, Docker Desktop, ZavorthBridge and Codex aparecem here with status and safe actions.
            </p>
          </article>
          <article id="cockpit-health-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Health</p>
            <strong id="cockpit-health-state">Validate token</strong>
            <p id="cockpit-health-summary" class="muted-copy">
              Warnings de runtime and next actions aparecem here when the protected shell is released.
            </p>
          </article>
          <article id="cockpit-nodes-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Nodes</p>
            <strong id="cockpit-nodes-state">Validate token</strong>
            <p id="cockpit-nodes-summary" class="muted-copy">
              O summary of the frota, of the pairing and of the queue of the Node Mesh aparece here when the protected shell is released.
            </p>
          </article>
          <article id="cockpit-transports-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Transports</p>
            <strong id="cockpit-transports-state">Validate token</strong>
            <p id="cockpit-transports-summary" class="muted-copy">
              O summary of the remote plan aparece here when the protected shell is released.
            </p>
          </article>
          <article id="cockpit-integrations-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Integrations</p>
            <strong id="cockpit-integrations-state">Validate token</strong>
            <p id="cockpit-integrations-summary" class="muted-copy">
              Plugins, hooks and workspaces carregados aparecem here when the protected shell is released.
            </p>
          </article>
        </div>
        <div id="operator-action-rail" class="action-row action-rail">
          <button type="button" class="action-button" data-cockpit-action="refresh">Atualizar cockpit</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-card">Go to sessions</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-approvals-card">Go to approvals</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-resources-card">Go to resources</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-companions-card">Go to companions</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-health-card">Go to health</button>
          <button type="button" class="action-button secondary" data-cockpit-target="ops-nodes-card">Go to nodes</button>
          <button type="button" class="action-button secondary" data-cockpit-target="ops-transports-card">Go to transports</button>
          <button type="button" class="action-button secondary" data-cockpit-target="ops-extensions-card">Go to integrations</button>
          <button type="button" class="action-button secondary" data-copy="npm run cli -- status">Copy status CLI</button>
          <button type="button" class="action-button secondary" data-copy="npm run cli -- doctor">Copy doctor CLI</button>
        </div>
        <p id="operator-cockpit-status" class="muted-copy section-note">
          Validate token to turn this summary into a full operational cockpit.
        </p>
      </section>

      <section class="handoff-card">
        <p class="profile-tag">Agora</p>
        <h2>Melhor next passo</h2>
        <p id="priority-summary" class="hero-copy">
          Validate token to see this host official recommendation.
        </p>
        <p id="priority-reason" class="muted-copy section-note">
          The shell uses the official manifest to explain what to of the now, why this is the best path
          and what happens next.
        </p>
        <div class="action-row priority-actions">
          <button
            id="priority-primary-action"
            type="button"
            class="action-button"
            hidden
          >run now</button>
          <button
            id="priority-primary-copy"
            type="button"
            class="action-button"
            data-copy=""
            hidden
          >Copy main command</button>
          <a id="priority-primary-open" class="action-button" href="#" hidden>Abrir now</a>
          <button
            id="priority-secondary-copy"
            type="button"
            class="action-button secondary"
            data-copy=""
            hidden
          >Copy secundaria</button>
          <a id="priority-secondary-open" class="action-button secondary" href="#" hidden>Abrir route secundaria</a>
        </div>
        <ul id="priority-next-steps" class="handoff-list compact">
          <li>Validate token to unlock this host official recommendation.</li>
        </ul>
        <div class="priority-profile-grid">
          <article class="priority-profile-card">
            <p class="profile-tag">Dev</p>
            <strong id="priority-dev-summary">Activate the protected shell to see the ideal development route.</strong>
            <button
              id="priority-dev-action"
              type="button"
              class="action-button secondary compact-action"
              data-copy="npm run ops:go"
            >Copy Dev</button>
          </article>
          <article class="priority-profile-card">
            <p class="profile-tag">Operator</p>
            <strong id="priority-operator-summary">Enable the protected shell to see the ideal operation route.</strong>
            <button
              id="priority-operator-action"
              type="button"
              class="action-button secondary compact-action"
              data-copy="npm run ops:ready"
            >Copy Operator</button>
          </article>
          <article class="priority-profile-card">
            <p class="profile-tag">Headless</p>
            <strong id="priority-headless-summary">Activate the protected shell to see the ideal terminal route.</strong>
            <button
              id="priority-headless-action"
              type="button"
              class="action-button secondary compact-action"
              data-copy="npm run cli -- status"
            >Copy Headless</button>
          </article>
        </div>
      </section>

      <section class="handoff-card">
        <h2>Other available routes</h2>
        <p class="muted-copy section-note">
          If you of the not want to follow the main recommendation, choose the path that matches your role.
        </p>
        <div class="profile-grid">
          <article class="profile-card">
            <p class="profile-tag">Dev</p>
            <h3 id="alt-dev-title">Start the runtime and validate the contract</h3>
            <p id="alt-dev-summary">Best for development inside the official repository.</p>
            <ul id="alt-dev-steps" class="handoff-list compact">
              <li><code>npm install</code></li>
              <li><code>npm run setup</code></li>
              <li><code>npm run ops:go</code></li>
            </ul>
            <button id="alt-dev-action" type="button" class="action-button secondary compact-action" data-copy="npm run ops:go">Copy flow Dev</button>
          </article>
          <article class="profile-card">
            <p class="profile-tag">Operator</p>
            <h3 id="alt-operator-title">Prepare o host and valide a malha</h3>
            <p id="alt-operator-summary">Best for operating nodes, channels, and transports.</p>
            <ul id="alt-operator-steps" class="handoff-list compact">
              <li><code>npm run ops:ready</code></li>
              <li><code>npm run cli:fast -- doctor --json</code></li>
              <li><code>npm run test:nodes:smoke</code></li>
            </ul>
            <button id="alt-operator-action" type="button" class="action-button secondary compact-action" data-copy="npm run ops:ready">Copy flow Operator</button>
          </article>
          <article class="profile-card">
            <p class="profile-tag">Headless</p>
            <h3 id="alt-headless-title">Use the Zavorth only por terminal</h3>
            <p id="alt-headless-summary">Best for local automation, REPL, and operation without a graphical shell.</p>
            <ul id="alt-headless-steps" class="handoff-list compact">
              <li><code>npm run cli -- status</code></li>
              <li><code>npm run cli:repl</code></li>
              <li><code>npm run nodes:doctor -- --json</code></li>
            </ul>
            <button id="alt-headless-action" type="button" class="action-button secondary compact-action" data-copy="npm run cli -- status">Copy flow Headless</button>
          </article>
        </div>
      </section>

      <section class="handoff-card">
        <h2>Desbloquear orientactions of the runtime</h2>
        <p class="muted-copy">
          Validate token to see the official recommendation, installation journey, and remote state for this host.
          The token does not leave the machine; it stays only in the current browser.
        </p>
        <div class="auth-row">
          <input id="runtime-auth-token" class="auth-input" type="password" placeholder="Cole o token web of the Zavorth" autocomplete="off" />
          <button id="runtime-auth-validate" type="button" class="action-button">validate token</button>
        </div>
        <p id="runtime-auth-copy" class="muted-copy">
          Tip: after validation, the shell loads the official manifest, install journey, and remote access state.
        </p>
      </section>

      <section class="handoff-card">
        <h2>Outras entradas</h2>
        <div class="action-row">
          <a id="open-external-web-client" class="action-button" hidden href="#">Abrir client web external</a>
          <a id="open-external-docs" class="action-button secondary" hidden href="#">Abrir docs public</a>
          <a class="action-button secondary" href="/api/v1/gateway/status">Ver status public of the gateway</a>
          <a class="action-button secondary" href="/api/v1/nodes">Ver nodes as JSON</a>
        </div>
        <p id="external-web-copy" class="muted-copy">
          Configure <code>ZAVORTH_EXTERNAL_WEB_CLIENT_URL</code> when connecting an external web client to the same runtime.
        </p>
      </section>

      <section class="handoff-grid">
        <article class="handoff-card">
          <h2>O que fica in the repo oficial</h2>
          <ul class="handoff-list">
            <li>Runtime of the agente</li>
            <li>CLI and terminal oficiais</li>
            <li>API HTTP and SSE</li>
            <li>Workflows, approvals, continuity, and artifacts</li>
          </ul>
        </article>
        <article class="handoff-card">
          <h2>How to operate now</h2>
          <ul class="handoff-list">
            <li>Main entry: <code>npm run ops:go</code></li>
            <li>Ready check: <code>npm run ops:ready</code></li>
            <li>CLI: <code>npm run cli -- status</code></li>
            <li>ZavorthControl web: <code>/zavorthControl</code></li>
          </ul>
        </article>
        <article class="handoff-card">
          <h2>Snapshot rapido</h2>
          <ul class="handoff-list">
            <li>Gateway: <strong id="gateway-status-detail">Verificando</strong></li>
            <li>Dominios inicializados: <strong id="gateway-domain-detail">Detectando</strong></li>
            <li>Visible nodes: <strong id="node-count-detail">Detectando</strong></li>
            <li>Transportes: <strong id="transport-count-detail">Detectando</strong></li>
          </ul>
        </article>
        <article class="handoff-card">
          <h2>boundary of the produto</h2>
          <ul class="handoff-list">
            <li><code>/zavorthControl</code> = entrada principal of the Zavorth web</li>
            <li><code>/satellite</code> = surface movel/PWA when configured</li>
            <li><code>/api/*</code> = runtime contract for CLI, web, and future clients</li>
            <li><code>/app</code> and <code>/classic</code> = removidos; use <code>/zavorthControl</code></li>
            <li><code>zavorth-web</code> = client external, when configured</li>
            <li>Terminal and API remain at the center of the official repository</li>
          </ul>
        </article>
      </section>

      <section class="handoff-grid">
        <article id="manifest-card" class="handoff-card">
          <h2>Entradas and surfaces</h2>
          <p class="muted-copy section-note">Use this card to understand how each surface enters the product.</p>
          <ul id="manifest-launchers" class="handoff-list">
            <li>Validate token to see this host official entries and which surfaces are ready.</li>
          </ul>
        </article>
        <article id="journey-card" class="handoff-card">
          <h2>Preparar this host</h2>
          <p id="journey-card-note" class="muted-copy section-note">Use this path when the local runtime is not ready yet or this host still needs trust.</p>
          <div class="action-row compact-remote-actions">
            <button id="journey-trust-action" type="button" class="action-button" hidden>Autorizar this host</button>
            <button id="journey-refresh-action" type="button" class="action-button secondary" hidden>Atualizar host</button>
          </div>
          <p id="journey-action-status" class="muted-copy section-note">Validate token to use official host actions.</p>
          <ul id="install-journey" class="handoff-list">
            <li>Validate token to see this host official path stages.</li>
          </ul>
        </article>
        <article id="remote-card" class="handoff-card">
          <h2>Abrir access remote</h2>
          <p id="remote-card-note" class="muted-copy section-note">Use this path when you want to operate outside this machine or publish the official remote shell.</p>
          <div class="action-row compact-remote-actions">
            <button id="remote-recommended-action" type="button" class="action-button" hidden>Run next step remote</button>
            <button id="remote-verify-action" type="button" class="action-button secondary" hidden>Verificar remote</button>
          </div>
          <p id="remote-action-status" class="muted-copy section-note">Validate the token to use the guided action from the official remote.</p>
          <ul id="remote-access-summary" class="handoff-list">
            <li>Validate token to see official remote state, recommended command, and next steps.</li>
          </ul>
        </article>
      </section>

      <section id="automation-control-plane-card" class="handoff-card">
        <p class="profile-tag">Scheduled runs</p>
        <h2>Automations and scheduled runs</h2>
        <p class="muted-copy section-note">
          This reading aggregates natural automations, recurring maintenance, deliveries by surface and scheduled runs state in a single cockpit.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Automations</p>
            <strong id="automation-control-plane-state">Validate token</strong>
            <p id="automation-control-plane-summary" class="muted-copy">
              The official automation plan appears here as soon as the protected shell is unlocked.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Tasks</p>
            <strong id="automation-control-plane-tasks-state">No reading</strong>
            <p id="automation-control-plane-tasks-summary" class="muted-copy">
              Agendamentos actives, pausados and with failure recente aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Maintenance</p>
            <strong id="automation-control-plane-maintenance-state">No reading</strong>
            <p id="automation-control-plane-maintenance-summary" class="muted-copy">
              Recurring maintenance and its next trigger appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Deliveries</p>
            <strong id="automation-control-plane-deliveries-state">No reading</strong>
            <p id="automation-control-plane-deliveries-summary" class="muted-copy">
              App, email and webhook recentes aparecem como entregas supervised.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <input id="automation-control-plane-intent" type="text" class="field-input compact-inline-input" placeholder="Describe the cadence and action naturally" />
          <button id="automation-control-plane-create-action" type="button" class="action-button" hidden>Create automation</button>
          <button id="automation-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Scheduled runs</button>
          <button id="automation-control-plane-maintenance-on-action" type="button" class="action-button secondary compact-action" hidden>Ligar maintenance</button>
          <button id="automation-control-plane-maintenance-off-action" type="button" class="action-button secondary compact-action" hidden>Desligar maintenance</button>
          <button id="automation-control-plane-maintenance-run-action" type="button" class="action-button secondary compact-action" hidden>run maintenance</button>
          <button id="automation-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:automations">Copy ops:automations</button>
        </div>
        <p id="automation-control-plane-status" class="muted-copy section-note">
          Validate the token to create automations, review deliveries, and operate maintenance.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="automation-control-plane-actions" class="handoff-list compact">
              <li>Validate token to review the next automation step.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Tasks</p>
            <ul id="automation-control-plane-tasks" class="handoff-list compact">
              <li>Validate token to see this host scheduled runs.</li>
            </ul>`;
}
