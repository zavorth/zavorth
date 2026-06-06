import { escapeHtml } from './html-utils';
import { formatBytes } from './text-utils';

export function shouldHandlePersonalDayFlow(userText: unknown, guidedFlow: string) {
  if (guidedFlow === 'personal-organize-day') return true;
  const lower = String(userText || '').toLowerCase();
  const asksOrganizeDay = /(organize|plan|arrange|structure).{0,28}\b(day|today|routine|schedule)\b/.test(lower)
    || lower.includes('organize my day')
    || lower.includes('personal mode');
  const asksCodeOrBusiness = /\b(workspace|repository|repo|business|audit|provider|channel|sandbox|terminal|command)\b/.test(lower);
  return asksOrganizeDay && !asksCodeOrBusiness;
}

export function buildPersonalDayFlowCards({ planId, profile, userText }: any) {
  const request = escapeHtml(String(userText || 'Organize my day safely.'));
  const safeProfile = escapeHtml(profile || 'personal');
  const safePlanId = escapeHtml(planId);
  return `
    <div class="personal-flow-grid" data-personal-flow="organize-day" data-selected-profile="${safeProfile}">
      <article class="personal-flow-card personal-flow-card--plan">
        <div class="personal-flow-card__header"><span>Daily plan</span><strong>read-only</strong></div>
        <ol class="personal-flow-steps">
          <li><strong>Now</strong><span>Write the 3 most important outcomes for today.</span></li>
          <li><strong>Next</strong><span>Group quick tasks into a 30 minute cleanup block.</span></li>
          <li><strong>Focus</strong><span>Protect one deep-work block before messages and errands.</span></li>
          <li><strong>Close</strong><span>End with a 10 minute review: done, blocked, tomorrow.</span></li>
        </ol>
      </article>
      <article class="personal-flow-card personal-flow-card--approval">
        <div class="personal-flow-card__header"><span>Approval rule</span><strong>simple</strong></div>
        <p>No approval is needed for planning only.</p>
        <p>Approval is required before creating reminders, sending messages, editing calendars, changing files or using external apps.</p>
      </article>
      <article class="personal-flow-card personal-flow-receipt" data-personal-flow-receipt="${safePlanId}">
        <div class="personal-flow-card__header"><span>Simple receipt</span><strong>done</strong></div>
        <dl>
          <div><dt>Request</dt><dd>${request}</dd></div>
          <div><dt>Mode</dt><dd>${safeProfile}</dd></div>
          <div><dt>Changed</dt><dd>Nothing outside this dashboard</dd></div>
          <div><dt>Approval</dt><dd>Not needed for this read-only plan</dd></div>
          <div><dt>Rollback</dt><dd>Not needed</dd></div>
        </dl>
      </article>
    </div>
  `;
}

export function shouldHandleDeveloperReviewFlow(userText: unknown, guidedFlow: string) {
  if (guidedFlow === 'developer-review-workspace') return true;
  const lower = String(userText || '').toLowerCase();
  const asksReview = /\b(review|audit|analyze|analyse|inspect)\b.{0,42}\b(repository|repo|workspace|project|codebase|folder)\b/.test(lower)
    || lower.includes('review this workspace')
    || lower.includes('review this repository')
    || lower.includes('developer mode');
  const asksPersonal = /\b(day|routine|reminder|calendar|message)\b/.test(lower);
  return asksReview && !asksPersonal;
}

export function buildDeveloperWorkspacePickerCard(userText: unknown) {
  const request = escapeHtml(String(userText || 'Review this repository safely.'));
  return `
    <div class="developer-flow-grid" data-developer-flow="workspace-picker">
      <article class="developer-flow-card developer-flow-card--wide">
        <div class="developer-flow-card__header"><span>Select workspace</span><strong>read-only first</strong></div>
        <p>Choose a repository folder so Zavorth can inspect file names and structure from the browser, or use the runtime workspace already configured on this host.</p>
        <div class="developer-flow-actions">
          <button type="button" class="interactive-btn interactive-btn--primary" data-developer-flow-action="select-folder">Select folder</button>
          <button type="button" class="interactive-btn" data-developer-flow-action="use-current-workspace">Use current workspace</button>
        </div>
      </article>
      <article class="developer-flow-card">
        <div class="developer-flow-card__header"><span>Request</span><strong>queued</strong></div>
        <p>${request}</p>
      </article>
      <article class="developer-flow-card">
        <div class="developer-flow-card__header"><span>Safety</span><strong>approval gated</strong></div>
        <p>Patch preview is allowed. Editing files requires scoped approval and rollback evidence.</p>
      </article>
    </div>
  `;
}

