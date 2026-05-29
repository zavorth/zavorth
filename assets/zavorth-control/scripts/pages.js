/**
 * Zavorth Zavorth Control pages.
 * Static placeholders stay honest; runtime-bridge replaces them with live data.
 */
(function () {
  'use strict';

  populate('sector-overview', `
    <div class="premium-page premium-page--platform platform-page--operator dashboard-glass" data-zavorth-premium-dashboard-v2>
      <section class="premium-hero premium-hero--platform platform-hero--operator" aria-label="Operations overview">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Overview</span>
          <h1 class="premium-title">Today in Zavorth.</h1>
          <p class="premium-subtitle">A simple operator view: what is ready, what needs approval, and the safest next action.</p>
        </div>
        <div class="premium-hero__actions">
          <button class="operator-primary-action" type="button" data-dashboard-prompt="Run Zavorth Ready To Go and summarize the result in simple language.">Ready check</button>
          <button class="operator-secondary-action" type="button" data-dashboard-sector="terminal">Ask Zavorth</button>
        </div>
      </section>

      <section class="platform-summary platform-summary--compact" aria-label="Core status">
        ${platformStat('Missions', '<span data-dashboard-metric="runs">0</span>', '<span data-dashboard-meta="runs">waiting for first mission</span>', 'ok')}
        ${platformStat('Provider', 'Auto', 'Uses configured route', 'info')}
        ${platformStat('Approvals', '<span data-dashboard-metric="approvals">0</span>', '<span data-dashboard-meta="approvals">No pending decision</span>', 'warn')}
        ${platformStat('Receipts', '<span data-dashboard-metric="artifacts">0</span>', '<span data-dashboard-meta="artifacts">No receipt yet</span>', 'info')}
      </section>

      <section class="platform-workspace platform-workspace--operator">
        <div class="platform-main">
          <div class="platform-section-title">Next best action</div>
          <button class="platform-command-row platform-command-row--primary" type="button" data-dashboard-sector="terminal">
            <span>
              <strong data-dashboard-runtime-title>Waiting for a mission</strong>
              <small data-dashboard-runtime-text>Use Chat for natural requests. Zavorth previews risky actions, asks when needed and writes receipts after completion.</small>
            </span>
            <em>Open chat</em>
          </button>
          <div class="platform-process platform-process--quiet" aria-label="Governed flow">
            ${premiumStep('1', 'Ask', 'plain language')}
            ${premiumStep('2', 'Preview', 'risk and tools')}
            ${premiumStep('3', 'Approve', 'scope and TTL')}
            ${premiumStep('4', 'Receipt', 'proof and replay')}
          </div>
          <div class="platform-timeline platform-timeline--quiet" data-dashboard-timeline hidden>
            <div class="platform-section-title">Recent activity</div>
          </div>
          <div class="platform-action-list" aria-label="Common actions">
            <button type="button" data-dashboard-sector="terminal"><strong>Ask Zavorth</strong><span>Start with a normal request.</span></button>
            <button type="button" data-dashboard-sector="sales-os"><strong>Review approvals</strong><span>Accept, reject or scope permissions.</span></button>
            <button type="button" data-dashboard-sector="instances"><strong>Inspect receipts</strong><span>See what happened and why.</span></button>
          </div>
          <div class="operator-checklist" aria-label="Setup checklist">
            ${setupStep('Provider', 'ready', 'Choose model and fallback before deep work.')}
            ${setupStep('Inbox', 'ready', 'Ask naturally; risky actions become previews.')}
            ${setupStep('Approvals', 'gated', 'Human decisions stay scoped and reversible.')}
            ${setupStep('Receipts', 'on', 'Every completed action leaves proof.')}
          </div>
        </div>

        <aside class="platform-side">
          <div class="platform-section-title">Readiness</div>
          <div class="premium-status-list">
            ${premiumStatus('Web dashboard', 'ready', 'ok')}
            ${premiumStatus('CLI/TUI', 'ready', 'ok')}
            ${premiumStatus('Telegram', 'configurable', 'info')}
            ${premiumStatus('Mutable work', 'approval gated', 'ok')}
          </div>
          <button class="operator-secondary-action" type="button" data-dashboard-sector="channels">Open channels</button>
        </aside>
      </section>
    </div>
  `);

  populate('sector-channels', `
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
        ${surfaceCard('Telegram', 'Configurable', 'info', 'Remote approvals and status can be enabled with scoped secrets.')}
        ${surfaceCard('Discord', 'Configurable', 'info', 'Shared command surface; rich buttons when available.')}
        ${surfaceCard('Slack', 'Configurable', 'info', 'Workspace channel bridge with redaction and receipts.')}
        ${surfaceCard('WhatsApp / Signal / Email', 'Configurable', 'info', 'External messaging remains opt-in and policy-gated.')}
      </section>
    </div>
  `);

  populate('sector-sales-os', `
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
        ${plainPanel('Plain-language approval', 'A user can type “approve”, click a button, or approve in Telegram; the same resolver verifies scope and receipt.')}
        ${plainPanel('Revocation', 'Every persistent permission can be revoked from dashboard, CLI or remote channel.')}
        ${plainPanel('Audit trail', 'Approval cards link back to the request, policy reason, TTL and final receipt.')}
      </section>
    </div>
  `);

  populate('sector-instances', `
    <div class="premium-page">
      <section class="premium-hero premium-hero--compact">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Receipts</span>
          <h1 class="premium-title">Proof, not mystery logs.</h1>
          <p class="premium-subtitle">See what ran, what was blocked, which approval authorized it and what can be rolled back.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Show recent receipts and summarize them for a non-technical user.">Show receipts</button>
      </section>
      <section class="premium-layout premium-layout--wide-right">
        <article class="premium-panel">
          <div class="premium-panel__header"><div><span>Recent receipts</span><h2>No receipt yet</h2></div><span class="dashboard-pill">evidence</span></div>
          <p>After a mission, this area shows files touched, tools used, approvals, blocked risks, cost and rollback notes.</p>
          <div class="receipt-story-grid">
            ${receiptStory('What changed', 'No mutation recorded yet.')}
            ${receiptStory('Why', 'The reason will cite the original user request and policy route.')}
            ${receiptStory('Review', 'Receipts can be searched, replayed or attached to handoff.')}
            ${receiptStory('Undo', 'Rollback guidance appears when the action supports it.')}
          </div>
        </article>
        <article class="premium-panel premium-panel--table">
          <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Surface</th><th>Mode</th><th>Status</th><th>Next step</th></tr></thead><tbody>
            <tr><td>Web</td><td>operator</td><td><span class="badge badge--ok"><span class="badge__dot"></span>Ready</span></td><td>Ask in Chat</td></tr>
            <tr><td>CLI</td><td>operator</td><td><span class="badge badge--ok"><span class="badge__dot"></span>Ready</span></td><td>Run ready check</td></tr>
            <tr><td>External agents</td><td>optional</td><td><span class="badge badge--info"><span class="badge__dot"></span>Consent required</span></td><td>Onboard first</td></tr>
          </tbody></table></div>
        </article>
      </section>
    </div>
  `);

  populate('sector-sessions', `
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
  `);

  populate('sector-usage', `
    <div class="premium-page platform-page--operator">
      <section class="premium-hero premium-hero--compact platform-hero--operator">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Usage</span>
          <h1 class="premium-title">Usage at a glance.</h1>
          <p class="premium-subtitle">Track tokens, cost, tools and errors without turning the dashboard into a billing spreadsheet.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Show provider, model, token and cost usage. Explain gaps honestly.">Analyze usage</button>
      </section>
      <section class="platform-summary platform-summary--compact" aria-label="Usage summary">
        ${premiumMetric('Tokens', '0', 'no measured usage yet', 'info')}
        ${premiumMetric('Cost', '$0.00', 'provider cost proof pending', 'info')}
        ${premiumMetric('Tool calls', '0', 'no execution recorded', 'info')}
        ${premiumMetric('Errors', '0', 'no visible errors', 'ok')}
      </section>
      <section class="platform-workspace platform-workspace--operator">
        <div class="platform-main">
          <div class="platform-section-title">Filters</div>
          <div class="usage-filter-bar usage-filter-bar--quiet" aria-label="Usage filters">
            <button>Today</button><button>7d</button><button>30d</button><button>All</button>
            <select aria-label="Provider filter"><option>All providers</option><option>Gemini</option><option>OpenRouter</option><option>Groq</option></select>
            <select aria-label="Channel filter"><option>All channels</option><option>Web</option><option>CLI</option><option>Telegram</option></select>
          </div>
          <div class="platform-action-list" aria-label="Usage actions">
            <button type="button" data-dashboard-prompt="Show token and cost usage for today."><strong>Today</strong><span>Summarize recent model usage.</span></button>
            <button type="button" data-dashboard-prompt="Show tool calls, errors and retries."><strong>Reliability</strong><span>Find costly failures or repeated retries.</span></button>
            <button type="button" data-dashboard-prompt="Show provider cost gaps and missing proof."><strong>Cost proof</strong><span>Explain what is measured and what is not.</span></button>
          </div>
        </div>
        <aside class="platform-side">
          <div class="platform-section-title">Signals</div>
          <div class="premium-status-list">
            ${premiumStatus('Usage ledger', 'ready', 'ok')}
            ${premiumStatus('Provider costs', 'when reported', 'info')}
            ${premiumStatus('Secrets', 'redacted', 'ok')}
            ${premiumStatus('Exports', 'manual', 'info')}
          </div>
        </aside>
      </section>
    </div>
  `);

  populate('sector-agents', `
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
  `);

  populate('sector-skills', `
    <div class="premium-page platform-page--operator">
      <section class="premium-hero premium-hero--compact platform-hero--operator">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Skills</span>
          <h1 class="premium-title">Skills, curated safely.</h1>
          <p class="premium-subtitle">Enable, inspect and evolve capabilities without hidden imports, unsafe writes or surprise execution.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Show skill curator proposals and only safe metadata updates first.">Open curator</button>
      </section>
      <section class="skill-toolbar skill-toolbar--quiet">
        <input type="search" placeholder="Search skills, tools or categories" aria-label="Search skills">
        <button>Ready</button><button>Needs setup</button><button>Drafts</button><button>Evolution</button>
      </section>
      <section class="platform-workspace platform-workspace--operator">
        <div class="platform-main">
          <div class="platform-section-title">Capability library</div>
          <section class="premium-skill-list premium-skill-list--quiet">
            ${skillRow('Workspace review', 'Ready', 'Read-only repo analysis, risks and next steps.', 'ok')}
            ${skillRow('Mnemos file understanding', 'Needs scope', 'Reads approved folders and explains documents with receipts.', 'info')}
            ${skillRow('Skill curator', 'Preview first', 'Suggests merge, quality score and metadata fixes before approval.', 'info')}
            ${skillRow('Transaction plane', 'Simulation', 'Previews and audits transactions; live money remains strongly gated.', 'warn')}
            ${skillRow('External agent onboarding', 'Consent required', 'Detects user-provided agent folders and creates profiles safely.', 'info')}
          </section>
        </div>
        <aside class="platform-side">
          <div class="platform-section-title">Curator</div>
          <div class="premium-status-list">
            ${premiumStatus('Draft creation', 'approval gated', 'ok')}
            ${premiumStatus('Merge proposals', 'preview first', 'info')}
            ${premiumStatus('External sources', 'blocked by default', 'ok')}
            ${premiumStatus('Rollback', 'receipt backed', 'ok')}
          </div>
        </aside>
      </section>
    </div>
  `);

  populate('sector-nodes', `
    <div class="premium-page platform-page--operator">
      <section class="premium-hero premium-hero--compact platform-hero--operator">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Nexus</span>
          <h1 class="premium-title">Runtime mesh, under control.</h1>
          <p class="premium-subtitle">Connected surfaces and optional agents stay visible, scoped and off by default when they need consent.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Show connected surfaces, external agents and sandbox backend readiness.">Inspect Nexus</button>
      </section>
      <section class="platform-workspace platform-workspace--operator">
        <div class="platform-main">
          <div class="platform-section-title">Connected capabilities</div>
          <div class="platform-action-list" aria-label="Nexus capabilities">
            <button type="button" data-dashboard-prompt="Show Mnemos vault scopes and readiness."><strong>Mnemos</strong><span>Memory vault scopes require explicit consent.</span></button>
            <button type="button" data-dashboard-prompt="Show Swarm v2 readiness and token budget."><strong>Swarm v2</strong><span>Parallel work with budget guard and receipts.</span></button>
            <button type="button" data-dashboard-prompt="Show ACP status and configured adapters."><strong>ACP</strong><span>Universal support, provider-agnostic and policy-gated.</span></button>
            <button type="button" data-dashboard-prompt="Show sandbox backend readiness."><strong>Execution backends</strong><span>Docker, WSL, SSH and remote sandboxes stay policy-gated.</span></button>
            <button type="button" data-dashboard-prompt="Show external agent onboarding profiles."><strong>External agents</strong><span>User-provided paths only; no silent scanning.</span></button>
          </div>
        </div>
        <aside class="platform-side">
          <div class="platform-section-title">Readiness</div>
          <div class="premium-status-list">
            ${premiumStatus('Mnemos', 'configurable', 'info')}
            ${premiumStatus('Swarm v2', 'ready', 'ok')}
            ${premiumStatus('ACP', 'opt-in', 'info')}
            ${premiumStatus('Backends', 'policy gated', 'warn')}
            ${premiumStatus('External agents', 'consent required', 'info')}
          </div>
        </aside>
      </section>
    </div>
  `);

  populate('sector-dreams', `
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
  `);

  populate('sector-config', `
    <div class="premium-page platform-page--operator">
      <section class="premium-hero premium-hero--compact platform-hero--operator">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Config</span>
          <h1 class="premium-title">Configuration, redacted.</h1>
          <p class="premium-subtitle">Providers, models, approvals, memory scopes and channel setup stay readable without exposing raw secrets.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Open settings health and tell me what should be configured next.">Settings health</button>
      </section>
      <section class="platform-workspace platform-workspace--operator">
        <div class="platform-main">
          <div class="setup-studio-strip" aria-label="Setup flow">
            ${setupStep('1. Provider', 'choose', 'Pick API route and model.')}
            ${setupStep('2. Test', 'optional', 'Run a live probe only when asked.')}
            ${setupStep('3. Channels', 'remote', 'Telegram and others remain opt-in.')}
            ${setupStep('4. Ready', 'verify', 'Run release/ready checks before daily use.')}
          </div>
          <div class="platform-section-title">Provider catalog</div>
          <div class="provider-picker-premium" aria-label="Provider picker">
            <button type="button" class="provider-picker-card is-active" data-dashboard-prompt="Show Gemini provider models, live proof and recommended default model.">
              <span>Active route</span><strong>Auto / Gemini</strong><small data-provider-picker="active">Uses configured route</small>
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
  `);

  populate('sector-docs', `
    <div class="premium-page">
      <section class="premium-hero premium-hero--compact">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Docs</span>
          <h1 class="premium-title">Use the product first, docs second.</h1>
          <p class="premium-subtitle">Short references explain setup, providers, approvals, memory, skills and safe execution.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Tell me the shortest path to use Zavorth today.">Quickstart</button>
      </section>
      <section class="premium-grid">
        ${surfaceCard('Quickstart', '2 minutes', 'ok', 'Open, choose a goal, verify provider and run the first safe task.')}
        ${surfaceCard('Approvals', 'Important', 'warn', 'Understand allow always, scoped approvals and break-glass mode.')}
        ${surfaceCard('Mnemos', 'Guided', 'info', 'Configure folders and ask about files safely.')}
        ${surfaceCard('Providers', 'Catalog', 'info', 'See which routes are configured, provable and live.')}
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

  function populate(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function bindPromptActions() {
    document.querySelectorAll('[data-dashboard-prompt]').forEach(button => {
      if (button.dataset.zavorthPromptBound === '1') return;
      button.dataset.zavorthPromptBound = '1';
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
      if (button.dataset.zavorthSectorBound === '1') return;
      button.dataset.zavorthSectorBound = '1';
      button.addEventListener('click', () => {
        const sector = button.getAttribute('data-dashboard-sector');
        if (sector) document.querySelector(`[data-sector="${sector}"]`)?.click();
      });
    });
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

  function skillRow(name, status, detail, tone) {
    return `<article class="skill-row skill-row--${tone}"><div><h2>${name}</h2><p>${detail}</p></div><span>${status}</span><label><input type="checkbox" class="toggle-switch" ${tone === 'ok' ? 'checked' : ''} aria-label="${name} enabled"></label></article>`;
  }
})();
