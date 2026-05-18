/**
 * Zavorth Gateway sector content.
 * Static placeholders stay honest; runtime-bridge replaces them with live data.
 */
(function () {
  'use strict';

  populate('sector-overview', `
    <div class="dashboard-glass">
      <section class="dashboard-hero" aria-label="Zavorth gateway overview">
        <div class="dashboard-hero__copy">
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Gateway</span>
          <h1 class="dashboard-title">Zavorth is ready.</h1>
          <p class="dashboard-subtitle">Start with a plain request. Zavorth previews risky work, asks for scoped approval when needed, and leaves a receipt behind.</p>
        </div>
        <div class="dashboard-hero__chips" aria-label="Runtime summary">
          <span class="badge badge--ok"><span class="badge__dot"></span>Local runtime</span>
          <span class="badge badge--info"><span class="badge__dot"></span>Approvals on</span>
          <span class="badge badge--muted"><span class="badge__dot"></span>Receipts on</span>
        </div>
      </section>

      <section class="dashboard-next-actions" aria-label="Recommended next actions">
        <button class="dashboard-action-card" type="button" data-dashboard-prompt="Review this workspace safely">
          <span>Start a mission</span>
          <strong>Review this workspace safely</strong>
        </button>
        <button class="dashboard-action-card" type="button" data-dashboard-prompt="What providers and channels are ready right now?">
          <span>Check readiness</span>
          <strong>Providers and channels</strong>
        </button>
        <button class="dashboard-action-card" type="button" data-dashboard-sector="channels">
          <span>Open surface</span>
          <strong>Channel Mesh</strong>
        </button>
        <button class="dashboard-action-card" type="button" data-dashboard-prompt="Show pending approvals and recent receipts">
          <span>Review safety</span>
          <strong>Approvals and receipts</strong>
        </button>
      </section>

      <section class="dashboard-mosaic" aria-label="Operational summary">
        <article class="dashboard-primary">
          <div class="dashboard-primary__copy">
            <span class="dashboard-card__label">Current state</span>
            <h2 class="dashboard-card__title" data-dashboard-runtime-title>Waiting for a mission</h2>
            <p class="dashboard-card__text" data-dashboard-runtime-text>Use the chat tab to ask naturally. If a request needs write access, external delivery or sensitive network activity, Zavorth will preview it and ask for scoped approval.</p>
          </div>
          <div class="dashboard-fox" aria-hidden="true">
            <img src="./assets/fox-semfundo.png" alt="">
          </div>
        </article>

        <article class="dashboard-card dashboard-card--metric">
          <div class="dashboard-card__header">
            <span class="dashboard-card__label">Missions</span>
            <span class="dashboard-pill">local</span>
          </div>
          <span class="dashboard-card__value" data-dashboard-metric="runs">0</span>
          <span class="dashboard-card__meta" data-dashboard-meta="runs">no active mission</span>
        </article>

        <article class="dashboard-card dashboard-card--metric">
          <div class="dashboard-card__header">
            <span class="dashboard-card__label">Approvals</span>
            <span class="dashboard-pill dashboard-pill--warm">policy</span>
          </div>
          <span class="dashboard-card__value" data-dashboard-metric="approvals">0</span>
          <span class="dashboard-card__meta" data-dashboard-meta="approvals">no pending decision</span>
        </article>

        <article class="dashboard-card dashboard-card--metric">
          <div class="dashboard-card__header">
            <span class="dashboard-card__label">Artifacts</span>
            <span class="dashboard-pill">receipt</span>
          </div>
          <span class="dashboard-card__value" data-dashboard-metric="artifacts">0</span>
          <span class="dashboard-card__meta" data-dashboard-meta="artifacts">none in this session</span>
        </article>

        <article class="dashboard-card dashboard-card--mesh">
          <div class="dashboard-card__header">
            <span class="dashboard-card__label">Readiness</span>
            <span class="dashboard-pill dashboard-pill--safe">honest</span>
          </div>
          <div class="dashboard-status-list">
            <div class="dashboard-status-row"><span>Sandbox</span><strong data-dashboard-remote="docker">dry-run fallback</strong></div>
            <div class="dashboard-status-row"><span>Providers</span><strong data-dashboard-remote="mcp">ask or open Models</strong></div>
            <div class="dashboard-status-row"><span>Channels</span><strong data-dashboard-remote="files">ask or open Channels</strong></div>
          </div>
        </article>

        <article class="dashboard-card dashboard-card--trace">
          <div class="dashboard-card__header">
            <span class="dashboard-card__label">Latest signals</span>
            <span class="dashboard-pill">live</span>
          </div>
          <div class="dashboard-mini-timeline" data-dashboard-timeline>
            <div class="dashboard-timeline-item"><span></span><p>Gateway loaded</p><strong>now</strong></div>
            <div class="dashboard-timeline-item"><span></span><p>Runtime waiting for a request</p><strong>idle</strong></div>
            <div class="dashboard-timeline-item"><span></span><p>Receipts ready when actions run</p><strong>ready</strong></div>
          </div>
        </article>
      </section>

      <section class="dashboard-daily-grid" aria-label="Daily operation">
        <article class="dashboard-inbox dashboard-approval-inbox">
          <div class="dashboard-card__header">
            <span class="dashboard-card__label">Approvals inbox</span>
            <span class="dashboard-pill dashboard-pill--warm">scoped</span>
          </div>
          <div class="dashboard-inbox__body">
            <p>No pending approvals. When Zavorth needs write access, network delivery, device control or live bridge use, the decision appears here first.</p>
          </div>
        </article>

        <article class="dashboard-inbox dashboard-receipt-list">
          <div class="dashboard-card__header">
            <span class="dashboard-card__label">Recent receipts</span>
            <span class="dashboard-pill">evidence</span>
          </div>
          <div class="dashboard-inbox__body">
            <p>No receipt in this session yet. Completed missions will summarize files touched, tools used, blocked risks, artifacts and rollback evidence.</p>
          </div>
        </article>

        <article class="dashboard-inbox dashboard-mission-timeline">
          <div class="dashboard-card__header">
            <span class="dashboard-card__label">Mission timeline</span>
            <span class="dashboard-pill dashboard-pill--safe">traceable</span>
          </div>
          <div class="dashboard-mini-timeline" data-dashboard-timeline="mission">
            <div class="dashboard-timeline-item"><span></span><p>Waiting for a mission</p><strong>idle</strong></div>
            <div class="dashboard-timeline-item"><span></span><p>Preview, approval and receipt stay in sequence</p><strong>ready</strong></div>
          </div>
        </article>
      </section>

      <section class="dashboard-strip" aria-label="Daily-use guardrails">
        <div class="dashboard-strip__item"><span class="dashboard-strip__key">Status</span><strong data-dashboard-strip="status">online</strong><span data-dashboard-strip-detail="status">local gateway available</span></div>
        <div class="dashboard-strip__item"><span class="dashboard-strip__key">Model</span><strong data-dashboard-strip="model">selected by runtime</strong><span data-dashboard-strip-detail="model">provider readiness is verified before live use</span></div>
        <div class="dashboard-strip__item"><span class="dashboard-strip__key">Sandbox</span><strong data-dashboard-strip="budget">preview first</strong><span data-dashboard-strip-detail="budget">mutations need strong sandbox or approval</span></div>
        <div class="dashboard-strip__item"><span class="dashboard-strip__key">Safety</span><strong data-dashboard-strip="security">policy gated</strong><span data-dashboard-strip-detail="security">preview, approval and receipt stay central</span></div>
      </section>

      <details class="dashboard-advanced">
        <summary>Advanced runtime details</summary>
        <div class="dashboard-advanced__grid">
          <div><span>Authority</span><strong>Runtime only</strong><small>The dashboard displays decisions and requests actions; it does not execute mutations directly.</small></div>
          <div><span>Policy</span><strong>Broker gated</strong><small>Workspace writes, external delivery, device control and sensitive network use stay approval-bound.</small></div>
          <div><span>Mode</span><strong>Preview first</strong><small>When sandbox readiness is missing, mutable work remains dry-run until explicitly approved.</small></div>
        </div>
      </details>
    </div>
  `);

  populate('sector-channels', `
    <div class="page-header"><h1 class="page-title">Channels</h1><p class="page-subtitle">Channel readiness reported by the governed gateway. Ask Zavorth for a natural summary when you do not need the table.</p></div>
    <div class="card-grid">
      ${channelCard('Dashboard Gateway', 'web:/dashboard', 'Local', 'info', 'Primary local web surface. It displays state and decisions; execution stays in the runtime.')}
      ${channelCard('Realtime events', '/api/web/events', 'Waiting', 'info', 'Live stream attaches when the local runtime exposes an unlocked session snapshot.')}
      ${channelCard('External channels', 'Telegram / CLI / API', 'No live snapshot', 'muted', 'No external channel has reported a live state in this tab yet.')}
    </div>
  `);

  populate('sector-sales-os', `
    <div class="page-header">
      <h1 class="page-title">Sales OS</h1>
      <p class="page-subtitle">Governed sales inbox, CRM signals, official channels, policy and audit trail.</p>
    </div>
    <div class="stats-grid">
      <div class="summary-card summary-card--hero summary-card--accent"><span class="summary-card__label">Inbox</span><span class="summary-card__value" data-sales-os-metric="conversations">0</span><span class="summary-card__sub" data-sales-os-meta="conversations">no inbound conversation</span></div>
      <div class="summary-card"><span class="summary-card__label">Lead score</span><span class="summary-card__value" data-sales-os-metric="score">0</span><span class="summary-card__sub" data-sales-os-meta="score">waiting for signal</span></div>
      <div class="summary-card"><span class="summary-card__label">Channel I/O</span><span class="summary-card__value" data-sales-os-metric="processed">0</span><span class="summary-card__sub" data-sales-os-meta="processed">0 inbound messages</span></div>
      <div class="summary-card"><span class="summary-card__label">Governance</span><span class="summary-card__value" data-sales-os-metric="approvals">0</span><span class="summary-card__sub" data-sales-os-meta="approvals">no pending approval</span></div>
    </div>
    <div class="card-grid" data-sales-os-grid>
      ${channelCard('Unified inbox', 'conversations', 'Demo ready', 'info', 'Receive local inbound or WhatsApp Cloud API events and track the lead in the Sales Pack.')}
      ${channelCard('CRM intelligence', 'lead score', 'Waiting for signal', 'info', 'Intent, objection, risk and next action appear after the first conversation.')}
      ${channelCard('Channel I/O', 'stub / cloud-api', 'Local', 'info', 'Idempotency, status and receipts stay visible in the channel ledger.')}
      ${channelCard('Agent Builder', 'AgentProfile', '5 profiles', 'info', 'Sales, support, recovery, CRM and supervisor profiles enter through core contracts.')}
    </div>
    <div class="callout info">
      <strong>Demo mode:</strong> simulate a WhatsApp message locally without real credentials.
      <button class="core-btn core-btn--primary" type="button" data-sales-os-action="demo-inbound">Create local conversation</button>
    </div>
  `);

  populate('sector-instances', `
    <div class="page-header"><h1 class="page-title">Nodes</h1><p class="page-subtitle">Runtime instances known to the gateway.</p></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Host</th><th>PID</th><th>Memory</th><th>Uptime</th><th>Status</th></tr></thead><tbody>
      <tr><td class="mono">zavorth-web</td><td class="mono">local</td><td class="mono">-</td><td>-</td><td>-</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting for runtime</span></td></tr>
      <tr><td class="mono">agent-gateway</td><td class="mono">runtime</td><td class="mono">-</td><td>-</td><td>-</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting for snapshot</span></td></tr>
    </tbody></table></div>
  `);

  populate('sector-sessions', `
    <div class="page-header"><h1 class="page-title">Sessions</h1><p class="page-subtitle">Conversation and execution history.</p></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Run</th><th>Channel</th><th>Events</th><th>Artifacts</th><th>Next action</th><th>Updated</th><th>Status</th></tr></thead><tbody>
      <tr><td class="mono">local runtime</td><td>Web</td><td>0</td><td>-</td><td>Wait for first mission</td><td>now</td><td><span class="badge badge--info"><span class="badge__dot"></span>Ready</span></td></tr>
    </tbody></table></div>
  `);

  populate('sector-usage', `
    <div class="page-header"><h1 class="page-title">Usage</h1><p class="page-subtitle">Known runtime consumption and operational signals.</p></div>
    <div class="stats-grid">
      <div class="summary-card summary-card--hero summary-card--accent"><span class="summary-card__label">Runs</span><span class="summary-card__value">0</span><span class="summary-card__sub">no execution recorded</span></div>
      <div class="summary-card"><span class="summary-card__label">Current model</span><span class="summary-card__value">-</span><span class="summary-card__sub">waiting for runtime selection</span></div>
      <div class="summary-card"><span class="summary-card__label">Artifacts</span><span class="summary-card__value">0</span><span class="summary-card__sub">none in this session</span></div>
      <div class="summary-card"><span class="summary-card__label">Approvals</span><span class="summary-card__value">0</span><span class="summary-card__sub">no pending decision</span></div>
    </div>
    <h3 class="section-title">Model Consumption</h3>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Model</th><th>Runs</th><th>Events</th><th>Artifacts</th><th>Status</th></tr></thead><tbody>
      <tr><td class="mono">current model</td><td>0</td><td>0</td><td>0</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting for run</span></td></tr>
    </tbody></table></div>
    <div class="chart-placeholder"><div class="empty-state"><div class="empty-state__icon">o</div><div class="empty-state__title">No token curve yet</div><div class="empty-state__desc">This area stays empty until the runtime publishes token or cost measurements.</div></div></div>
  `);

  populate('sector-agents', `
    <div class="page-header"><h1 class="page-title">Agents</h1><p class="page-subtitle">Agent Gateway executions.</p></div>
    <div class="card-grid">
      ${agentCard('Agent Gateway', 'No live run has been registered yet. When you talk to Zavorth, executions appear here.', 'Waiting', false, 'current model')}
    </div>
  `);

  populate('sector-skills', `
    <div class="page-header"><h1 class="page-title">Skills</h1><p class="page-subtitle">Governed skills and tools exposed to active runs.</p></div>
    <div class="card-grid">
      ${skillCard('Active run tools', 'No tools are exposed by an active run right now.', false)}
    </div>
  `);

  populate('sector-nodes', `
    <div class="page-header"><h1 class="page-title">Network</h1><p class="page-subtitle">Nodes and companions connected to the runtime.</p></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Node</th><th>Type</th><th>Processes</th><th>Memory</th><th>Summary</th><th>Actions</th><th>Status</th></tr></thead><tbody>
      <tr><td class="mono">companions</td><td>Runtime</td><td>0</td><td>-</td><td>Waiting for live snapshot</td><td>-</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
    </tbody></table></div>
  `);

  populate('sector-dreams', `
    <div class="dreams">
      <img class="dreams__mascot dreams__mascot-img" src="./assets/fox-semfundo.png" alt="Zavorth fox resting">
      <span class="dreams__z">z</span><span class="dreams__z">z</span><span class="dreams__z">z</span>
      <div class="dreams__status">
        <span class="dreams__status-label">Rest mode</span>
        <span class="dreams__status-detail"><span class="dreams__status-dot"></span>Memory consolidation waits for real data</span>
      </div>
      <div class="dreams__phases">
        <div class="dreams__phase"><span class="dreams__phase-dot dreams__phase-dot--on"></span><span class="dreams__phase-name">Consolidation</span><span class="dreams__phase-next">waiting for data</span></div>
        <div class="dreams__phase"><span class="dreams__phase-dot"></span><span class="dreams__phase-name">Compaction</span><span class="dreams__phase-next">not scheduled</span></div>
        <div class="dreams__phase"><span class="dreams__phase-dot"></span><span class="dreams__phase-name">Cleanup</span><span class="dreams__phase-next">not scheduled</span></div>
      </div>
    </div>
  `);

  populate('sector-config', `
    <div class="config-layout">
      <div class="config-main">
        <div class="config-top-tabs">
          <button class="config-tab active">General</button><button class="config-tab">Models</button><button class="config-tab">Appearance</button><button class="config-tab">Security</button><button class="config-tab">Advanced</button>
        </div>
        <div class="config-section-hero">
          <div class="config-section-hero__icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4"/></svg></div>
          <div class="config-section-hero__text"><span class="config-section-hero__title">Gateway Settings</span><span class="config-section-hero__desc">Local endpoint, runtime defaults and security state.</span></div>
        </div>
        <div class="config-content">
          <div class="config-form">
            <div class="config-form-section"><span class="config-form-section__title">Gateway</span>
              <div class="info-grid">
                <div class="info-row"><span class="info-row__label">Endpoint</span><span class="info-row__value mono">/api</span></div>
                <div class="info-row"><span class="info-row__label">Auth</span><span class="info-row__value mono">local session</span></div>
                <div class="info-row"><span class="info-row__label">Protocol</span><span class="info-row__value">local runtime</span></div>
                <div class="info-row"><span class="info-row__label">Status</span><span class="info-row__value"><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></span></div>
              </div>
            </div>
            <div class="config-form-section"><span class="config-form-section__title">Default Model</span>
              <div class="info-grid">
                <div class="info-row"><span class="info-row__label">Chat</span><span class="info-row__value mono">current model</span></div>
                <div class="info-row"><span class="info-row__label">Agents</span><span class="info-row__value mono">current model</span></div>
                <div class="info-row"><span class="info-row__label">Fallback</span><span class="info-row__value mono">not configured</span></div>
              </div>
            </div>
            <div class="config-form-section"><span class="config-form-section__title">Provider & Model Catalog</span>
              <div class="info-grid" data-provider-model-catalog-summary>
                <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Live</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">loading</span></div>
              </div>
              <div class="card-grid" data-provider-model-catalog-list style="margin-top:12px">
                <div class="entity-card"><div class="entity-card__header"><div><div class="entity-card__name">Catalog loading</div><div class="entity-card__id">read-only</div></div><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></div><div class="entity-card__desc">Provider routes, model surface and live proof will appear here without hidden provider calls.</div></div>
              </div>
            </div>
            <div class="config-form-section"><span class="config-form-section__title">Provider Activation</span>
              <div class="info-grid" data-provider-activation-summary>
                <div class="info-row"><span class="info-row__label">Execution</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Proof</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Adapters</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Connectors</span><span class="info-row__value mono">loading</span></div>
              </div>
              <div class="card-grid" data-provider-activation-list style="margin-top:12px">
                <div class="entity-card"><div class="entity-card__header"><div><div class="entity-card__name">Activation loading</div><div class="entity-card__id">read-only</div></div><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></div><div class="entity-card__desc">Activation status, live-proof commands and connector gaps will appear here without hidden live calls.</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  populate('sector-docs', `
    <div class="page-header"><h1 class="page-title">Docs</h1><p class="page-subtitle">Technical reference for the local runtime.</p></div>
    <div class="callout info">Local project docs remain the source of truth while the gateway renders live runtime state.</div>
    <div class="card-grid">
      ${docCard('Quickstart', 'Install, configure the gateway and run the first safe mission.', '5 min')}
      ${docCard('Dashboard Gateway', 'How this surface reads runs, approvals, artifacts and events.', '8 min')}
      ${docCard('Runtime API', 'Execution contracts, replay and durable queue.', '12 min')}
      ${docCard('Security', 'Sandboxing, approvals and governed agent behavior.', '6 min')}
    </div>
  `);

  populate('sector-cron', `
    <div class="page-header"><h1 class="page-title">Scheduled Tasks</h1><p class="page-subtitle">Durable jobs known to the runtime.</p></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Job</th><th>Type</th><th>Attempts</th><th>Next</th><th>Updated</th><th>Status</th></tr></thead><tbody>
      <tr><td class="mono">workflow queue</td><td>local durable</td><td>0</td><td>-</td><td>now</td><td><span class="badge badge--info"><span class="badge__dot"></span>No live jobs</span></td></tr>
    </tbody></table></div>
  `);

  function populate(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function channelCard(name, id, status, type, detail) {
    return `<div class="entity-card"><div class="entity-card__header"><div><div class="entity-card__name">${name}</div><div class="entity-card__id">${id}</div></div><span class="badge badge--${type}"><span class="badge__dot"></span>${status}</span></div><div class="entity-card__desc">${detail}</div></div>`;
  }

  function agentCard(name, desc, status, enabled, model) {
    const t = status === 'Running' ? 'ok' : status === 'Idle' || status === 'Waiting' ? 'info' : 'muted';
    return `<div class="entity-card"><div class="entity-card__header"><div><div class="entity-card__name">${name}</div></div><span class="badge badge--${t}"><span class="badge__dot"></span>${status}</span></div><div class="entity-card__desc">${desc}</div><div class="entity-card__meta"><span class="badge badge--muted">${model}</span><div class="entity-card__toggle"><input type="checkbox" class="toggle-switch" ${enabled ? 'checked' : ''}><span style="font-size:12px;color:var(--b-signal-muted)">${enabled ? 'Active' : 'Inactive'}</span></div></div></div>`;
  }

  function skillCard(name, desc, enabled) {
    return `<div class="entity-card"><div class="entity-card__header"><div class="entity-card__name" style="font-family:var(--b-mono);font-size:13px">${name}</div><div class="entity-card__toggle"><input type="checkbox" class="toggle-switch" ${enabled ? 'checked' : ''}></div></div><div class="entity-card__desc">${desc}</div></div>`;
  }

  function docCard(title, desc, time) {
    return `<div class="entity-card" style="cursor:pointer"><div class="entity-card__name">${title}</div><div class="entity-card__desc">${desc}</div><span class="badge badge--muted">${time} read</span></div>`;
  }

  window.ZavorthCommandCenterChat?.refreshDashboard?.();

  document.querySelectorAll('.config-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tab.parentElement.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  document.querySelectorAll('[data-dashboard-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById('compose-input');
      const prompt = button.getAttribute('data-dashboard-prompt') || '';
      document.querySelector('[data-sector="terminal"]')?.click();
      if (input) {
        input.value = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }
    });
  });

  document.querySelectorAll('[data-dashboard-sector]').forEach(button => {
    button.addEventListener('click', () => {
      const sector = button.getAttribute('data-dashboard-sector');
      if (sector) document.querySelector(`[data-sector="${sector}"]`)?.click();
    });
  });
})();