export function buildDeveloperReviewCards({ receiptId, workspace, userText }: any) {
  const safeReceiptId = escapeHtml(receiptId);
  const safeRoot = escapeHtml(workspace.root || 'current runtime workspace');
  const safeRequest = escapeHtml(String(userText || 'Review this repository safely.'));
  const fileCount = Number(workspace.fileCount || 0);
  const sampledFileCount = Number(workspace.sampledFileCount || 0);
  const totalBytes = formatBytes(workspace.totalBytes || 0);
  const extensionSummary = Array.isArray(workspace.topExtensions) && workspace.topExtensions.length
    ? workspace.topExtensions.map((entry: any) => `${escapeHtml(entry.extension)} ${Number(entry.count || 0)}`).join(', ')
    : 'runtime workspace';
  const sampleFiles = Array.isArray(workspace.sampleFiles) && workspace.sampleFiles.length
    ? workspace.sampleFiles.map((file: string) => `<li>${escapeHtml(file)}</li>`).join('')
    : '<li>Runtime workspace selected; live file list is owned by the runtime.</li>';
  return `
    <div class="developer-flow-grid" data-developer-flow="review-workspace" data-developer-receipt="${safeReceiptId}">
      <article class="developer-flow-card developer-flow-card--summary">
        <div class="developer-flow-card__header"><span>Repository review</span><strong>preview</strong></div>
        <dl class="developer-flow-facts">
          <div><dt>Workspace</dt><dd>${safeRoot}</dd></div>
          <div><dt>Files</dt><dd>${fileCount || 'runtime scoped'}</dd></div>
          <div><dt>Sampled</dt><dd>${sampledFileCount || 'runtime scoped'}</dd></div>
          <div><dt>Size</dt><dd>${totalBytes}</dd></div>
          <div><dt>Types</dt><dd>${extensionSummary}</dd></div>
        </dl>
      </article>
      <article class="developer-flow-card developer-flow-card--risks">
        <div class="developer-flow-card__header"><span>Risks found</span><strong>medium</strong></div>
        <ol class="developer-flow-list">
          <li><strong>Test gate</strong><span>Run a focused check before applying any patch.</span></li>
          <li><strong>Config drift</strong><span>Review package and environment files before dependency changes.</span></li>
          <li><strong>Secret exposure</strong><span>Keep tokens protected; never paste raw credentials into prompts or receipts.</span></li>
        </ol>
      </article>
      <article class="developer-flow-card developer-flow-card--wide">
        <div class="developer-flow-card__header"><span>Sample files</span><strong>read-only</strong></div>
        <ul class="developer-flow-samples">${sampleFiles}</ul>
      </article>
      <article class="developer-flow-card developer-flow-card--wide">
        <div class="developer-flow-card__header"><span>Patch preview</span><strong>approval required</strong></div>
        <pre class="developer-flow-diff"><code>diff --git a/README.md b/README.md
@@
+### Operational receipt
+Before applying code changes, Zavorth records the request, risk, approval scope and rollback evidence.</code></pre>
        <div class="developer-flow-actions" data-developer-approval="${safeReceiptId}" data-status="pending">
          <button type="button" class="interactive-btn" data-developer-flow-action="deny-patch" data-developer-receipt-id="${safeReceiptId}">Deny</button>
          <button type="button" class="interactive-btn interactive-btn--primary" data-developer-flow-action="approve-patch" data-developer-receipt-id="${safeReceiptId}">Approve preview</button>
        </div>
      </article>
      <article class="developer-flow-card developer-flow-receipt">
        <div class="developer-flow-card__header"><span>Developer receipt</span><strong>ready</strong></div>
        <dl class="developer-flow-facts">
          <div><dt>Request</dt><dd>${safeRequest}</dd></div>
          <div><dt>Changed</dt><dd>Nothing</dd></div>
          <div><dt>Approval</dt><dd>Required before editing files</dd></div>
          <div><dt>Rollback</dt><dd>Reverse patch or git diff before mutation</dd></div>
        </dl>
      </article>
    </div>
  `;
}

