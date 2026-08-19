/**
Zavorth Zavorth Control pages.
Static placeholders stay honest; runtime-bridge replaces them with live data.

nction () {
use strict';

opulate('sector-overview', `
 <div class="premium-page premium-page--platform platform-page--operator dashboard-glass" data-zavorth-premium-dashboard-v2>
   <section class="premium-hero premium-hero--platform platform-hero--operator" aria-label="Work overview">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Work</span>
       <h1 class="premium-title">Current work</h1>
       <p class="premium-subtitle">See what Zavorth is doing now, what needs a decision, and the safest next step.</p>
     </div>
     <div class="premium-hero__actions">
       <button class="operator-primary-action" type="button" data-dashboard-sector="terminal">Open chat</button>
     </div>
   </section>
   <section class="work-simple-grid" aria-label="Work overview">
     <section class="work-simple-panel work-simple-panel--main">
       <div class="platform-section-title">Current task</div>
       <div class="work-current-task">
         <strong data-dashboard-runtime-title>No task running</strong>
         <p data-dashboard-runtime-text>Ask Zavorth in the Inbox. When a request could change files, call tools, or touch external state, Zavorth will preview the risk and ask for approval.</p>
         <button type="button" data-dashboard-sector="terminal">Ask Zavorth</button>
       </div>
       <div class="work-now-strip" aria-label="Current runtime facts">
         <span><strong data-live-runtime-state>Runtime</strong><small data-live-runtime-detail>Checking access</small></span>
         <span><strong data-live-gateway-state>Gateway</strong><small data-live-gateway-detail>local route</small></span>
         <span><strong data-live-sync-state>Last sync</strong><small data-live-sync-detail>Starting now</small></span>
       </div>
     </section>
     <section class="work-simple-panel">
       <div class="platform-section-title">Needs attention</div>
       <div class="work-decision-empty">
         <strong data-dashboard-approval-title>No pending approvals</strong>
         <p data-dashboard-approval-text>When Zavorth needs a decision, it appears here with approve, deny, or adjust scope.</p>
       </div>
     </section>
     <section class="work-simple-panel">
       <div class="platform-section-title">Useful paths</div>
       <div class="work-simple-actions" aria-label="Useful paths">
         <button type="button" data-dashboard-sector="terminal"><strong>Inbox</strong><span>Ask in natural language.</span></button>
         <button type="button" data-dashboard-sector="sales-os"><strong>Approvals</strong><span>Review waiting decisions.</span></button>
         <button type="button" data-dashboard-sector="instances"><strong>History</strong><span>See what happened and why.</span></button>
       </div>
     </section>
     <section class="work-simple-panel work-simple-panel--status">
       <div class="platform-section-title">State</div>
       <div class="work-compact-status">
         ${premiumStatus("Dashboard", "online", "ok")}
         ${premiumStatus("Sensitive actions", "approval gated", "ok")}
       </div>
       <div class="work-timeline-slot" data-dashboard-timeline hidden></div>
     </section>
   </section>
 </div>
);

opulate('sector-channels', `
 <div class="premium-page">
   <section class="premium-hero premium-hero--compact">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Channel Gateway</span>
       <h1 class="premium-title">Every channel uses the same rules.</h1>
       <p class="premium-subtitle">Natural-first input, approval resolver, redaction, receipts and channel-aware actions stay unified.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Help me configure a channel safely. Show only the next safe step.">Configure channel</button>
   </section>
   <section class="premium-grid">
     ${surfaceCard('Web dashboard', 'Ready', 'ok', 'Live operator surface for chat, approvals, receipts and readiness.')}
     ${surfaceCard('CLI / TUI', 'Ready', 'ok', 'Terminal operator mode for status, ready checks, providers and curator.')}
     ${surfaceCard('Remote channel', 'Optional', 'info', 'Remote approvals and status can be enabled with scoped secrets.')}
     ${surfaceCard('Team channel', 'Optional', 'info', 'Shared command surface; rich buttons when available.')}
     ${surfaceCard('Workspace channel', 'Optional', 'info', 'Workspace bridge with redaction and receipts.')}
     ${surfaceCard('Email or messaging', 'Optional', 'info', 'External messaging remains opt-in and policy-gated.')}
   </section>
 </div>
);

opulate('sector-sales-os', `
 <div class="premium-page">
   <section class="premium-hero premium-hero--compact">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Approvals</span>
       <h1 class="premium-title">Decisions should be obvious.</h1>
       <p class="premium-subtitle">Accept, reject, allow for a scope or revoke later. Critical actions keep extra confirmations.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Show pending approvals, auto-approvals and break-glass status.">Review approvals</button>
   </section>
   <section class="premium-metrics">
     ${premiumMetric('Pending', '<span data-sales-os-metric="approvals">0</span>', '<span data-sales-os-meta="approvals">no pending approval</span>', 'warn')}
     ${premiumMetric('Auto approvals', 'Scoped', 'time-limited and revocable', 'info')}
     ${premiumMetric('Extreme mode', 'Locked', 'requires maximum confirmation', 'warn')}
     ${premiumMetric('Receipts', 'On', 'every decision leaves proof', 'ok')}
   </section>
   <section class="decision-board" aria-label="Approval decision board">
     ${decisionCard('Next decision', 'No pending approvals', 'When one appears, this card shows action, risk, scope, TTL and approve/reject controls.', 'ok', 'Open Inbox')}
     ${decisionCard('Allow always', 'Available with limits', 'Persistent permission must still name scope, risk ceiling, expiration and rollback notes.', 'info', 'Manage scopes')}
     ${decisionCard('Break-glass', 'Locked', 'Critical mode asks multiple confirmations, explains risks and keeps hard stops for obvious catastrophes.', 'warn', 'Inspect')}
   </section>
   <section class="premium-layout">
     ${plainPanel('Plain-language approval', 'A user can type approve, click a button, or use any enabled channel; the same resolver verifies scope and receipt.')}
     ${plainPanel('Revocation', 'Every persistent permission can be revoked from dashboard, CLI or remote channel.')}
     ${plainPanel('Audit trail', 'Approval cards link back to the request, policy reason, TTL and final receipt.')}
   </section>
 </div>
);

opulate('sector-instances', `
 <div class="premium-page">
   <section class="premium-hero premium-hero--compact">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>History</span>
       <h1 class="premium-title">Proof, not mystery logs.</h1>
       <p class="premium-subtitle">See what ran, what was blocked, which approval authorized it and what can be rolled back.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Show recent history and summarize what happened in plain English.">Summarize history</button>
   </section>
   <section class="premium-layout premium-layout--wide-right">
     <article class="premium-panel">
       <div class="premium-panel__header"><div><span>Recent work</span><h2 data-history-title>No completed work yet</h2></div><span class="dashboard-pill">evidence</span></div>
       <p data-history-summary>After a mission, this area shows requests, tool calls, approvals, files touched, blocked risks and rollback notes.</p>
       <div class="receipt-story-grid">
         ${receiptStory('What changed', 'No mutation recorded yet.')}
         ${receiptStory('Why', 'The reason will cite the original user request and policy route.')}
         ${receiptStory('Review', 'Receipts can be searched, replayed or opened from the composer History button.')}
         ${receiptStory('Undo', 'Rollback guidance appears when the action supports it.')}
       </div>
     </article>
     <article class="premium-panel premium-panel--table">
       <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Item</th><th>Source</th><th>Artifacts</th><th>Decision</th><th>Updated</th><th>Status</th></tr></thead><tbody>
         <tr><td class="mono">none yet</td><td>Web</td><td>0</td><td>Ask Zavorth first</td><td>-</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
       </tbody></table></div>
     </article>
   </section>
 </div>
);

opulate('sector-sessions', `
 <div class="premium-page">
   <section class="premium-hero premium-hero--compact">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>History</span>
       <h1 class="premium-title">Past work stays readable.</h1>
       <p class="premium-subtitle">Sessions, handoffs and receipts appear as a timeline instead of raw runtime noise.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Summarize my recent sessions and what still needs attention.">Summarize history</button>
   </section>
   <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Session</th><th>Channel</th><th>Events</th><th>Receipts</th><th>Status</th></tr></thead><tbody>
     <tr><td class="mono">main</td><td>Web</td><td>0</td><td>0</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
   </tbody></table></div>
 </div>
);

opulate('sector-usage', `
 <div class="premium-page platform-page--operator">
   <section class="premium-hero premium-hero--compact platform-hero--operator">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Models</span>
       <h1 class="premium-title">AI models</h1>
       <p class="premium-subtitle">See which route Zavorth uses, whether it is ready, and what has been measured in this session.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Explain the current AI model, provider route, fallback, and anything that still needs setup.">View current model</button>
   </section>
   <section class="platform-summary platform-summary--compact" aria-label="Model usage summary">
     ${premiumMetric("Tokens", "0", "no measured usage", "info")}
     ${premiumMetric("Cost", "$0.00", "waiting for provider proof", "info")}
     ${premiumMetric("Calls", "0", "no tools executed", "info")}
     ${premiumMetric("Errors", "0", "no visible errors", "ok")}
   </section>
   <section class="platform-workspace platform-workspace--operator">
     <div class="platform-main">
       <div class="platform-section-title">Actions</div>
       <div class="platform-action-list" aria-label="Model actions">
         <button type="button" data-dashboard-prompt="Explain Zavorth's active model, provider, fallback, and when I should switch routes."><strong>Active model</strong><span>Uses the configured route right now.</span></button>
         <button type="button" data-dashboard-prompt="Test the current AI route with a safe sanitized check. Do not expose secrets."><strong>Test route</strong><span>Runs a safe readiness check before use.</span></button>
         <button type="button" data-dashboard-prompt="Show tokens, cost, tool calls, and measurement gaps for this session."><strong>Recent usage</strong><span>Summarizes what has been measured.</span></button>
       </div>
       <div class="platform-section-title">Catalog</div>
       <div class="info-grid info-grid--quiet" data-provider-model-catalog-summary>
         <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">waiting</span></div>
         <div class="info-row"><span class="info-row__label">Ready</span><span class="info-row__value mono">waiting</span></div>
         <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">waiting</span></div>
         <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">waiting</span></div>
       </div>
       <div class="card-grid card-grid--quiet" data-provider-model-catalog-list></div>
     </div>
     <aside class="platform-side">
       <div class="platform-section-title">State</div>
       <div class="premium-status-list">
         ${premiumStatus("Usage", "local", "info")}
         ${premiumStatus("Costs", "when reported", "info")}
         ${premiumStatus("Secrets", "redacted", "ok")}
         ${premiumStatus("Export", "manual", "info")}
       </div>
     </aside>
   </section>
 </div>
);

opulate('sector-agents', `
 <div class="premium-page">
   <section class="premium-hero premium-hero--compact">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Agent Review</span>
       <h1 class="premium-title">Review before changing.</h1>
       <p class="premium-subtitle">Read-only findings, file references, severity and patch previews stay separate from apply actions.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Run Agent Review in read-only mode and list the highest risk findings first.">Start review</button>
   </section>
   <section class="premium-grid">
     ${surfaceCard('Read-only review', 'Ready', 'ok', 'Finds bugs and risks without editing files.')}
     ${surfaceCard('Patch preview', 'Approval gated', 'info', 'Shows proposed changes before apply.')}
     ${surfaceCard('Swarm review', 'Budget guarded', 'info', 'Uses parallel agents only when useful and within token limits.')}
   </section>
 </div>
);

opulate('sector-skills', `
 <div class="premium-page platform-page--operator">
   <section class="premium-hero premium-hero--compact platform-hero--operator">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Tools</span>
       <h1 class="premium-title">Zavorth tools</h1>
       <p class="premium-subtitle">Use ready capabilities when they help the current task. Risky work still asks for approval.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Suggest the best Zavorth tool for my current task and explain why.">Suggest tool</button>
   </section>
   <section class="skill-toolbar skill-toolbar--quiet">
     <input type="search" placeholder="Search tools" aria-label="Search tools" data-skill-search>
     <button type="button" class="is-active" data-skill-filter="all">All</button>
     <button type="button" data-skill-filter="ready">Ready</button>
     <button type="button" data-skill-filter="setup">Needs setup</button>
     <button type="button" data-skill-filter="approval">Approval gated</button>
   </section>
   <section class="platform-workspace platform-workspace--operator">
     <div class="platform-main">
       <div class="platform-section-title">Library</div>
       <div class="tool-empty-action">
         <strong>Not sure what to use...</strong>
         <span>Ask Zavorth to choose the lightest safe tool for the current request.</span>
         <button type="button" data-dashboard-prompt="Choose the lightest safe tool for my current request. Explain the risk before using anything.">Choose for me</button>
       </div>
       <div class="agent-os-live-summary" aria-label="Live tool summary">
         <span><strong data-tools-live-count>0</strong><small>runtime tools</small></span>
         <span><strong data-tools-live-ready>waiting</strong><small>ready state</small></span>
         <span><strong data-tools-live-last>no tool yet</strong><small>last signal</small></span>
       </div>
       <section class="premium-skill-list premium-skill-list--quiet">
         ${skillRow("Review workspace", "Ready", "Reads the project and highlights clear risks without editing files.", "ok", "ready", "Review my workspace in read-only mode and show the highest-risk items first.")}
         ${skillRow("Understand files", "Needs scope", "Uses only approved folders to explain documents.", "info", "setup", "Show me how to configure a safe folder scope for file memory.")}
         ${skillRow("Tool curator", "Preview first", "Suggests improvements without changing anything before approval.", "info", "approval", "Open the tool curator in preview mode and show only safe suggestions.")}
         ${skillRow("Transactions", "Simulation", "Previews and audits transactions; real money stays blocked.", "warn", "approval", "Simulate a transaction and list risks without executing anything real.")}
         ${skillRow("Connect adapter", "Consent required", "Creates a profile only from a path you provide.", "info", "approval", "Explain how to connect an runtime adapter with consent and a limited scope.")}
       </section>
     </div>
     <aside class="platform-side">
       <div class="platform-section-title">Safety</div>
       <div class="premium-status-list">
         ${premiumStatus("New tools", "approval gated", "ok")}
         ${premiumStatus("Changes", "preview first", "info")}
         ${premiumStatus("External sources", "blocked", "ok")}
         ${premiumStatus("Undo", "receipt backed", "ok")}
       </div>
     </aside>
   </section>
 </div>
);

opulate('sector-nodes', `
 <div class="premium-page platform-page--operator">
   <section class="premium-hero premium-hero--compact platform-hero--operator">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Memory</span>
       <h1 class="premium-title">Zavorth memory</h1>
       <p class="premium-subtitle">Control what Zavorth may remember, which files it can read, and which agents can work alongside it.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Show what Zavorth can remember right now and which scopes are active.">View memory</button>
   </section>
   <section class="platform-workspace platform-workspace--operator">
     <div class="platform-main">
       <div class="platform-section-title">Controls</div>
       <div class="tool-empty-action">
         <strong>No memory scope required yet.</strong>
         <span>Start with a folder, document, or rule that Zavorth should remember only when useful.</span>
         <button type="button" data-dashboard-prompt="Help me add a safe memory scope. Ask what folder or fact should be remembered, then explain how to forget it later.">Add memory scope</button>
       </div>
       <div class="agent-os-live-summary" aria-label="Live memory summary">
         <span><strong data-memory-live-files>waiting</strong><small>file memory</small></span>
         <span><strong data-memory-live-agents>0</strong><small>linked agents</small></span>
         <span><strong data-memory-live-env>approval gated</strong><small>execution</small></span>
       </div>
       <div class="platform-action-list" aria-label="Memory controls">
         <button type="button" data-dashboard-prompt="Show file memory scopes and which folders are allowed."><strong>File memory</strong><span>Folders and documents enter only with approved scope.</span></button>
         <button type="button" data-dashboard-prompt="Show whether Zavorth can split a task into parallel work and which limits apply."><strong>Parallel work</strong><span>Uses cost limits and receipts when useful.</span></button>
         <button type="button" data-dashboard-prompt="Show connected runtime adapters and how to limit what each can do."><strong>Connect adapter</strong><span>No runtime adapter is discovered without a path you provide.</span></button>
         <button type="button" data-dashboard-prompt="Show available execution environments and which ones require approval."><strong>Execution environments</strong><span>Files, shell, and remote actions stay approval gated.</span></button>
       </div>
     </div>
     <aside class="platform-side">
       <div class="platform-section-title">State</div>
       <div class="premium-status-list">
         ${premiumStatus("File memory", "configurable", "info")}
         ${premiumStatus("Parallel work", "ready", "ok")}
         ${premiumStatus("External links", "consent required", "info")}
         ${premiumStatus("Safe execution", "approval gated", "warn")}
       </div>
     </aside>
   </section>
 </div>
);

opulate('sector-dreams', `
 <div class="premium-page">
   <section class="premium-hero premium-hero--compact">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Rest</span>
       <h1 class="premium-title">Background mode, kept quiet.</h1>
       <p class="premium-subtitle">Memory compaction, low-priority checks and maintenance summarize only when there is something useful.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Show Stay Online status without noisy notifications.">Stay Online status</button>
   </section>
   <section class="premium-layout">
     ${plainPanel('Memory consolidation', 'Idle until useful context can be saved safely.')}
     ${plainPanel('Keepalive', 'Quiet summaries replace repeated noisy notifications.')}
     ${plainPanel('Maintenance', 'Cleanup actions remain previewed, reversible and receipt-backed.')}
   </section>
 </div>
);

opulate('sector-config', `
 <div class="premium-page platform-page--operator">
   <section class="premium-hero premium-hero--compact platform-hero--operator">
     <div>
       <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Settings</span>
       <h1 class="premium-title">Configuration, redacted.</h1>
       <p class="premium-subtitle">Models, approvals, memory scopes, and channel setup stay readable without exposing raw secrets.</p>
     </div>
     <button class="operator-primary-action" type="button" data-dashboard-prompt="Open settings health and tell me what should be configured next.">Settings health</button>
   </section>
   <section class="platform-workspace platform-workspace--operator">
     <div class="platform-main">
       <div class="setup-studio-strip" aria-label="Setup flow">
         ${setupStep('1. Provider', 'choose', 'Pick API route and model.')}
         ${setupStep('2. Test', 'optional', 'Run a live probe only when asked.')}
         ${setupStep('3. Channels', 'optional', 'Remote channels remain opt-in.')}
         ${setupStep('4. Ready', 'verify', 'Run release/ready checks before daily use.')}
       </div>
       <div class="platform-section-title">Provider catalog</div>
       <div class="provider-picker-premium" aria-label="Provider picker">
         <button type="button" class="provider-picker-card is-active" data-dashboard-prompt="Show the configured provider route, available models and live proof.">
           <span>Active route</span><strong data-provider-picker="active">Configured route</strong><small>Uses your saved provider selection.</small>
         </button>
         <button type="button" class="provider-picker-card" data-dashboard-prompt="Show fallback providers and which ones are live validated.">
           <span>Fallbacks</span><strong data-provider-picker="fallbacks">Live routes</strong><small>Only proven routes become defaults.</small>
         </button>
         <button type="button" class="provider-picker-card" data-dashboard-prompt="Test the selected provider with a sanitized proof.">
           <span>Proof</span><strong data-provider-picker="proof">Sanitized</strong><small>Keys never appear in output.</small>
         </button>
       </div>
       <div class="info-grid info-grid--quiet" data-provider-model-catalog-summary>
         <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">loading</span></div>
         <div class="info-row"><span class="info-row__label">Live</span><span class="info-row__value mono">loading</span></div>
         <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">loading</span></div>
         <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">loading</span></div>
       </div>
       <div class="card-grid card-grid--quiet" data-provider-model-catalog-list></div>
       <div class="platform-section-title">Activation</div>
       <div class="info-grid info-grid--quiet" data-provider-activation-summary>
         <div class="info-row"><span class="info-row__label">Execution</span><span class="info-row__value mono">loading</span></div>
         <div class="info-row"><span class="info-row__label">Proof</span><span class="info-row__value mono">loading</span></div>
         <div class="info-row"><span class="info-row__label">Adapters</span><span class="info-row__value mono">loading</span></div>
         <div class="info-row"><span class="info-row__label">Connectors</span><span class="info-row__value mono">loading</span></div>
       </div>
       <div class="card-grid card-grid--quiet" data-provider-activation-list></div>
     </div>
     <aside class="platform-side">
       <div class="platform-section-title">Trust plane</div>
       <div class="premium-status-list">
         ${premiumStatus('Auto approvals', 'limited', 'info')}
         ${premiumStatus('Break-glass', 'locked', 'warn')}
         ${premiumStatus('Receipts', 'on', 'ok')}
         ${premiumStatus('Secrets', 'redacted', 'ok')}
       </div>
     </aside>
   </section>
 </div>
);

opulate('sector-docs', `
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
);

opulate('sector-cron', `
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
);

indow.ZavorthControlChat?.refreshDashboard?.();
indPromptActions();
indSkillFilters();

unction populate(id, html) {
 const el = document.getElementById(id);
 if (el) el.innerHTML = html;


unction bindPromptActions() {
 if (document.documentElement.dataset.zavorthDashboardActionsBound === '1') return;
 document.documentElement.dataset.zavorthDashboardActionsBound = '1';
 document.addEventListener('click', (event) => {
   const sectorButton = event.target?.closest?.('[data-dashboard-sector]');
   if (sectorButton) {
     const sector = sectorButton.getAttribute('data-dashboard-sector');
     if (sector) {
       event.preventDefault();
       document.querySelector(`[data-sector="${sector}"]`)?.click();
       window.emitSignal?.('info', 'Opened', `${sector.replace(/-/g, ' ')} is now active.`);
     }
     return;
   }

   const promptButton = event.target?.closest?.('[data-dashboard-prompt]');
   if (!promptButton) return;
   const prompt = promptButton.getAttribute('data-dashboard-prompt') || '';
   if (!prompt) return;
   event.preventDefault();
   const input = document.getElementById('compose-input');
   document.querySelector('[data-sector="terminal"]')?.click();
   if (input) {
     input.value = prompt;
     input.dispatchEvent(new Event('input', { bubbles: true }));
     input.focus();
     window.emitSignal?.('success', 'Action ready', 'Review or send the prepared prompt from Inbox.');
   }
 });


unction bindSkillFilters() {
 if (document.documentElement.dataset.zavorthSkillFiltersBound === '1') return;
 document.documentElement.dataset.zavorthSkillFiltersBound = '1';
 document.addEventListener('input', (event) => {
   if (event.target?.matches?.('[data-skill-search]')) applySkillFilter();
 });
 document.addEventListener('click', (event) => {
   const filter = event.target?.closest?.('[data-skill-filter]');
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


unction applySkillFilter() {
 const root = document.getElementById('sector-skills');
 if (!root) return;
 const query = String(root.querySelector('[data-skill-search]')?.value || '').trim().toLowerCase();
 const active = root.querySelector('[data-skill-filter].is-active')?.getAttribute('data-skill-filter') || 'all';
 root.querySelectorAll('[data-skill-row]').forEach((row) => {
   const haystack = String(row.getAttribute('data-skill-search-text') || row.textContent || '').toLowerCase();
   const status = String(row.getAttribute('data-skill-status') || '').toLowerCase();
   const matchesQuery = !query || haystack.includes(query);
   const matchesStatus = active === 'all' || status === active;
   row.hidden = !(matchesQuery && matchesStatus);
 });


unction premiumMetric(label, value, sub, tone) {
 return `<article class="premium-metric premium-metric--${tone}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;


unction platformStat(label, value, sub, tone) {
 return `<article class="platform-stat platform-stat--${tone}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;


unction premiumStep(index, title, detail) {
 return `<div><span>${index}</span><strong>${title}</strong><small>${detail}</small></div>`;


unction premiumStatus(name, state, tone) {
 return `<div class="premium-status premium-status--${tone}"><span>${name}</span><strong>${state}</strong></div>`;


unction surfaceCard(name, status, tone, detail) {
 return `<article class="premium-card premium-card--${tone}"><div class="premium-card__top"><h2>${name}</h2><span>${status}</span></div><p>${detail}</p></article>`;


unction plainPanel(title, detail) {
 return `<article class="premium-panel"><div class="premium-panel__header"><div><span>Control</span><h2>${title}</h2></div><span class="dashboard-pill">ready</span></div><p>${detail}</p></article>`;


unction setupStep(title, state, detail) {
 return `<article class="setup-step"><span>${title}</span><strong>${state}</strong><small>${detail}</small></article>`;


unction decisionCard(title, state, detail, tone, action) {
 return `<article class="decision-card decision-card--${tone}"><div><span>${title}</span><strong>${state}</strong><p>${detail}</p></div><button type="button" data-dashboard-sector="terminal">${action}</button></article>`;


unction receiptStory(label, value) {
 return `<div class="receipt-story"><span>${label}</span><strong>${value}</strong></div>`;


unction skillRow(name, status, detail, tone, filter, prompt) {
 const search = `${name} ${status} ${detail}`.toLowerCase();
 return `<article class="skill-row skill-row--${tone}" data-skill-row data-skill-status="${filter}" data-skill-search-text="${search}"><div><h2>${name}</h2><p>${detail}</p></div><span>${status}</span><button type="button" class="skill-row__use" data-dashboard-prompt="${prompt}">Use</button></article>`;

);
