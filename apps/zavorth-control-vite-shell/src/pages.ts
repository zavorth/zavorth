/**
 * Zavorth Control pages.
 * Static placeholders stay honest; runtime-bridge replaces them with live data.
 * runtime adapter control remains an explicit setup/advanced surface, not a chat-first nag.
 */
import { CONTROL_LOCALES, readControlLocalePreference } from './locale';
import { initLearningDreamsUi } from './learning-dreams-ui';
import { initMemoryBrowserUi } from './memory-browser-ui';
import { initPolicySimulatorUi } from './policy-simulator-ui';
import { initRuntimeEngineUi } from './runtime-engines-ui';

declare global {
  interface Window {
    ZavorthControlChat?: {
      refreshDashboard?: () => void;
    };
    emitSignal?: (type: string, title: string, message?: string) => void;
  }
}

export function initControlPages() {

  populate('sector-overview', `
    <div class="daily-page daily-page--work dashboard-glass" data-zavorth-premium-dashboard-v2>
      ${dailyHeader('Work', '', `
        <button class="daily-button daily-button--primary" type="button" data-dashboard-sector="terminal">Open chat</button>
        <button class="daily-button" type="button" data-dashboard-sector="sales-os">Review</button>
        <button class="daily-button" type="button" data-dashboard-sector="instances">Receipts</button>
        <button class="daily-button" type="button" data-dashboard-prompt="Run doctor health check. Show only missing setup, failed routes, and the next fix.">Doctor</button>
      `)}
      <section class="daily-panel daily-panel--attention" aria-label="Attention">
        <div class="daily-panel__head">
          <div><span>Attention</span><h2 data-dashboard-approval-title>Nothing needs you</h2></div>
          <button class="daily-button" type="button" data-dashboard-sector="sales-os">Review</button>
        </div>
        <div data-attention-list class="daily-list">
          <p class="daily-muted">Nothing needs you</p>
        </div>
      </section>
      <section class="daily-action-row" aria-label="Primary actions">
        <button type="button" data-dashboard-sector="terminal">New chat</button>
        <button type="button" data-dashboard-sector="sales-os">Approvals</button>
        <button type="button" data-dashboard-sector="instances">Receipts</button>
        <button type="button" data-dashboard-sector="channels">Channels</button>
        <button type="button" data-dashboard-sector="usage">Models</button>
      </section>
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Work status">
        ${dailyMetric('Status', '<span data-live-runtime-state>Ready</span>', '<span data-live-runtime-detail>Idle</span>')}
        ${dailyMetric('Approvals pending', '<span data-sales-os-metric="approvals">0</span>', '<span data-sales-os-meta="approvals">None</span>')}
        ${dailyMetric('Receipts', '<span data-dashboard-metric="receipts">0</span>', '<span data-inbox-metric="receipts">0</span>')}
        ${dailyMetric('Errors', '<span data-dashboard-metric="errors">0</span>', 'Trace')}
        ${dailyMetric('Trust', '<span id="session-trust-score" class="session-trust-score" data-session-trust-score><strong data-session-trust-value>100</strong> <span data-session-trust-label>Governed</span></span>', 'Session')}
      </section>
      <section class="workboard-lite" data-workboard-lite aria-label="Workboard">
        <div class="workboard-lite__col" data-workboard-col="pending">
          <h3>Pending</h3>
          <ul data-workboard-list="pending"><li class="daily-muted">—</li></ul>
        </div>
        <div class="workboard-lite__col" data-workboard-col="running">
          <h3>Running</h3>
          <ul data-workboard-list="running"><li class="daily-muted">—</li></ul>
        </div>
        <div class="workboard-lite__col" data-workboard-col="done">
          <h3>Done</h3>
          <ul data-workboard-list="done"><li class="daily-muted">—</li></ul>
        </div>
      </section>
      <div class="agent-os-live-summary" hidden aria-hidden="true">Runtime summary is available to the live bridge.</div>
      <section class="daily-layout daily-layout--main" aria-label="Work overview">
        <article class="daily-panel daily-panel--primary">
          <div class="daily-panel__head">
            <div>
              <span>Now</span>
              <h2 data-dashboard-runtime-title>No task running</h2>
            </div>
            <button class="daily-button" type="button" data-dashboard-sector="terminal">Open chat</button>
          </div>
          <p class="daily-muted" data-dashboard-runtime-text>Ready.</p>
          <div class="zavorth-gantt-chart" data-dashboard-timeline aria-label="Runtime trace timeline">
            <div class="zavorth-gantt-empty">
              <span class="zavorth-gantt-empty-dot"></span>
              <span>No trace yet.</span>
            </div>
          </div>
          <details class="daily-disclosure daily-disclosure--quiet">
            <summary>Logs</summary>
            <div class="zavorth-console-panel daily-console">
              <div class="zavorth-console-header">
                <span class="zavorth-console-dot"></span>
                <span class="zavorth-console-title">Live log</span>
                <button class="zavorth-console-clear" type="button">Clear</button>
              </div>
              <div class="zavorth-console-body" id="zavorth-console-events">
                <div class="zavorth-console-line zavorth-console-line--system">
                  <span class="zavorth-console-time">[00:00]</span>
                  <span class="zavorth-console-tag">[SESSION]</span>
                  <span class="zavorth-console-text">Dashboard connected.</span>
                </div>
              </div>
            </div>
          </details>
        </article>
        <aside class="daily-stack">
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>System</span><h2>Connection</h2></div></div>
            <div class="daily-key-value">
              ${dailyKeyValue('Runtime', '<span data-live-runtime-state>Ready</span>')}
              ${dailyKeyValue('Gateway', '<span data-live-gateway-state>Local</span>')}
              ${dailyKeyValue('Route', '<span data-live-gateway-detail>Web</span>')}
              ${dailyKeyValue('Sync', '<span data-live-sync-detail>Starting</span>')}
              ${dailyKeyValue('Mode', '<span data-runtime-engine-active>Lite</span>')}
            </div>
            <p class="daily-muted" hidden data-dashboard-approval-text>Nothing pending.</p>
          </article>
          <article class="daily-panel" data-policy-simulator>
            <div class="daily-panel__head"><div><span>Policy</span><h2>Simulator</h2></div></div>
            <div class="policy-sim-row">
              <input type="text" data-policy-sim-input placeholder="What if I ask..." aria-label="Policy what-if prompt" autocomplete="off">
              <button class="daily-button" type="button" data-policy-sim-run>Simulate</button>
            </div>
            <ul class="policy-sim-results" data-policy-sim-results>
              <li class="daily-muted">Predicted gates appear here.</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  `);

  populate('sector-channels', `
    <div class="daily-page">
      ${dailyHeader('Channels', '', '<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Connect a channel. Show only missing credentials and the next setup step.">Connect</button><button class="daily-button" type="button" data-dashboard-prompt="Test configured channels and show only failures or missing credentials.">Test</button>')}
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Channel status">
        ${dailyMetric('Connected', 'Local', 'Web / terminal')}
        ${dailyMetric('Remote', 'Optional', 'Token / webhook')}
        ${dailyMetric('Last message', 'None', '—')}
      </section>
      <section class="daily-panel daily-panel--list daily-panel--flush">
        <div class="daily-panel__head">
          <div><span>Channels</span><h2>Routes</h2></div>
        </div>
        <div class="daily-list daily-list--compact">
          ${channelRow('Dashboard', 'Local', 'Ready', 'ok', 'Open', 'Test', 'Open the local dashboard chat.')}
          ${channelRow('Telegram', 'Bot token', 'Set up', 'warn', 'Connect', 'Test', 'Connect Telegram. Show only missing credentials.')}
          ${channelRow('Discord', 'Bot / app', 'Set up', 'warn', 'Connect', 'Test', 'Connect Discord. Show only missing credentials.')}
          ${channelRow('Slack', 'Workspace', 'Set up', 'warn', 'Connect', 'Test', 'Connect Slack. Show only missing credentials.')}
          ${channelRow('WhatsApp', 'Bridge', 'Set up', 'warn', 'Connect', 'Test', 'Connect WhatsApp. Show only missing credentials.')}
          ${channelRow('Email', 'Mailbox', 'Set up', 'warn', 'Connect', 'Test', 'Connect email. Show only missing credentials.')}
          ${channelRow('Signal', 'Bridge', 'Set up', 'warn', 'Connect', 'Test', 'Connect Signal. Show only missing credentials.')}
          ${channelRow('Teams', 'App', 'Set up', 'warn', 'Connect', 'Test', 'Connect Teams. Show only missing credentials.')}
        </div>
      </section>
    </div>
  `);

  populate('sector-sales-os', `
    <div class="daily-page">
      ${dailyHeader('Approvals', '', '<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Show pending approvals with approve, reject and limit controls.">Review</button>')}
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Approval status">
        ${dailyMetric('Pending', '<span data-sales-os-metric="approvals">0</span>', '<span data-sales-os-meta="approvals">None</span>')}
      </section>
      <section class="daily-panel daily-panel--primary">
        <div class="daily-panel__head">
          <div><span>Queue</span><h2 data-dashboard-approval-title>No decision waiting</h2></div>
          <button class="daily-button" type="button" data-dashboard-sector="terminal">Open chat</button>
        </div>
        <div data-approvals-queue class="daily-list">
          <p class="daily-muted" data-dashboard-approval-text>Nothing pending.</p>
          <button class="daily-button" type="button" data-dashboard-sector="terminal">Open chat</button>
        </div>
      </section>
    </div>
  `);

  populate('sector-instances', `
    <div class="daily-page">
      ${dailyHeader('Receipts', '', `
        <button class="daily-button daily-button--primary" type="button" data-export-receipts data-dashboard-prompt="Export recent receipts and run history.">Export</button>
        <button class="daily-button" type="button" data-dashboard-sector="terminal">Open chat</button>
      `)}
      <section class="daily-panel daily-panel--primary">
        <div class="daily-panel__head">
          <div><span>History</span><h2 data-history-title>No completed work yet</h2></div>
        </div>
        <p class="daily-muted" data-history-summary hidden></p>
        <div class="data-table-wrap" data-receipts-list>
          <table class="data-table">
            <thead>
              <tr><th>Item</th><th>Source</th><th>Artifacts</th><th>Decision</th><th>Updated</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td class="mono">none yet</td><td>Web</td><td>0</td><td>—</td><td>-</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `);

  populate('sector-sessions', `
    <div class="daily-page">
      ${dailyHeader('Sessions', '', '<button class="daily-button daily-button--primary" type="button" data-dashboard-sector="terminal">Open chat</button>')}
      <section class="daily-toolbar" aria-label="Session filters">
        <input type="search" placeholder="Search sessions" aria-label="Search sessions" data-session-search>
      </section>
      <section class="daily-panel daily-panel--flush">
        <div class="data-table-wrap">
          <table class="data-table" data-sessions-table>
            <thead>
              <tr><th>Session</th><th>Channel</th><th>Events</th><th>Receipts</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td class="mono">main</td><td>Web</td><td>0</td><td>0</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `);

  populate('sector-usage', `
    <div class="daily-page">
      ${dailyHeader('Models', '', '<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Test the active provider route with a sanitized request.">Test route</button>')}
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Model status">
        ${dailyMetric('Active route', 'Auto', '<span data-provider-picker="active">Configured</span>')}
        ${dailyMetric('Fallbacks', '<span data-provider-picker="fallbacks">Live</span>', 'Ready routes')}
        ${dailyMetric('Proof', '<span data-provider-picker="proof">Sanitized</span>', 'Redacted')}
      </section>
      <section class="daily-panel daily-panel--list daily-panel--flush">
        <div class="daily-panel__head">
          <div><span>Catalog</span><h2>Routes</h2></div>
          <button class="daily-button" type="button" data-dashboard-prompt="Show the active model route, fallback, and anything that still needs setup.">Details</button>
        </div>
        <div class="daily-provider-summary" data-provider-model-catalog-summary>
          <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">loading</span></div>
          <div class="info-row"><span class="info-row__label">Ready</span><span class="info-row__value mono">loading</span></div>
          <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">loading</span></div>
          <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">loading</span></div>
        </div>
        <div class="daily-card-feed" data-provider-model-catalog-list></div>
      </section>
    </div>
  `);

  populate('sector-agents', `
    <div class="daily-page runtime-adapter-dashboard">
      ${dailyHeader('Agents', 'Use local runtime adapters through governed policies.', '<button class="daily-button daily-button--primary" type="button" data-runtime-adapter-action="refresh">Sync</button>')}
      <section class="daily-stat-row" aria-label="Runtime adapter status">
        ${dailyMetric('Profiles', '<span data-runtime-adapter-metric="profiles">0</span>', '<span data-runtime-adapter-meta="profiles">registered</span>')}
        ${dailyMetric('Live', '<span data-runtime-adapter-metric="live">0</span>', '<span data-runtime-adapter-meta="live">approval gated</span>')}
        ${dailyMetric('Sandbox', '<span data-runtime-adapter-metric="sandbox">0</span>', '<span data-runtime-adapter-meta="sandbox">isolated</span>')}
        ${dailyMetric('Receipt', '<span data-runtime-adapter-metric="receipt">none</span>', '<span data-runtime-adapter-meta="receipt">latest</span>')}
      </section>
      <section class="daily-layout daily-layout--main">
        <article class="daily-panel daily-panel--primary">
          <div class="daily-panel__head">
            <div><span>Profiles</span><h2>Registered helpers</h2></div>
            <button class="daily-button" type="button" data-runtime-adapter-action="refresh">Refresh</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Adapter</th>
                  <th>Sandbox</th>
                  <th>Live</th>
                  <th>Receipt</th>
                  <th>Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr><td class="mono">none</td><td>waiting</td><td>not declared</td><td>disabled</td><td>none</td><td>register first</td></tr>
              </tbody>
            </table>
          </div>
          <div class="card-grid card-grid--quiet" data-runtime-adapter-grid hidden></div>
        </article>
        <aside class="daily-stack">
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Register</span><h2>New helper</h2></div></div>
            <form class="runtime-adapter-form" data-runtime-adapter-register-form>
              <label><span>Id</span><input name="id" type="text" placeholder="local-helper"></label>
              <label><span>Label</span><input name="label" type="text" placeholder="Local helper"></label>
              <div class="runtime-adapter-form__row">
                <label><span>Adapter</span><select name="adapter"><option value="cli">CLI</option><option value="http">HTTP</option><option value="acp">ACP</option><option value="mcp">MCP</option></select></label>
                <label><span>Prompt</span><select name="promptMode"><option value="stdin">stdin</option><option value="arg">arg</option><option value="json">json</option></select></label>
              </div>
              <label><span>Command</span><input name="command" type="text" placeholder="agent"></label>
              <label><span>Root</span><input name="root" type="text" placeholder="C:\\project"></label>
              <button class="daily-button daily-button--wide" type="button" data-runtime-adapter-action="register">Register</button>
            </form>
          </article>
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Run</span><h2>Preview first</h2></div></div>
            <div class="runtime-adapter-console">
              <label><span>Profile</span><select data-runtime-adapter-profile-select><option value="">No profile registered</option></select></label>
              <label><span>Prompt</span><textarea data-runtime-adapter-prompt rows="3" placeholder="Ask the helper to inspect this workspace."></textarea></label>
              <label class="runtime-adapter-check"><input data-runtime-adapter-approve-execution type="checkbox"> <span>Approve this run</span></label>
              <div class="runtime-adapter-actions">
                <button type="button" data-runtime-adapter-action="preview">Preview</button>
                <button type="button" data-runtime-adapter-action="invoke">Run</button>
              </div>
            </div>
          </article>
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Receipt</span><h2 data-runtime-adapter-receipt-status>none</h2></div></div>
            <div class="runtime-adapter-receipt">
              <span data-runtime-adapter-receipt-profile>no profile</span>
              <p data-runtime-adapter-receipt-summary>No receipt has been written yet.</p>
              <code data-runtime-adapter-receipt-command>waiting for next action</code>
            </div>
          </article>
        </aside>
      </section>
    </div>
  `);

  populate('sector-skills', `
    <div class="daily-page">
      ${dailyHeader('Skills', 'Enable and use installed capabilities.', '<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Suggest the best Zavorth skill for my current task and explain the risk before using it.">Suggest</button>')}
      <section class="daily-toolbar skill-toolbar skill-toolbar--quiet">
        <input type="search" placeholder="Search skills" aria-label="Search skills" data-skill-search>
        <button type="button" class="is-active" data-skill-filter="all">All</button>
        <button type="button" data-skill-filter="ready">Ready</button>
        <button type="button" data-skill-filter="setup">Set up</button>
        <button type="button" data-skill-filter="approval">Approval</button>
      </section>
      <section class="daily-panel daily-panel--list">
        <div class="daily-panel__head">
          <div><span>Installed</span><h2>5 skills</h2></div>
          <small class="daily-muted"><span data-tools-live-ready>0 ready</span></small>
        </div>
        <section class="premium-skill-list premium-skill-list--quiet">
          ${skillRow("Review workspace", "Ready", "Reads the project and highlights risks without editing files.", "ok", "ready", "Review my workspace in read-only mode and show the highest-risk items first.")}
          ${skillRow("Understand files", "Needs scope", "Uses only approved folders to explain documents.", "info", "setup", "Show me how to configure a safe folder scope for file memory.")}
          ${skillRow("Tool curator", "Preview", "Suggests improvements before anything changes.", "info", "approval", "Open the tool curator in preview mode and show only safe suggestions.")}
          ${skillRow("Transactions", "Simulation", "Previews and audits transactions; real money stays blocked.", "warn", "approval", "Simulate a transaction and list risks without executing anything real.")}
          ${skillRow("Connect adapter", "Consent", "Creates a profile only from a path you provide.", "info", "approval", "Explain how to connect an runtime adapter with consent and a limited scope.")}
        </section>
      </section>
    </div>
  `);

  populate('sector-nodes', `
    <div class="daily-page">
      ${dailyHeader('Memory', '', '<button class="daily-button daily-button--primary" type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>')}
      <section class="daily-panel daily-panel--search">
        <input type="search" placeholder="Search memory" aria-label="Search memory" data-memory-search>
        <button class="daily-button" type="button" data-memory-search-run data-prompt="Search Zavorth memory for the typed topic and show provenance.">Search</button>
      </section>
      <section class="daily-action-row" aria-label="Memory actions">
        <button type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>
        <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
        <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
      </section>
      <section class="daily-panel daily-panel--list daily-panel--flush" aria-label="Memory browser">
        <div class="daily-panel__head"><div><span>Mnemos</span><h2>Facts</h2></div></div>
        <ul class="memory-browser-list" data-memory-list>
          <li class="memory-browser-item" data-memory-item data-memory-search-text="facts provenance trust vault">
            <strong>Facts</strong><span>Provenance / trust</span>
            <div class="memory-browser-actions">
              <button type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>
              <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
              <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
            </div>
          </li>
          <li class="memory-browser-item" data-memory-item data-memory-search-text="recall local search mnemos fts">
            <strong>Recall</strong><span>Local search</span>
            <div class="memory-browser-actions">
              <button type="button" data-prompt="Recall useful memory with provenance.">Search</button>
              <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
              <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
            </div>
          </li>
          <li class="memory-browser-item" data-memory-item data-memory-search-text="folders workspaces scope">
            <strong>Folders</strong><span>Allowed scope</span>
            <div class="memory-browser-actions">
              <button type="button" data-prompt="Show trusted folder scopes for memory.">Search</button>
              <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
              <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
            </div>
          </li>
        </ul>
      </section>
      <section class="daily-layout daily-layout--main">
        <article class="daily-panel daily-panel--primary">
          <div class="daily-panel__head">
            <div><span>Scopes</span><h2>Active memory</h2></div>
          </div>
          <div class="zavorth-memory-mesh-panel">
            <div id="zavorth-memory-tree" class="zavorth-memory-tree">
              <div class="zavorth-memory-scope-list" role="list" aria-label="Memory scopes">
                <button class="zavorth-mem-node is-inspected" id="mem-node-vault" type="button"><strong>Facts</strong><span>Provenance and trust</span></button>
                <button class="zavorth-mem-node" id="mem-node-recall" type="button"><strong>Recall</strong><span>Local search</span></button>
                <button class="zavorth-mem-node" id="mem-node-workspaces" type="button"><strong>Folders</strong><span>Allowed scope</span></button>
                <button class="zavorth-mem-node" id="mem-node-agents" type="button"><strong>Agents</strong><span>Consented links</span></button>
                <button class="zavorth-mem-node" id="mem-node-environments" type="button"><strong>Execution</strong><span>Safety boundary</span></button>
              </div>
            </div>
            <div id="zavorth-memory-inspection-panel" class="zavorth-memory-inspection-panel">
              <div class="zavorth-memory-inspection-header">
                <span class="zavorth-memory-inspection-dot"></span>
                <span>Inspector</span>
              </div>
              <div class="zavorth-memory-inspection-body" id="zavorth-memory-inspection-body">
                <div class="zavorth-memory-inspection-empty">
                  <span>Select a scope</span>
                </div>
              </div>
            </div>
          </div>
        </article>
        <aside class="daily-stack">
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Status</span><h2>Memory</h2></div></div>
            <div class="daily-key-value">
              ${dailyKeyValue('File memory', '<span data-memory-live-files>Configurable</span>')}
              ${dailyKeyValue('Linked agents', '<span data-memory-live-agents>0</span>')}
              ${dailyKeyValue('Execution', '<span data-memory-live-env>Approval gated</span>')}
            </div>
          </article>
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Pairing</span><h2>Trusted device</h2></div></div>
            <button class="daily-button daily-button--wide" id="zavorth-otp-generate-btn" type="button">Generate key</button>
            <div class="zavorth-otp-display" id="zavorth-otp-key-display" style="display: none;">
              <span class="zavorth-otp-code" id="zavorth-otp-code-val">000-000</span>
              <span class="zavorth-otp-timer" id="zavorth-otp-timer-val">Expires in 60s</span>
            </div>
            <div class="zavorth-pairing-status" id="zavorth-otp-status" style="display: none;">
              <span class="zavorth-pairing-status-dot"></span>
              <span id="zavorth-otp-status-text">Ready to pair.</span>
            </div>
          </article>
        </aside>
      </section>
    </div>
  `);

  populate('sector-dreams', `
    <div class="daily-page learning-page" data-learning-dreams-root>
      ${dailyHeader('Learning', '', '<button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>')}
      <div class="learning-loading">Loading candidates…</div>
    </div>
  `);

  populate('sector-canvas', `
    <div class="daily-page z-canvas-page">
      ${dailyHeader('Canvas', 'Preview UI, diffs and sandbox output before applying changes.', '<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Open Z-Canvas for the current request and show preview, diff, logs and risks before applying anything.">Open preview</button>')}
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Canvas status">
        ${dailyMetric('Preview', 'Sandbox', 'isolated frame')}
        ${dailyMetric('Diff', 'Gated', 'approval before apply')}
        ${dailyMetric('Network', 'Blocked', 'unless allowed')}
        ${dailyMetric('Receipt', 'On', 'every apply')}
      </section>
      <section class="z-canvas-shell" data-canvas-root>
        <div class="z-canvas-loading">Open a preview from chat or a pending action.</div>
      </section>
    </div>
  `);

  populate('sector-config', `
    <div class="daily-page settings-minimal-page">
      ${dailyHeader('Settings', 'Model, channels, security, profile and appearance.', '<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Run settings health and show only missing setup.">Check</button>')}
      <section class="daily-settings-shell" aria-label="Settings">
        <nav class="daily-settings-nav" aria-label="Settings sections">
          <a href="#settings-general">General</a>
          <a href="#settings-model">Model</a>
          <a href="#settings-channels">Channels</a>
          <a href="#settings-security">Security</a>
          <a href="#settings-advanced">Advanced</a>
        </nav>
        <div class="daily-settings-content">
          <section class="daily-settings-group" id="settings-general">
            <h2>General</h2>
            <div class="daily-settings-row daily-settings-row--with-action">
              <div><strong>Language</strong><span>Use system language or choose one.</span></div>
              <label class="settings-minimal-select">
                <select data-zavorth-locale-select>
                  ${CONTROL_LOCALES.map((locale) => `<option value="${locale.code}" ${locale.code === readControlLocalePreference() ? 'selected' : ''}>${locale.label}</option>`).join('')}
                </select>
              </label>
              <button class="daily-button" type="button" data-zavorth-locale-apply>Apply</button>
            </div>
            <div class="daily-settings-row">
              <div><strong>Active engine</strong><span>Current runtime mode.</span></div>
              <strong class="settings-minimal-current" data-runtime-engine-active>Lite</strong>
            </div>
          </section>

          <section class="daily-settings-group" id="settings-model">
            <div class="daily-settings-group__head">
              <h2>Model</h2>
              <button class="daily-button" type="button" data-dashboard-prompt="Test the active model route with sanitized proof.">Test</button>
            </div>
            <div class="daily-settings-row">
              <div><strong>Active route</strong><span data-provider-picker="active">Configured route</span></div>
              <strong class="settings-minimal-current" data-provider-picker="fallbacks">Live routes</strong>
            </div>
            <details class="daily-disclosure">
              <summary>Provider catalog</summary>
              <div class="daily-provider-summary" data-provider-model-catalog-summary>
                <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Live</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">loading</span></div>
              </div>
              <div class="daily-card-feed" data-provider-model-catalog-list></div>
            </details>
          </section>

          <section class="daily-settings-group" id="settings-channels">
            <div class="daily-settings-group__head">
              <h2>Channels</h2>
              <button class="daily-button" type="button" data-dashboard-sector="channels">Manage</button>
            </div>
            ${settingsLinkRow('Telegram', 'Connect')}
            ${settingsLinkRow('Discord', 'Connect')}
            ${settingsLinkRow('Slack', 'Connect')}
            ${settingsLinkRow('WhatsApp', 'Connect')}
          </section>

          <section class="daily-settings-group" id="settings-security">
            <h2>Security</h2>
            <div class="daily-settings-row">
              <div><strong>Execution policy</strong><span>Risky work requires preview.</span></div>
              <strong class="settings-minimal-current">Approval</strong>
            </div>
            <details class="daily-disclosure">
              <summary>Execution engines</summary>
              <div class="runtime-engine-panel" aria-label="Runtime engines">
                <div class="runtime-engine-grid settings-engine-list" data-runtime-engine-cards data-runtime-engine-layout="compact"></div>
              </div>
            </details>
            <details class="daily-disclosure">
              <summary>Trusted folders</summary>
              <div class="trusted-workspace-panel settings-trusted-panel" aria-label="Trusted workspaces">
                <form class="trusted-workspace-form" data-trusted-workspace-form>
                  <label><span>Folder path</span><input name="path" type="text" placeholder="C:\\projects\\playground" autocomplete="off"></label>
                  <label><span>Label</span><input name="label" type="text" placeholder="Playground" autocomplete="off"></label>
                  <label><span>State</span><select name="state"><option value="trusted">Trusted</option><option value="sensitive">Sensitive</option><option value="untrusted">Untrusted</option></select></label>
                  <button type="submit">Add folder</button>
                </form>
                <div class="trusted-workspace-list" data-trusted-workspaces-list></div>
              </div>
            </details>
          </section>

          <section class="daily-settings-group" id="settings-advanced">
            <h2>Advanced</h2>
            <details class="daily-disclosure">
              <summary>Activation diagnostics</summary>
              <div class="daily-provider-summary" data-provider-activation-summary>
                <div class="info-row"><span class="info-row__label">Execution</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Proof</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Adapters</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Connectors</span><span class="info-row__value mono">loading</span></div>
              </div>
              <div class="daily-card-feed" data-provider-activation-list></div>
            </details>
            <details class="daily-disclosure zavorth-config-details">
              <summary>Runtime JSON</summary>
              <div class="zavorth-config-editor-wrapper">
                <textarea class="zavorth-config-textarea" id="zavorth-config-editor-textarea" autocomplete="off" spellcheck="false">{
  "zavorthControl": {
    "live": true,
    "theme": "dark",
    "safety": "high"
  }
}</textarea>
                <div class="zavorth-config-editor-actions">
                  <span class="zavorth-config-editor-status" id="zavorth-config-status">JSON status: OK</span>
                  <button class="daily-button" id="zavorth-config-save-btn" type="button">Save</button>
                </div>
              </div>
            </details>
          </section>
        </div>
      </section>
    </div>
  `);

  populate('sector-docs', `
    <div class="premium-page">
      <section class="premium-hero premium-hero--compact">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Docs</span>
          <h1 class="premium-title">Use the product first, docs second.</h1>
          <p class="premium-subtitle">Short references explain setup, models, approvals, memory, tools, and safe execution.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Tell me the shortest path to use Zavorth today.">Quickstart</button>
      </section>
      <section class="premium-grid">
        ${surfaceCard('Quickstart', '2 minutes', 'ok', 'Open, choose a goal, verify provider and run the first safe task.')}
        ${surfaceCard('Approvals', 'Important', 'warn', 'Understand allow always, scoped approvals and break-glass mode.')}
        ${surfaceCard('Mnemos', 'Guided', 'info', 'Configure folders and ask about files safely.')}
        ${surfaceCard('Models', 'Catalog', 'info', 'See which routes are configured, provable and live.')}
      </section>
    </div>
  `);

  populate('sector-cron', `
    <div class="premium-page">
      <section class="premium-hero premium-hero--compact">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Automations</span>
          <h1 class="premium-title">Scheduled work stays explicit.</h1>
          <p class="premium-subtitle">Recurring jobs, monitors and reminders are visible, revocable and policy checked.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Show scheduled tasks and whether any are risky or noisy.">Check automations</button>
      </section>
      <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Automation</th><th>Type</th><th>Next</th><th>Status</th></tr></thead><tbody>
        <tr><td class="mono">none visible</td><td>local</td><td>-</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
      </tbody></table></div>
    </div>
  `);

  window.ZavorthControlChat?.refreshDashboard?.();
  bindPromptActions();
  bindSkillFilters();
  bindLocaleSettings();
  initRuntimeEngineUi();
  initPolicySimulatorUi();
  initMemoryBrowserUi();
  normalizeStaticEmptyStates();
  window.ZavorthLocale?.apply();

  function populate(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function normalizeStaticEmptyStates() {
    const memoryEmpty = document.querySelector('#zavorth-memory-inspection-body .zavorth-memory-inspection-empty');
    if (memoryEmpty) {
      memoryEmpty.innerHTML = '<span>Select a scope</span>';
    }
  }

  // Support compact data-prompt buttons (Memory browser + elsewhere) alongside data-dashboard-prompt.
  if (document.documentElement.dataset.zavorthDataPromptBound !== '1') {
    document.documentElement.dataset.zavorthDataPromptBound = '1';
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest?.('[data-dashboard-prompt]')) return;
      const promptButton = target?.closest?.('[data-prompt]');
      if (!promptButton || promptButton.closest('#neural-feed, .compose-dock, #suggestion-chips')) return;
      const prompt = promptButton.getAttribute('data-prompt') || '';
      if (!prompt) return;
      event.preventDefault();
      const input = document.getElementById('compose-input');
      document.querySelector('[data-sector="terminal"]')?.click();
      if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
        input.value = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }
    });
  }

  function bindPromptActions() {
    if (document.documentElement.dataset.zavorthDashboardActionsBound === '1') return;
    document.documentElement.dataset.zavorthDashboardActionsBound = '1';
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const sectorButton = target?.closest?.('[data-dashboard-sector]');
      if (sectorButton) {
        const sector = sectorButton.getAttribute('data-dashboard-sector');
        if (sector) {
          event.preventDefault();
          document.querySelector(`[data-sector="${sector}"]`)?.click();
          window.emitSignal?.('info', 'Opened', `${sector.replace(/-/g, ' ')} is now active.`);
        }
        return;
      }

      const promptButton = target?.closest?.('[data-dashboard-prompt]');
      if (!promptButton) return;
      const prompt = promptButton.getAttribute('data-dashboard-prompt') || '';
      if (!prompt) return;
      event.preventDefault();
      const input = document.getElementById('compose-input');
      document.querySelector('[data-sector="terminal"]')?.click();
      if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
        input.value = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        window.emitSignal?.('success', 'Action ready', 'Review or send the prepared prompt from Inbox.');
      }
    });
  }

  function bindSkillFilters() {
    if (document.documentElement.dataset.zavorthSkillFiltersBound === '1') return;
    document.documentElement.dataset.zavorthSkillFiltersBound = '1';
    document.addEventListener('input', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches?.('[data-skill-search]')) applySkillFilter();
    });
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const filter = target?.closest?.('[data-skill-filter]');
      if (!filter) return;
      event.preventDefault();
      const toolbar = filter.closest('.skill-toolbar');
      toolbar?.querySelectorAll('[data-skill-filter]').forEach((button) => {
        button.classList.toggle('is-active', button === filter);
      });
      applySkillFilter();
    });
    const skillList = document.querySelector('#sector-skills .premium-skill-list');
    if (skillList && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => applySkillFilter()).observe(skillList, { childList: true });
    }
  }

  function bindLocaleSettings() {
    if (document.documentElement.dataset.zavorthLocaleSettingsBound === '1') return;
    document.documentElement.dataset.zavorthLocaleSettingsBound = '1';
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest?.('[data-zavorth-locale-apply]');
      if (!button) return;
      const select = document.querySelector('[data-zavorth-locale-select]');
      if (!(select instanceof HTMLSelectElement)) return;
      window.ZavorthLocale?.set(select.value as any);
      window.emitSignal?.('success', 'Language updated', 'The dashboard language was applied.');
    });
  }

  function applySkillFilter() {
    const root = document.getElementById('sector-skills');
    if (!root) return;
    const query = String(root.querySelector('[data-skill-search]')?.value || '').trim().toLowerCase();
    const active = root.querySelector('[data-skill-filter].is-active')?.getAttribute('data-skill-filter') || 'all';
    root.querySelectorAll('[data-skill-row]').forEach((row) => {
      const haystack = String(row.getAttribute('data-skill-search-text') || row.textContent || '').toLowerCase();
      const status = String(row.getAttribute('data-skill-status') || '').toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus = active === 'all' || status === active;
      if (row instanceof HTMLElement) row.hidden = !(matchesQuery && matchesStatus);
    });
  }

  function dailyHeader(title, subtitle, actions = '') {
    return `<section class="daily-header">
      <div>
        <span class="daily-kicker"><span class="dashboard-live-dot"></span>${title}</span>
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="daily-header__actions">${actions}</div>` : ''}
    </section>`;
  }

  function dailyMetric(label, value, sub) {
    return `<article class="daily-metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;
  }

  function dailyKeyValue(label, value) {
    return `<div class="daily-key-value__row"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function channelRow(name, subtitle, status, tone, primary, secondary, prompt) {
    return `<article class="daily-channel-row daily-channel-row--${tone}">
      <span class="daily-status-dot" aria-hidden="true"></span>
      <div class="daily-row__main">
        <h2>${name}<small>${subtitle}</small></h2>
      </div>
      <span class="daily-status daily-status--${tone}">${status}</span>
      <div class="daily-row__actions">
        <button type="button" class="daily-button" data-dashboard-prompt="${prompt}">${primary}</button>
        <button type="button" class="daily-button daily-button--ghost" data-dashboard-prompt="Show setup status, last error and next step for ${name}.">${secondary}</button>
      </div>
    </article>`;
  }

  function settingsLinkRow(name, action) {
    return `<div class="daily-settings-row">
      <div><strong>${name}</strong><span>Optional channel</span></div>
      <button class="daily-button" type="button" data-dashboard-prompt="Configure ${name} and show only the missing credential or webhook.">${action}</button>
    </div>`;
  }

  function premiumMetric(label, value, sub, tone) {
    return `<article class="premium-metric premium-metric--${tone}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;
  }

  function platformStat(label, value, sub, tone) {
    return `<article class="platform-stat platform-stat--${tone}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;
  }

  function premiumStep(index, title, detail) {
    return `<div><span>${index}</span><strong>${title}</strong><small>${detail}</small></div>`;
  }

  function premiumStatus(name, state, tone) {
    return `<div class="premium-status premium-status--${tone}"><span>${name}</span><strong>${state}</strong></div>`;
  }

  function surfaceCard(name, status, tone, detail) {
    return `<article class="premium-card premium-card--${tone}"><div class="premium-card__top"><h2>${name}</h2><span>${status}</span></div><p>${detail}</p></article>`;
  }

  function plainPanel(title, detail) {
    return `<article class="premium-panel"><div class="premium-panel__header"><div><span>Control</span><h2>${title}</h2></div><span class="dashboard-pill">ready</span></div><p>${detail}</p></article>`;
  }

  function setupStep(title, state, detail) {
    return `<article class="setup-step"><span>${title}</span><strong>${state}</strong><small>${detail}</small></article>`;
  }

  function decisionCard(title, state, detail, tone, action) {
    return `<article class="decision-card decision-card--${tone}"><div><span>${title}</span><strong>${state}</strong><p>${detail}</p></div><button type="button" data-dashboard-sector="terminal">${action}</button></article>`;
  }

  function receiptStory(label, value) {
    return `<div class="receipt-story"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function skillRow(name, status, detail, tone, filter, prompt) {
    const search = `${name} ${status} ${detail}`.toLowerCase();
    const enabled = filter === 'ready';
    return `<article class="skill-row skill-row--${tone}" data-skill-row data-skill-status="${filter}" data-skill-search-text="${search}">
      <div class="daily-row__main"><h2>${name}</h2><p>${detail}</p></div>
      <span class="daily-status daily-status--${tone}">${status}</span>
      <button type="button" class="daily-skill-toggle" aria-pressed="${enabled ? 'true' : 'false'}" aria-label="${enabled ? 'Disable' : 'Enable'} ${name}" data-dashboard-prompt="${enabled ? `Disable ${name} after confirming impact.` : `Enable or configure ${name}. Show only the missing setup and risk.`}"><span></span></button>
      <button type="button" class="skill-row__use" data-dashboard-prompt="${prompt}">Use</button>
    </article>`;
  }
}

initControlPages();
initLearningDreamsUi();