export function shouldHandleBusinessAuditFlow(userText: unknown, guidedFlow: string) {
  if (guidedFlow === 'business-audit') return true;
  const lower = String(userText || '').toLowerCase();
  const asksBusiness = lower.includes('business mode')
    || /\b(run|start|prepare|show)\b.{0,34}\b(audit|policy|approvals?|compliance|governance)\b/.test(lower)
    || /\b(audit|policy|approvals?|compliance|governance)\b.{0,34}\b(business|company|team|enterprise)\b/.test(lower);
  const asksDeveloperOnly = /\b(repository|repo|workspace|patch|codebase)\b/.test(lower);
  return asksBusiness && !asksDeveloperOnly;
}

export function buildBusinessAuditCards({ receiptId, ttlMinutes, userText }: any) {
  const safeReceiptId = escapeHtml(receiptId);
  const request = escapeHtml(String(userText || 'Run a governed business audit.'));
  return `
    <div class="business-flow-grid" data-business-flow="audit" data-business-receipt="${safeReceiptId}">
      <article class="business-flow-card business-flow-card--policy">
        <div class="business-flow-card__header"><span>Policy</span><strong>clear</strong></div>
        <ul class="business-flow-list">
          <li><strong>Can do</strong><span>Read status, summarize readiness, inspect receipts and list pending approvals.</span></li>
          <li><strong>Needs approval</strong><span>Change policy, send messages, connect live channels, edit files or run external actions.</span></li>
          <li><strong>Blocked</strong><span>Expose raw secrets, bypass the safety gate, replay expired approval or widen scope silently.</span></li>
        </ul>
      </article>
      <article class="business-flow-card business-flow-card--channel">
        <div class="business-flow-card__header"><span>Approval channel</span><strong>dashboard</strong></div>
        <p>Primary approval channel: ZavorthControl inbox. Optional channel delivery stays inactive until a separate channel is configured and tested live.</p>
        <div class="business-flow-actions" data-business-approval="${safeReceiptId}" data-status="pending">
          <button type="button" class="interactive-btn" data-business-flow-action="deny-channel" data-business-receipt-id="${safeReceiptId}">Deny</button>
          <button type="button" class="interactive-btn interactive-btn--primary" data-business-flow-action="confirm-channel" data-business-receipt-id="${safeReceiptId}">Confirm channel</button>
        </div>
      </article>
      <article class="business-flow-card">
        <div class="business-flow-card__header"><span>Scope</span><strong>bounded</strong></div>
        <dl class="business-flow-facts">
          <div><dt>Request</dt><dd>${request}</dd></div>
          <div><dt>Scope</dt><dd>readiness, approvals, receipts, channels</dd></div>
          <div><dt>TTL</dt><dd>${ttlMinutes} minutes for approval decisions</dd></div>
          <div><dt>Actor</dt><dd>Operator through dashboard</dd></div>
        </dl>
      </article>
      <article class="business-flow-card business-flow-card--blocked">
        <div class="business-flow-card__header"><span>Blocked actions</span><strong>enforced</strong></div>
        <ul class="business-flow-blocks">
          <li>Sending an external message without scoped approval.</li>
          <li>Changing channel tokens or exposing raw credentials.</li>
          <li>Editing files or policy outside the approved scope.</li>
          <li>Using a stale approval after the TTL expires.</li>
        </ul>
      </article>
      <article class="business-flow-card business-flow-receipt">
        <div class="business-flow-card__header"><span>Business receipt</span><strong>evidence</strong></div>
        <dl class="business-flow-facts">
          <div><dt>Receipt</dt><dd>${safeReceiptId}</dd></div>
          <div><dt>Approver</dt><dd>Operator, via dashboard approval channel</dd></div>
          <div><dt>Evidence</dt><dd>policy summary, scope, TTL, blocked actions, decision trace</dd></div>
          <div><dt>Changed</dt><dd>Nothing in preview</dd></div>
          <div><dt>Rollback</dt><dd>Not needed until a mutable approval is executed</dd></div>
        </dl>
      </article>
    </div>
  `;
}
