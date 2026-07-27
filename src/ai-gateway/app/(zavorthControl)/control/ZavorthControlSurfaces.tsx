import type { ReactNode } from "react";

type MetricProps = {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  tone?: "ok" | "warn" | "info";
};

type StatusProps = {
  label: string;
  value: ReactNode;
  tone?: "ok" | "warn" | "info";
};

type ActionProps = {
  title: string;
  detail: string;
  prompt?: string;
  sector?: string;
  className?: string;
  status?: string;
};

type SurfaceProps = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
};

function Metric({ label, value, sub, tone = "info" }: MetricProps) {
  return (
    <article className={`premium-metric premium-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}

function Status({ label, value, tone = "info" }: StatusProps) {
  return (
    <div className={`premium-status premium-status--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Action({ title, detail, prompt, sector, className, status }: ActionProps) {
  return (
    <button
      className={className}
      type="button"
      data-zavorthControl-prompt={prompt}
      data-zavorthControl-sector={sector}
      data-skill-status={status}
      data-skill-row={status ? "" : undefined}
      data-skill-search-text={status ? `${title} ${detail}`.toLowerCase() : undefined}
    >
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}

function Surface({ id, eyebrow, title, subtitle, actions, children }: SurfaceProps) {
  return (
    <section className="sector" id={id}>
      <div className="premium-page premium-page--platform platform-page--operator">
        <header className="premium-hero premium-hero--platform platform-hero--operator">
          <div>
            <span className="terminal-hero__status">{eyebrow}</span>
            <h1 className="premium-title">{title}</h1>
            <p className="premium-subtitle">{subtitle}</p>
          </div>
          {actions ? <div className="premium-hero__actions">{actions}</div> : null}
        </header>
        {children}
      </div>
    </section>
  );
}

function RuntimeTable({
  headers,
  emptyLabel,
}: {
  headers: string[];
  emptyLabel: string;
}) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="mono">{emptyLabel}</td>
            {headers.slice(1).map((header) => (
              <td key={header}>waiting</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Work overview surface. */
export function WorkSurface() {
  return (
    <Surface
      id="sector-overview"
      eyebrow="Work"
      title="Current work"
      subtitle="See what Zavorth is doing now, what needs a decision, and the safest next step."
      actions={
        <button
          className="operator-primary-action"
          type="button"
          data-zavorthControl-sector="terminal"
          data-dashboard-sector="terminal"
        >
          Open chat
        </button>
      }
    >
      <div className="work-simple-grid" data-react-dashboard-island="overview" data-react-dashboard-version="zavorth-control-react-islands/2026-07-12">
        <section className="work-simple-panel work-simple-panel--main">
          <span className="platform-section-title">Current task</span>
          <div className="work-current-task">
            <strong data-zavorthControl-runtime-title="" data-dashboard-runtime-title="">No task running</strong>
            <p data-zavorthControl-runtime-text="" data-dashboard-runtime-text="">
              Ask Zavorth in the Inbox. When a request could change files, call tools, or touch external state, Zavorth will preview the risk and ask for approval.
            </p>
            <button type="button" data-zavorthControl-sector="terminal" data-dashboard-sector="terminal">Ask Zavorth</button>
          </div>
          <div className="work-now-strip" aria-label="Current runtime facts">
            <span><strong data-live-runtime-state="">Runtime</strong><small data-live-runtime-detail="">Checking access</small></span>
            <span><strong data-live-gateway-state="">Gateway</strong><small data-live-gateway-detail="">local route</small></span>
            <span><strong data-live-sync-state="">Last sync</strong><small data-live-sync-detail="">Starting now</small></span>
          </div>
          <div className="goal-loop-strip" aria-label="Goal Loop daemon status">
            <span><strong data-goal-loop-state="">Goal Loop</strong><small data-goal-loop-detail="">No standing goal</small></span>
            <span><strong data-goal-loop-queue="">0 queued</strong><small data-goal-loop-task="">Worker idle</small></span>
            <span><strong data-goal-loop-next="">Next tick</strong><small data-goal-loop-heartbeat="">Waiting for heartbeat</small></span>
          </div>
          <div className="zavorth-gantt-chart" data-dashboard-timeline="" aria-label="Runtime trace timeline">
            <div className="zavorth-gantt-empty">
              <span className="zavorth-gantt-empty-dot" />
              <span>No trace yet.</span>
            </div>
          </div>
        </section>

        <section className="work-simple-panel">
          <span className="platform-section-title">Needs attention</span>
          <div className="work-decision-empty" data-attention-list="">
            <strong data-zavorthControl-approval-title="" data-dashboard-approval-title="">No pending approvals</strong>
            <p data-zavorthControl-approval-text="" data-dashboard-approval-text="">
              When Zavorth needs a decision, it appears here with approve, deny, or adjust scope.
            </p>
          </div>
          <div className="work-compact-status" style={{ marginTop: "0.75rem" }}>
            <Status label="Approvals" value={<span data-sales-os-metric="approvals">0</span>} />
            <Status label="Receipts" value={<span data-dashboard-metric="receipts">0</span>} />
            <Status label="Errors" value={<span data-dashboard-metric="errors">0</span>} />
          </div>
        </section>

        <section className="work-simple-panel work-simple-panel--status">
          <span className="platform-section-title">State</span>
          <div className="work-compact-status">
            <Status label="Engine" value={<span data-runtime-engine-active="">Lite</span>} tone="info" />
            <Status label="ZavorthControl" value="online" tone="ok" />
            <Status label="Goal Loop" value={<span data-goal-loop-status="">idle</span>} tone="info" />
            <Status label="Sensitive actions" value="approval gated" tone="ok" />
          </div>
        </section>
      </div>
    </Surface>
  );
}

/** Review and approvals surface. */
export function ReviewSurface() {
  return (
    <Surface
      id="sector-sales-os"
      eyebrow="Review"
      title="Approvals"
      subtitle="Risky work stays previewed, scoped, approved, and receipt-backed."
      actions={
        <button
          className="operator-primary-action"
          type="button"
          data-zavorthControl-prompt="Show pending approvals with approve, reject and limit controls."
          data-dashboard-prompt="Show pending approvals with approve, reject and limit controls."
        >
          Review queue
        </button>
      }
    >
      <div data-react-dashboard-island="sales-os">
        <div className="premium-metrics">
          <Metric label="Pending" value={<span data-sales-os-metric="approvals">0</span>} sub="awaiting decision" />
        </div>
        <section className="platform-workspace platform-workspace--operator">
          <div className="platform-main">
            <span className="platform-section-title">Queue</span>
            <div className="work-decision-empty" data-approvals-queue="">
              <strong data-dashboard-approval-title="" data-zavorthControl-approval-title="">No decision waiting</strong>
              <p data-dashboard-approval-text="" data-zavorthControl-approval-text="">Nothing pending.</p>
              <button type="button" data-dashboard-sector="terminal" data-zavorthControl-sector="terminal">Open chat</button>
            </div>
          </div>
          <aside className="platform-side">
            <span className="platform-section-title">Policy</span>
            <div className="premium-status-list">
              <Status label="Preview first" value="on" tone="ok" />
              <Status label="Break-glass" value="locked" tone="warn" />
              <Status label="Receipts" value="required" tone="ok" />
            </div>
          </aside>
        </section>
      </div>
    </Surface>
  );
}

/** Proof and receipts surface. */
export function ProofSurface() {
  return (
    <Surface
      id="sector-instances"
      eyebrow="Proof"
      title="Receipts"
      subtitle="Past work, decisions, and rollback guidance stay visible."
      actions={
        <button
          className="operator-primary-action"
          type="button"
          data-export-receipts=""
          data-dashboard-prompt="Export recent receipts and run history."
          data-zavorthControl-prompt="Export recent receipts and run history."
        >
          Export
        </button>
      }
    >
      <div data-react-dashboard-island="instances">
        <div data-trust-loop-host="" className="trust-loop-host" aria-live="polite" />
        <span className="platform-section-title">History</span>
        <h2 data-history-title="">No completed work yet</h2>
        <p className="daily-muted" data-history-summary="" hidden />
        <div className="data-table-wrap" data-receipts-list="">
          <table className="data-table">
            <thead>
              <tr>
                {["Item", "Source", "Artifacts", "Decision", "Updated", "Status"].map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">none yet</td>
                <td>Web</td>
                <td>0</td>
                <td>-</td>
                <td>-</td>
                <td>
                  <span className="badge badge--info">
                    <span className="badge__dot" />
                    Waiting
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Surface>
  );
}

/** Channels surface. */
export function ChannelsSurface() {
  const channels = [
    { name: "Dashboard", need: "local", status: "Ready", tone: "ok" as const },
    { name: "Telegram", need: "Bot token", status: "Set up", tone: "warn" as const },
    { name: "Discord", need: "Bot / app", status: "Set up", tone: "warn" as const },
    { name: "Slack", need: "Workspace", status: "Set up", tone: "warn" as const },
    { name: "WhatsApp", need: "Bridge", status: "Set up", tone: "warn" as const },
    { name: "Email", need: "Mailbox", status: "Set up", tone: "warn" as const },
  ];
  return (
    <Surface
      id="sector-channels"
      eyebrow="Channels"
      title="Routes into Zavorth"
      subtitle="local dashboard is ready. External channels only ask for credentials you own."
      actions={
        <button
          className="operator-primary-action"
          type="button"
          data-dashboard-prompt="Connect a channel. Show only missing credentials and the next setup step."
          data-zavorthControl-prompt="Connect a channel. Show only missing credentials and the next setup step."
        >
          Connect
        </button>
      }
    >
      <div className="premium-metrics">
        <Metric label="Connected" value="local" sub="Web / terminal" tone="ok" />
        <Metric label="Remote" value="Optional" sub="Token / webhook" />
        <Metric label="Last message" value="None" sub="-" />
      </div>
      <div className="platform-action-list">
        {channels.map((channel) => (
          <Action
            key={channel.name}
            title={channel.name}
            detail={`${channel.need} - ${channel.status}`}
            prompt={`Connect ${channel.name}. Show only missing credentials.`}
            className={`platform-action platform-action--${channel.tone}`}
          />
        ))}
      </div>
    </Surface>
  );
}

/** Sessions surface. */
export function SessionsSurface() {
  return (
    <Surface
      id="sector-sessions"
      eyebrow="Sessions"
      title="Session timeline"
      subtitle="Handoff context and per-session receipts."
      actions={
        <button className="operator-primary-action" type="button" data-dashboard-sector="terminal" data-zavorthControl-sector="terminal">
          Open chat
        </button>
      }
    >
      <section className="skill-toolbar skill-toolbar--quiet">
        <input type="search" placeholder="Search sessions" aria-label="Search sessions" data-session-search="" />
      </section>
      <div className="data-table-wrap">
        <table className="data-table" data-sessions-table="">
          <thead>
            <tr>
              {["Session", "Channel", "Events", "Receipts", "Status"].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">main</td>
              <td>Web</td>
              <td>0</td>
              <td>0</td>
              <td>
                <span className="badge badge--info">
                  <span className="badge__dot" />
                  Waiting
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

/** Cron surface. */
export function CronSurface() {
  return (
    <Surface
      id="sector-cron"
      eyebrow="Cron"
      title="Scheduled work"
      subtitle="Monitors and reminders use natural language schedules when configured."
      actions={
        <button
          className="operator-primary-action"
          type="button"
          data-dashboard-prompt="List scheduled jobs and what runs next."
          data-zavorthControl-prompt="List scheduled jobs and what runs next."
        >
          List jobs
        </button>
      }
    >
      <div className="premium-metrics">
        <Metric label="Jobs" value="0" sub="none registered" />
        <Metric label="Next run" value="-" sub="waiting" />
        <Metric label="Kill switch" value="off" sub="honored when set" tone="ok" />
      </div>
      <RuntimeTable headers={["Job", "Type", "Attempts", "Next", "Updated", "Status"]} emptyLabel="none" />
    </Surface>
  );
}

/** Runtime adapters surface. */
export function AgentsSurface() {
  return (
    <Surface
      id="sector-agents"
      eyebrow="Agents"
      title="Runtime adapters"
      subtitle="Profiles, sandbox posture, previewed execution, and receipts."
      actions={
        <button className="operator-primary-action" type="button" data-runtime-adapter-action="refresh">
          Sync
        </button>
      }
    >
      <div className="premium-metrics">
        <Metric label="Profiles" value={<span data-runtime-adapter-metric="profiles">0</span>} sub="registered" />
        <Metric label="Live" value={<span data-runtime-adapter-metric="live">0</span>} sub="approval gated" />
        <Metric label="Sandbox" value={<span data-runtime-adapter-metric="sandbox">0</span>} sub="isolated" />
      </div>
      <RuntimeTable
        headers={["Profile", "Adapter", "Sandbox", "Live", "Receipt", "Policy"]}
        emptyLabel="none"
      />
      <div className="card-grid card-grid--quiet" data-runtime-adapter-grid="" hidden />
    </Surface>
  );
}

/** Docs surface. */
export function DocsSurface() {
  return (
    <Surface
      id="sector-docs"
      eyebrow="Docs"
      title="Short references"
      subtitle="Setup, models, memory, tools, and safe execution."
      actions={
        <button
          className="operator-primary-action"
          type="button"
          data-dashboard-prompt="Open the product docs for getting started."
          data-zavorthControl-prompt="Open the product docs for getting started."
        >
          Open docs
        </button>
      }
    >
      <div className="platform-action-list">
        <Action title="Getting started" detail="local runtime, first chat, and approvals." prompt="Explain how to get started with Zavorth Control safely." />
        <Action title="Models" detail="User-owned routes only - no invented vendors." prompt="Explain how to configure my model stack without inventing providers." />
        <Action title="Memory" detail="What is remembered, why, and how to forget." prompt="Explain Zavorth memory privacy and how to forget facts." />
        <Action title="Safety" detail="Preview, approve, receipt." prompt="Explain the approval and receipt loop." />
      </div>
    </Surface>
  );
}

export function CanvasSurface() {
  return (
    <Surface
      id="sector-canvas"
      eyebrow="Canvas"
      title="Sandbox preview first."
      subtitle="Review attempts, diffs and blocked network calls before anything is applied to your workspace."
      actions={<button className="operator-primary-action" type="button" data-zavorthControl-prompt="Open Z-Canvas for the current request and show preview, diff, logs and risks before applying anything.">Use Canvas</button>}
    >
      <section className="z-canvas-shell" data-canvas-root>
        <div className="z-canvas-loading">Starting sandbox preview...</div>
      </section>
    </Surface>
  );
}

export function MemorySurface() {
  return (
    <Surface
      id="sector-nodes"
      eyebrow="Memory"
      title="Zavorth memory"
      subtitle="Control what Zavorth may remember, which files it can read, and which agents can work alongside it."
      actions={<button className="operator-primary-action" type="button" data-zavorthControl-prompt="Show what Zavorth can remember right now and which scopes are active.">View memory</button>}
    >
      <div className="platform-workspace platform-workspace--operator">
        <div className="platform-main">
          <span className="platform-section-title">Controls</span>
          <div className="tool-empty-action">
            <strong>No memory scope required yet.</strong>
            <span>Start with a folder, document, or rule that Zavorth should remember only when useful.</span>
            <button type="button" data-zavorthControl-prompt="Help me add a safe memory scope. Ask what folder or fact should be remembered, then explain how to forget it later.">Add memory scope</button>
          </div>
          <div className="agent-os-live-summary" aria-label="Live memory summary">
            <span><strong data-memory-live-files>waiting</strong><small>file memory</small></span>
            <span><strong data-memory-live-agents>0</strong><small>linked agents</small></span>
            <span><strong data-memory-live-env>approval gated</strong><small>execution</small></span>
          </div>
          <div className="platform-action-list">
            <Action title="File memory" detail="Folders and documents enter only with approved scope." prompt="Show file memory scopes and which folders are allowed." />
            <Action title="Parallel work" detail="Uses cost limits and receipts when useful." prompt="Show whether Zavorth can split a task into parallel work and which limits apply." />
            <Action title="Connect adapter" detail="No runtime adapter is discovered without a path you provide." prompt="Show connected runtime adapters and how to limit what each can do." />
            <Action title="Execution environments" detail="Files, shell, and remote actions stay approval gated." prompt="Show available execution environments and which ones require approval." />
          </div>
        </div>
        <aside className="platform-side">
          <span className="platform-section-title">State</span>
          <div className="premium-status-list">
            <Status label="File memory" value="configurable" />
            <Status label="Parallel work" value="ready" tone="ok" />
            <Status label="External links" value="consent required" />
            <Status label="Safe execution" value="approval gated" tone="warn" />
          </div>
        </aside>
      </div>
    </Surface>
  );
}

export function LearningSurface() {
  return (
    <section className="sector" id="sector-dreams">
      <div className="premium-page learning-page" data-learning-dreams-root="">
        <div className="learning-loading">Checking Zavorth learning...</div>
      </div>
    </section>
  );
}

export function SkillsSurface() {
  return (
    <Surface
      id="sector-skills"
      eyebrow="Tools"
      title="Zavorth tools"
      subtitle="Use ready capabilities when they help the current task. Risky work still asks for approval."
      actions={<button className="operator-primary-action" type="button" data-zavorthControl-prompt="Suggest the best Zavorth tool for my current task and explain why.">Suggest tool</button>}
    >
      <section className="skill-toolbar skill-toolbar--quiet">
        <input type="search" placeholder="Search tools" aria-label="Search tools" data-skill-search />
        <button type="button" className="is-active" data-skill-filter="all">All</button>
        <button type="button" data-skill-filter="ready">Ready</button>
        <button type="button" data-skill-filter="setup">Needs setup</button>
        <button type="button" data-skill-filter="approval">Approval gated</button>
      </section>
      <section className="platform-workspace platform-workspace--operator">
        <div className="platform-main">
          <span className="platform-section-title">Library</span>
          <div className="tool-empty-action">
            <strong>Not sure what to use...</strong>
            <span>Ask Zavorth to choose the lightest safe tool for the current request.</span>
            <button type="button" data-zavorthControl-prompt="Choose the lightest safe tool for my current request. Explain the risk before using anything.">Choose for me</button>
          </div>
          <div className="agent-os-live-summary" aria-label="Live tool summary">
            <span><strong data-tools-live-count>0</strong><small>runtime tools</small></span>
            <span><strong data-tools-live-ready>waiting</strong><small>ready state</small></span>
            <span><strong data-tools-live-last>no tool yet</strong><small>last signal</small></span>
          </div>
          <div className="premium-skill-list premium-skill-list--quiet">
            <article className="skill-row skill-row--ok" data-skill-row="" data-skill-status="ready" data-skill-search-text="review workspace project read only clear risks">
              <div><h2>Review workspace</h2><p>Reads the project and highlights clear risks without editing files.</p></div>
              <span>Ready</span>
              <button type="button" className="skill-row__use" data-zavorthControl-prompt="Review my workspace in read-only mode and show the highest-risk items first.">Use</button>
            </article>
            <article className="skill-row skill-row--info" data-skill-row="" data-skill-status="setup" data-skill-search-text="understand files folders documents scope">
              <div><h2>Understand files</h2><p>Uses only approved folders to explain documents.</p></div>
              <span>Needs scope</span>
              <button type="button" className="skill-row__use" data-zavorthControl-prompt="Show me how to configure a safe folder scope for file memory.">Use</button>
            </article>
            <article className="skill-row skill-row--info" data-skill-row="" data-skill-status="approval" data-skill-search-text="tool curator preview approval">
              <div><h2>Tool curator</h2><p>Suggests improvements without changing anything before approval.</p></div>
              <span>Preview first</span>
              <button type="button" className="skill-row__use" data-zavorthControl-prompt="Open the tool curator in preview mode and show only safe suggestions.">Use</button>
            </article>
          </div>
        </div>
        <aside className="platform-side">
          <span className="platform-section-title">Safety</span>
          <div className="premium-status-list">
            <Status label="New tools" value="approval gated" tone="ok" />
            <Status label="Changes" value="preview first" />
            <Status label="External sources" value="blocked" tone="ok" />
            <Status label="Undo" value="receipt backed" tone="ok" />
          </div>
        </aside>
      </section>
    </Surface>
  );
}

export function ProvidersSurface() {
  return (
    <Surface
      id="sector-usage"
      eyebrow="Models"
      title="AI models"
      subtitle="See which route Zavorth uses, whether it is ready, and what has been measured in this session."
      actions={<button className="operator-primary-action" type="button" data-zavorthControl-prompt="Explain the current AI model, provider route, fallback, and anything that still needs setup.">View current model</button>}
    >
      <div className="premium-metrics">
        <Metric label="Tokens" value="0" sub="no measured usage" />
        <Metric label="Cost" value="$0.00" sub="waiting for provider proof" />
        <Metric label="Calls" value="0" sub="no tools executed" />
        <Metric label="Errors" value="0" sub="no visible errors" tone="ok" />
      </div>
      <section className="platform-workspace platform-workspace--operator">
        <div className="platform-main">
          <span className="platform-section-title">Actions</span>
          <div className="platform-action-list">
            <Action title="Active model" detail="Uses the configured route right now." prompt="Explain Zavorth's active model, provider, fallback, and when I should switch routes." />
            <Action title="Test route" detail="Runs a safe readiness check before use." prompt="Test the current AI route with a safe sanitized check. Do not expose secrets." />
            <Action title="Recent usage" detail="Summarizes what has been measured." prompt="Show tokens, cost, tool calls, and measurement gaps for this session." />
          </div>
          <span className="platform-section-title">Catalog</span>
          <div className="info-grid info-grid--quiet" data-provider-model-catalog-summary>
            <div className="info-row"><span className="info-row__label">Routes</span><span className="info-row__value mono">waiting</span></div>
            <div className="info-row"><span className="info-row__label">Ready</span><span className="info-row__value mono">waiting</span></div>
            <div className="info-row"><span className="info-row__label">Models</span><span className="info-row__value mono">waiting</span></div>
            <div className="info-row"><span className="info-row__label">Media</span><span className="info-row__value mono">waiting</span></div>
          </div>
          <div className="card-grid card-grid--quiet" data-provider-model-catalog-list />
        </div>
        <aside className="platform-side">
          <span className="platform-section-title">State</span>
          <div className="premium-status-list">
            <Status label="Usage" value="local" />
            <Status label="Costs" value="when reported" />
            <Status label="Secrets" value="redacted" tone="ok" />
            <Status label="Export" value="manual" />
          </div>
        </aside>
      </section>
    </Surface>
  );
}

export function SettingsSurface() {
  return (
    <Surface
      id="sector-config"
      eyebrow="Settings"
      title="Configuration without exposing secrets."
      subtitle="Runtime access, provider routing, approvals, break-glass posture and receipt controls are summarized here."
      actions={<button className="operator-secondary-action" type="button" data-zavorthControl-prompt="Show settings that need attention and suggest safe guided fixes.">Guided fixes</button>}
    >
      <div className="premium-layout premium-layout--wide-left">
        <div className="platform-main">
          <div className="info-grid info-grid--quiet">
            {["Endpoint", "Auth", "Status", "Chat", "Agents", "Fallback", "Protocol"].map((label) => (
              <div className="info-row" key={label}>
                <span className="info-row__label">{label}</span>
                <span className="info-row__value">checking</span>
              </div>
            ))}
          </div>
        </div>
        <aside className="platform-side">
          <span className="platform-section-title">Trust posture</span>
          <div className="premium-status-list">
            <Status label="Auto approvals" value="limited" />
            <Status label="Break-glass" value="locked" tone="warn" />
            <Status label="Receipts" value="on" tone="ok" />
            <Status label="Secrets" value="redacted" tone="ok" />
          </div>
        </aside>
      </div>
    </Surface>
  );
}
