/**
 * Phase 8 / 8.1 / 8.2 — Incremental React dashboard islands for the Vite control shell.
 *
 * These components render static structure with the same data-* hooks that
 * runtime-bridge / dashboard-live-view already fill. No big-bang rewrite:
 * Work, Review, Proof, Channels, Sessions, Cron, Agents, Skills, Config.
 */
import type { ReactNode } from "react";
import { CONTROL_LOCALES, readControlLocalePreference } from "../locale";
import {
  listUserSelectionChannels,
  listUserSelectionProviders,
} from "../../../../src/services/selection/UserSelectionCatalog";

export const DASHBOARD_REACT_ISLAND_VERSION = "zavorth-control-react-islands/2026-07-12" as const;

export type DashboardReactIslandId =
  | "overview"
  | "sales-os"
  | "instances"
  | "channels"
  | "sessions"
  | "cron"
  | "agents"
  | "skills"
  | "config";

export const DASHBOARD_REACT_ISLANDS: ReadonlyArray<{
  id: DashboardReactIslandId;
  sectorElementId: string;
  label: string;
  engine: "react-ssr";
}> = [
  { id: "overview", sectorElementId: "sector-overview", label: "Work", engine: "react-ssr" },
  { id: "sales-os", sectorElementId: "sector-sales-os", label: "Review", engine: "react-ssr" },
  { id: "instances", sectorElementId: "sector-instances", label: "Proof", engine: "react-ssr" },
  { id: "channels", sectorElementId: "sector-channels", label: "Channels", engine: "react-ssr" },
  { id: "sessions", sectorElementId: "sector-sessions", label: "Sessions", engine: "react-ssr" },
  { id: "cron", sectorElementId: "sector-cron", label: "Cron", engine: "react-ssr" },
  { id: "agents", sectorElementId: "sector-agents", label: "Agents", engine: "react-ssr" },
  { id: "skills", sectorElementId: "sector-skills", label: "Skills", engine: "react-ssr" },
  { id: "config", sectorElementId: "sector-config", label: "Settings", engine: "react-ssr" },
];

function DailyHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="daily-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="daily-header__actions">{actions}</div> : null}
    </header>
  );
}

function DailyMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
}) {
  return (
    <article className="daily-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}

function SectorButton({
  sector,
  children,
  primary,
}: {
  sector: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      className={primary ? "daily-button daily-button--primary" : "daily-button"}
      type="button"
      data-dashboard-sector={sector}
      data-zavorthControl-sector={sector}
    >
      {children}
    </button>
  );
}

function PromptButton({
  prompt,
  children,
  primary,
  ghost,
}: {
  prompt: string;
  children: ReactNode;
  primary?: boolean;
  ghost?: boolean;
}) {
  const className = primary
    ? "daily-button daily-button--primary"
    : ghost
      ? "daily-button daily-button--ghost"
      : "daily-button";
  return (
    <button
      className={className}
      type="button"
      data-dashboard-prompt={prompt}
      data-zavorthControl-prompt={prompt}
    >
      {children}
    </button>
  );
}

function ChannelRow({
  name,
  subtitle,
  status,
  tone,
  primary,
  secondary,
  prompt,
}: {
  name: string;
  subtitle: string;
  status: string;
  tone: "ok" | "warn" | "info";
  primary: string;
  secondary: string;
  prompt: string;
}) {
  return (
    <article className={`daily-channel-row daily-channel-row--${tone}`}>
      <span className="daily-status-dot" aria-hidden="true" />
      <div className="daily-row__main">
        <h2>
          {name}
          <small>{subtitle}</small>
        </h2>
      </div>
      <span className={`daily-status daily-status--${tone}`}>{status}</span>
      <div className="daily-row__actions">
        <PromptButton prompt={prompt}>{primary}</PromptButton>
        <PromptButton
          ghost
          prompt={`Show setup status, last error and next step for ${name}.`}
        >
          {secondary}
        </PromptButton>
      </div>
    </article>
  );
}

/** Work overview — primary dock "Work" sector. */
export function WorkOverviewIsland() {
  return (
    <div
      className="daily-page daily-page--work dashboard-glass"
      data-zavorth-premium-dashboard-v2=""
      data-react-dashboard-island="overview"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Work"
        actions={
          <>
            <SectorButton sector="terminal" primary>Open chat</SectorButton>
            <SectorButton sector="sales-os">Review</SectorButton>
            <SectorButton sector="instances">Proof</SectorButton>
            <button className="daily-button" type="button" data-dashboard-doctor="">
              Doctor
            </button>
          </>
        }
      />
      <section className="next-action-host" data-next-action="" aria-label="Next action" />
      <div className="trust-loop-chrome-host" data-trust-loop-chrome-host="" aria-label="Trust Loop status" />
      <section className="daily-panel daily-panel--attention" aria-label="Attention">
        <div className="daily-panel__head">
          <div>
            <span>Attention</span>
            <h2 data-dashboard-approval-title="" data-zavorthControl-approval-title="">
              Nothing needs you
            </h2>
          </div>
          <SectorButton sector="sales-os" primary>Review</SectorButton>
        </div>
        <div data-attention-list="" className="daily-list">
          <p className="daily-muted">Nothing needs you</p>
        </div>
      </section>
      <section className="daily-action-row" aria-label="Primary actions">
        <button type="button" data-dashboard-sector="terminal" data-zavorthControl-sector="terminal">New chat</button>
        <button type="button" data-dashboard-sector="sales-os" data-zavorthControl-sector="sales-os">Review</button>
        <button type="button" data-dashboard-sector="instances" data-zavorthControl-sector="instances">Proof</button>
        <button type="button" data-dashboard-doctor="">Doctor</button>
        <button type="button" data-dashboard-sector="channels" data-zavorthControl-sector="channels">Channels</button>
        <button type="button" data-dashboard-sector="usage" data-zavorthControl-sector="usage">Models</button>
      </section>
      <section className="daily-stat-row daily-stat-row--compact" aria-label="Work status">
        <DailyMetric
          label="Status"
          value={<span data-live-runtime-state="">Ready</span>}
          sub={<span data-live-runtime-detail="">Idle</span>}
        />
        <DailyMetric
          label="Approvals pending"
          value={<span data-sales-os-metric="approvals">0</span>}
          sub={<span data-sales-os-meta="approvals">None</span>}
        />
        <DailyMetric
          label="Receipts"
          value={<span data-dashboard-metric="receipts">0</span>}
          sub={<span data-inbox-metric="receipts">0</span>}
        />
        <DailyMetric
          label="Errors"
          value={<span data-dashboard-metric="errors">0</span>}
          sub="Trace"
        />
        <DailyMetric
          label="Trust"
          value={
            <span className="session-trust-score" data-session-trust-score="">
              <strong data-session-trust-value="">—</strong>{" "}
              <span data-session-trust-label="" />
            </span>
          }
          sub="Session"
        />
      </section>
      <section className="workboard-lite" data-workboard-lite="" aria-label="Workboard">
        <div className="workboard-lite__col" data-workboard-col="pending">
          <h3>Pending</h3>
          <ul data-workboard-list="pending"><li className="daily-muted">—</li></ul>
        </div>
        <div className="workboard-lite__col" data-workboard-col="running">
          <h3>Running</h3>
          <ul data-workboard-list="running"><li className="daily-muted">—</li></ul>
        </div>
        <div className="workboard-lite__col" data-workboard-col="done">
          <h3>Done</h3>
          <ul data-workboard-list="done"><li className="daily-muted">—</li></ul>
        </div>
      </section>
      <div className="agent-os-live-summary" hidden aria-hidden="true">
        Runtime summary is available to the live bridge.
      </div>
      <section className="daily-layout daily-layout--main" aria-label="Work overview">
        <article className="daily-panel daily-panel--primary">
          <div className="daily-panel__head">
            <div>
              <span>Now</span>
              <h2 data-dashboard-runtime-title="" data-zavorthControl-runtime-title="">
                No task running
              </h2>
            </div>
            <SectorButton sector="terminal">Open chat</SectorButton>
          </div>
          <p className="daily-muted" data-dashboard-runtime-text="" data-zavorthControl-runtime-text="">
            Ready.
          </p>
          <div className="zavorth-gantt-chart" data-dashboard-timeline="" aria-label="Runtime trace timeline">
            <div className="zavorth-gantt-empty">
              <span className="zavorth-gantt-empty-dot" />
              <span>No trace yet.</span>
            </div>
          </div>
          <details className="daily-disclosure daily-disclosure--quiet">
            <summary>Logs</summary>
            <div className="zavorth-console-panel daily-console">
              <div className="zavorth-console-header">
                <span className="zavorth-console-dot" />
                <span className="zavorth-console-title">Live log</span>
                <button className="zavorth-console-clear" type="button">Clear</button>
              </div>
              <div className="zavorth-console-body" id="zavorth-console-events">
                <div className="zavorth-console-line zavorth-console-line--system">
                  <span className="zavorth-console-time">[00:00]</span>
                  <span className="zavorth-console-tag">[SESSION]</span>
                  <span className="zavorth-console-text">Dashboard connected.</span>
                </div>
              </div>
            </div>
          </details>
        </article>
        <aside className="daily-stack">
          <article className="daily-panel">
            <div className="daily-panel__head">
              <div><span>System</span><h2>Connection</h2></div>
            </div>
            <div className="daily-key-value">
              <div className="daily-key-value__row"><span>Runtime</span><strong><span data-live-runtime-state="">Ready</span></strong></div>
              <div className="daily-key-value__row"><span>Gateway</span><strong><span data-live-gateway-state="">Local</span></strong></div>
              <div className="daily-key-value__row"><span>Route</span><strong><span data-live-gateway-detail="">Web</span></strong></div>
              <div className="daily-key-value__row"><span>Sync</span><strong><span data-live-sync-detail="">Starting</span></strong></div>
              <div className="daily-key-value__row"><span>Mode</span><strong><span data-runtime-engine-active="">Lite</span></strong></div>
            </div>
            <p className="daily-muted" hidden data-dashboard-approval-text="" data-zavorthControl-approval-text="">
              Nothing pending.
            </p>
          </article>
          <article className="daily-panel" data-policy-simulator="">
            <div className="daily-panel__head">
              <div><span>Policy</span><h2>Simulator</h2></div>
            </div>
            <div className="policy-sim-row">
              <input
                type="text"
                data-policy-sim-input=""
                placeholder="What if I ask..."
                aria-label="Policy what-if prompt"
                autoComplete="off"
              />
              <button className="daily-button" type="button" data-policy-sim-run="">
                Simulate
              </button>
            </div>
            <ul className="policy-sim-results" data-policy-sim-results="">
              <li className="daily-muted">Predicted gates appear here.</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  );
}

/** Review / approvals sector. */
export function ReviewApprovalsIsland() {
  return (
    <div
      className="daily-page"
      data-react-dashboard-island="sales-os"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Approvals"
        actions={
          <button
            className="daily-button daily-button--primary"
            type="button"
            data-dashboard-prompt="Show pending approvals with approve, reject and limit controls."
            data-zavorthControl-prompt="Show pending approvals with approve, reject and limit controls."
          >
            Review
          </button>
        }
      />
      <section className="daily-stat-row daily-stat-row--compact" aria-label="Approval status">
        <DailyMetric
          label="Pending"
          value={<span data-sales-os-metric="approvals">0</span>}
          sub={<span data-sales-os-meta="approvals">None</span>}
        />
      </section>
      <section className="daily-panel daily-panel--primary">
        <div className="daily-panel__head">
          <div>
            <span>Queue</span>
            <h2 data-dashboard-approval-title="" data-zavorthControl-approval-title="">
              No decision waiting
            </h2>
          </div>
          <SectorButton sector="terminal">Open chat</SectorButton>
        </div>
        <div data-approvals-queue="" className="daily-list">
          <p className="daily-muted" data-dashboard-approval-text="" data-zavorthControl-approval-text="">
            Nothing pending.
          </p>
          <SectorButton sector="terminal">Open chat</SectorButton>
        </div>
      </section>
    </div>
  );
}

/** Proof / receipts sector. */
export function ProofReceiptsIsland() {
  return (
    <div
      className="daily-page"
      data-react-dashboard-island="instances"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Receipts"
        actions={
          <>
            <button
              className="daily-button daily-button--primary"
              type="button"
              data-export-receipts=""
              data-dashboard-prompt="Export recent receipts and run history."
              data-zavorthControl-prompt="Export recent receipts and run history."
            >
              Export
            </button>
            <SectorButton sector="terminal">Open chat</SectorButton>
          </>
        }
      />
      <div data-trust-loop-host="" className="trust-loop-host" aria-live="polite" />
      <section className="daily-panel daily-panel--primary">
        <div className="daily-panel__head">
          <div>
            <span>History</span>
            <h2 data-history-title="">No completed work yet</h2>
          </div>
        </div>
        <p className="daily-muted" data-history-summary="" hidden />
        <div className="data-table-wrap" data-receipts-list="">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Source</th>
                <th>Artifacts</th>
                <th>Decision</th>
                <th>Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">none yet</td>
                <td>Web</td>
                <td>0</td>
                <td>—</td>
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
      </section>
    </div>
  );
}

/** Channels — routes into Zavorth (More dock). */
export function ChannelsIsland() {
  const channels: Array<{
    name: string;
    subtitle: string;
    status: string;
    tone: "ok" | "warn";
    primary: string;
    secondary: string;
    prompt: string;
  }> = [
    {
      name: "Dashboard",
      subtitle: "Local",
      status: "Ready",
      tone: "ok",
      primary: "Open",
      secondary: "Test",
      prompt: "Open the local dashboard chat.",
    },
    {
      name: "Telegram",
      subtitle: "Bot token",
      status: "Set up",
      tone: "warn",
      primary: "Connect",
      secondary: "Test",
      prompt: "Connect Telegram. Show only missing credentials.",
    },
    {
      name: "Discord",
      subtitle: "Bot / app",
      status: "Set up",
      tone: "warn",
      primary: "Connect",
      secondary: "Test",
      prompt: "Connect Discord. Show only missing credentials.",
    },
    {
      name: "Slack",
      subtitle: "Workspace",
      status: "Set up",
      tone: "warn",
      primary: "Connect",
      secondary: "Test",
      prompt: "Connect Slack. Show only missing credentials.",
    },
    {
      name: "WhatsApp",
      subtitle: "Bridge",
      status: "Set up",
      tone: "warn",
      primary: "Connect",
      secondary: "Test",
      prompt: "Connect WhatsApp. Show only missing credentials.",
    },
    {
      name: "Email",
      subtitle: "Mailbox",
      status: "Set up",
      tone: "warn",
      primary: "Connect",
      secondary: "Test",
      prompt: "Connect email. Show only missing credentials.",
    },
    {
      name: "Signal",
      subtitle: "Bridge",
      status: "Set up",
      tone: "warn",
      primary: "Connect",
      secondary: "Test",
      prompt: "Connect Signal. Show only missing credentials.",
    },
    {
      name: "Teams",
      subtitle: "App",
      status: "Set up",
      tone: "warn",
      primary: "Connect",
      secondary: "Test",
      prompt: "Connect Teams. Show only missing credentials.",
    },
  ];

  return (
    <div
      className="daily-page"
      data-react-dashboard-island="channels"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Channels"
        actions={
          <>
            <PromptButton
              primary
              prompt="Connect a channel. Show only missing credentials and the next setup step."
            >
              Connect
            </PromptButton>
            <PromptButton prompt="Test configured channels and show only failures or missing credentials.">
              Test
            </PromptButton>
          </>
        }
      />
      <section className="daily-stat-row daily-stat-row--compact" aria-label="Channel status">
        <DailyMetric label="Connected" value="Local" sub="Web / terminal" />
        <DailyMetric label="Remote" value="Optional" sub="Token / webhook" />
        <DailyMetric label="Last message" value="None" sub="—" />
      </section>
      <section className="daily-panel daily-panel--list daily-panel--flush">
        <div className="daily-panel__head">
          <div>
            <span>Channels</span>
            <h2>Routes</h2>
          </div>
        </div>
        <div className="daily-list daily-list--compact">
          {channels.map((channel) => (
            <ChannelRow key={channel.name} {...channel} />
          ))}
        </div>
        {/* Optional live-bridge card grid host (runtime-bridge setCardGrid). */}
        <div className="card-grid card-grid--quiet" hidden aria-hidden="true" />
      </section>
    </div>
  );
}

/** Sessions — timeline and handoff context (More dock). */
export function SessionsIsland() {
  return (
    <div
      className="daily-page"
      data-react-dashboard-island="sessions"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Sessions"
        actions={<SectorButton sector="terminal" primary>Open chat</SectorButton>}
      />
      <section className="daily-toolbar" aria-label="Session filters">
        <input
          type="search"
          placeholder="Search sessions"
          aria-label="Search sessions"
          data-session-search=""
        />
      </section>
      <section className="daily-panel daily-panel--flush">
        <div className="data-table-wrap">
          <table className="data-table" data-sessions-table="">
            <thead>
              <tr>
                <th>Session</th>
                <th>Channel</th>
                <th>Events</th>
                <th>Receipts</th>
                <th>Status</th>
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
      </section>
    </div>
  );
}

/** Cron — scheduled work, monitors, reminders (More dock). */
export function CronIsland() {
  return (
    <div
      className="daily-page"
      data-react-dashboard-island="cron"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Cron"
        actions={
          <PromptButton
            primary
            prompt="List scheduled jobs and what runs next."
          >
            List jobs
          </PromptButton>
        }
      />
      <section className="daily-stat-row daily-stat-row--compact" aria-label="Cron status">
        <DailyMetric label="Jobs" value="0" sub="none registered" />
        <DailyMetric label="Next run" value="—" sub="waiting" />
        <DailyMetric label="Kill switch" value="off" sub="honored when set" />
      </section>
      <section className="daily-panel daily-panel--primary">
        <div className="daily-panel__head">
          <div>
            <span>Automations</span>
            <h2>Scheduled work</h2>
          </div>
          <PromptButton prompt="Show scheduled tasks and whether any are risky or noisy.">
            Check automations
          </PromptButton>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Type</th>
                <th>Attempts</th>
                <th>Next</th>
                <th>Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">none</td>
                <td>local</td>
                <td>0</td>
                <td>—</td>
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
      </section>
    </div>
  );
}

/** Agents — runtime adapters, register form, preview/run, receipts (More dock). */
export function AgentsIsland() {
  return (
    <div
      className="daily-page runtime-adapter-dashboard"
      data-react-dashboard-island="agents"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Agents"
        subtitle="Use local runtime adapters through governed policies."
        actions={
          <button
            className="daily-button daily-button--primary"
            type="button"
            data-runtime-adapter-action="refresh"
          >
            Sync
          </button>
        }
      />
      <section className="daily-stat-row" aria-label="Runtime adapter status">
        <DailyMetric
          label="Profiles"
          value={<span data-runtime-adapter-metric="profiles">0</span>}
          sub={<span data-runtime-adapter-meta="profiles">registered</span>}
        />
        <DailyMetric
          label="Live"
          value={<span data-runtime-adapter-metric="live">0</span>}
          sub={<span data-runtime-adapter-meta="live">approval gated</span>}
        />
        <DailyMetric
          label="Sandbox"
          value={<span data-runtime-adapter-metric="sandbox">0</span>}
          sub={<span data-runtime-adapter-meta="sandbox">isolated</span>}
        />
        <DailyMetric
          label="Receipt"
          value={<span data-runtime-adapter-metric="receipt">none</span>}
          sub={<span data-runtime-adapter-meta="receipt">latest</span>}
        />
      </section>
      <section className="daily-layout daily-layout--main">
        <article className="daily-panel daily-panel--primary">
          <div className="daily-panel__head">
            <div>
              <span>Profiles</span>
              <h2>Registered helpers</h2>
            </div>
            <button className="daily-button" type="button" data-runtime-adapter-action="refresh">
              Refresh
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
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
                <tr>
                  <td className="mono">none</td>
                  <td>waiting</td>
                  <td>not declared</td>
                  <td>disabled</td>
                  <td>none</td>
                  <td>register first</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card-grid card-grid--quiet" data-runtime-adapter-grid="" hidden />
        </article>
        <aside className="daily-stack">
          <article className="daily-panel">
            <div className="daily-panel__head">
              <div>
                <span>Register</span>
                <h2>New helper</h2>
              </div>
            </div>
            <form className="runtime-adapter-form" data-runtime-adapter-register-form="">
              <label>
                <span>Id</span>
                <input name="id" type="text" placeholder="local-helper" />
              </label>
              <label>
                <span>Label</span>
                <input name="label" type="text" placeholder="Local helper" />
              </label>
              <div className="runtime-adapter-form__row">
                <label>
                  <span>Adapter</span>
                  <select name="adapter" defaultValue="cli">
                    <option value="cli">CLI</option>
                    <option value="http">HTTP</option>
                    <option value="acp">ACP</option>
                    <option value="mcp">MCP</option>
                  </select>
                </label>
                <label>
                  <span>Prompt</span>
                  <select name="promptMode" defaultValue="stdin">
                    <option value="stdin">stdin</option>
                    <option value="arg">arg</option>
                    <option value="json">json</option>
                  </select>
                </label>
              </div>
              <label>
                <span>Command</span>
                <input name="command" type="text" placeholder="agent" />
              </label>
              <label>
                <span>Root</span>
                <input name="root" type="text" placeholder="C:\\project" />
              </label>
              <button
                className="daily-button daily-button--wide"
                type="button"
                data-runtime-adapter-action="register"
              >
                Register
              </button>
            </form>
          </article>
          <article className="daily-panel">
            <div className="daily-panel__head">
              <div>
                <span>Run</span>
                <h2>Preview first</h2>
              </div>
            </div>
            <div className="runtime-adapter-console">
              <label>
                <span>Profile</span>
                <select data-runtime-adapter-profile-select="">
                  <option value="">No profile registered</option>
                </select>
              </label>
              <label>
                <span>Prompt</span>
                <textarea
                  data-runtime-adapter-prompt=""
                  rows={3}
                  placeholder="Ask the helper to inspect this workspace."
                />
              </label>
              <label className="runtime-adapter-check">
                <input data-runtime-adapter-approve-execution="" type="checkbox" />{" "}
                <span>Approve this run</span>
              </label>
              <div className="runtime-adapter-actions">
                <button type="button" data-runtime-adapter-action="preview">
                  Preview
                </button>
                <button type="button" data-runtime-adapter-action="invoke">
                  Run
                </button>
              </div>
            </div>
          </article>
          <article className="daily-panel">
            <div className="daily-panel__head">
              <div>
                <span>Receipt</span>
                <h2 data-runtime-adapter-receipt-status="">none</h2>
              </div>
            </div>
            <div className="runtime-adapter-receipt">
              <span data-runtime-adapter-receipt-profile="">no profile</span>
              <p data-runtime-adapter-receipt-summary="">No receipt has been written yet.</p>
              <code data-runtime-adapter-receipt-command="">waiting for next action</code>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}

function SkillRow({
  name,
  status,
  detail,
  tone,
  filter,
  prompt,
}: {
  name: string;
  status: string;
  detail: string;
  tone: "ok" | "info" | "warn";
  filter: "ready" | "setup" | "approval";
  prompt: string;
}) {
  const search = `${name} ${status} ${detail}`.toLowerCase();
  const enabled = filter === "ready";
  const togglePrompt = enabled
    ? `Disable ${name} after confirming impact.`
    : `Enable or configure ${name}. Show only the missing setup and risk.`;
  return (
    <article
      className={`skill-row skill-row--${tone}`}
      data-skill-row=""
      data-skill-status={filter}
      data-skill-search-text={search}
    >
      <div className="daily-row__main">
        <h2>{name}</h2>
        <p>{detail}</p>
      </div>
      <span className={`daily-status daily-status--${tone}`}>{status}</span>
      <button
        type="button"
        className="daily-skill-toggle"
        aria-pressed={enabled ? "true" : "false"}
        aria-label={`${enabled ? "Disable" : "Enable"} ${name}`}
        data-dashboard-prompt={togglePrompt}
        data-zavorthControl-prompt={togglePrompt}
      >
        <span />
      </button>
      <button
        type="button"
        className="skill-row__use"
        data-dashboard-prompt={prompt}
        data-zavorthControl-prompt={prompt}
      >
        Use
      </button>
    </article>
  );
}

/** Skills / tools library (More dock) + Registry ops operator panel. */
export function SkillsIsland() {
  const skills: Array<{
    name: string;
    status: string;
    detail: string;
    tone: "ok" | "info" | "warn";
    filter: "ready" | "setup" | "approval";
    prompt: string;
  }> = [
    {
      name: "Review workspace",
      status: "Ready",
      detail: "Reads the project and highlights risks without editing files.",
      tone: "ok",
      filter: "ready",
      prompt: "Review my workspace in read-only mode and show the highest-risk items first.",
    },
    {
      name: "Understand files",
      status: "Needs scope",
      detail: "Uses only approved folders to explain documents.",
      tone: "info",
      filter: "setup",
      prompt: "Show me how to configure a safe folder scope for file memory.",
    },
    {
      name: "Tool curator",
      status: "Preview",
      detail: "Suggests improvements before anything changes.",
      tone: "info",
      filter: "approval",
      prompt: "Open the tool curator in preview mode and show only safe suggestions.",
    },
    {
      name: "Transactions",
      status: "Simulation",
      detail: "Previews and audits transactions; real money stays blocked.",
      tone: "warn",
      filter: "approval",
      prompt: "Simulate a transaction and list risks without executing anything real.",
    },
    {
      name: "Connect adapter",
      status: "Consent",
      detail: "Creates a profile only from a path you provide.",
      tone: "info",
      filter: "approval",
      prompt: "Explain how to connect an runtime adapter with consent and a limited scope.",
    },
  ];

  return (
    <div
      className="daily-page"
      data-react-dashboard-island="skills"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Skills"
        subtitle="Enable installed capabilities. Registry ops: sign / verify / export / publish-plan."
        actions={
          <PromptButton
            primary
            prompt="Suggest the best Zavorth skill for my current task and explain the risk before using it."
          >
            Suggest
          </PromptButton>
        }
      />
      <section className="daily-toolbar skill-toolbar skill-toolbar--quiet">
        <input
          type="search"
          placeholder="Search skills"
          aria-label="Search skills"
          data-skill-search=""
        />
        <button type="button" className="is-active" data-skill-filter="all">
          All
        </button>
        <button type="button" data-skill-filter="ready">
          Ready
        </button>
        <button type="button" data-skill-filter="setup">
          Set up
        </button>
        <button type="button" data-skill-filter="approval">
          Approval
        </button>
      </section>
      <section className="daily-panel daily-panel--list">
        <div className="daily-panel__head">
          <div>
            <span>Installed</span>
            <h2>5 skills</h2>
          </div>
          <small className="daily-muted">
            <span data-tools-live-ready="">0 ready</span>
          </small>
        </div>
        <section className="premium-skill-list premium-skill-list--quiet">
          {skills.map((skill) => (
            <SkillRow key={skill.name} {...skill} />
          ))}
        </section>
      </section>

      {/* Operator registry ops — live data via data-* hooks filled by skill-registry-ops-ui */}
      <section
        className="daily-panel daily-panel--list"
        data-skill-registry-ops=""
        aria-label="Skill registry ops"
      >
        <div className="daily-panel__head">
          <div>
            <span>Operator</span>
            <h2>Registry ops</h2>
          </div>
          <button
            className="daily-button"
            type="button"
            data-skill-registry-refresh=""
            title="GET /api/skill-registry"
          >
            Refresh
          </button>
        </div>
        <div className="daily-stat-row daily-stat-row--compact" aria-label="Registry stats">
          <article className="daily-metric">
            <span>Packages</span>
            <strong data-skill-registry-stat="total">—</strong>
            <small>skills/</small>
          </article>
          <article className="daily-metric">
            <span>Signed</span>
            <strong data-skill-registry-stat="signed">—</strong>
            <small>hmac</small>
          </article>
          <article className="daily-metric">
            <span>Valid pkg</span>
            <strong data-skill-registry-stat="packageValid">—</strong>
            <small>manifest</small>
          </article>
          <article className="daily-metric">
            <span>Env key</span>
            <strong data-skill-registry-stat="hasSigningKey">—</strong>
            <small>operator</small>
          </article>
        </div>
        <div className="daily-card-feed" data-skill-registry-list="">
          <p className="daily-muted" data-skill-registry-empty="">
            Connect runtime and press Refresh (GET /api/skill-registry). Fixture: skills/registry-ops-fixture
          </p>
        </div>
        <div className="daily-action-row" aria-label="Registry actions" style={{ marginTop: "0.75rem" }}>
          <button type="button" data-skill-registry-action="verify" disabled>
            Verify selected
          </button>
          <button type="button" data-skill-registry-action="publish_plan" disabled>
            Publish plan
          </button>
          <button type="button" data-skill-registry-action="export">
            Export index
          </button>
          <button type="button" data-skill-registry-action="trusted_hosts">
            Trusted hosts
          </button>
        </div>
        <label className="daily-muted" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
          <input type="checkbox" data-skill-registry-operator-confirm="" />
          Operator confirm (required for Sign)
        </label>
        <div className="daily-action-row" style={{ marginTop: "0.35rem" }}>
          <button type="button" data-skill-registry-action="sign" disabled>
            Sign selected
          </button>
        </div>
        <pre
          className="daily-muted mono"
          data-skill-registry-log=""
          style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap", fontSize: "0.8rem", minHeight: "2rem" }}
        />
        <p className="daily-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
          Docs: docs/product/skill-registry-ops.md · Live push remains CLI only
        </p>
      </section>
    </div>
  );
}

function SettingsLinkRow({ name, action }: { name: string; action: string }) {
  const prompt = `Configure ${name} and show only the missing credential or webhook.`;
  return (
    <div className="daily-settings-row">
      <div>
        <strong>{name}</strong>
        <span>Optional channel</span>
      </div>
      <button
        className="daily-button"
        type="button"
        data-dashboard-prompt={prompt}
        data-zavorthControl-prompt={prompt}
      >
        {action}
      </button>
    </div>
  );
}

/** Settings / config — language, model route, channels, security, advanced. */
export function ConfigIsland() {
  const preferredLocale = readControlLocalePreference();
  const providers = listUserSelectionProviders();
  const channels = listUserSelectionChannels();

  return (
    <div
      className="daily-page settings-minimal-page"
      data-react-dashboard-island="config"
      data-react-dashboard-version={DASHBOARD_REACT_ISLAND_VERSION}
    >
      <DailyHeader
        title="Settings"
        subtitle="Model, channels, security, profile and appearance."
        actions={
          <PromptButton primary prompt="Run settings health and show only missing setup.">
            Check
          </PromptButton>
        }
      />
      <section className="daily-settings-shell" aria-label="Settings">
        <nav className="daily-settings-nav" aria-label="Settings sections">
          <a href="#settings-general">General</a>
          <a href="#settings-model">Model</a>
          <a href="#settings-channels">Channels</a>
          <a href="#settings-security">Security</a>
          <a href="#settings-advanced">Advanced</a>
        </nav>
        <div className="daily-settings-content">
          <section className="daily-settings-group" id="settings-general">
            <h2>General</h2>
            <div className="daily-settings-row daily-settings-row--with-action">
              <div>
                <strong>Language</strong>
                <span>Use system language or choose one.</span>
              </div>
              <label className="settings-minimal-select">
                <select data-zavorth-locale-select="" defaultValue={preferredLocale}>
                  {CONTROL_LOCALES.map((locale) => (
                    <option key={locale.code} value={locale.code}>
                      {locale.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="daily-button" type="button" data-zavorth-locale-apply="">
                Apply
              </button>
            </div>
            <div className="daily-settings-row">
              <div>
                <strong>Active engine</strong>
                <span>Current runtime mode.</span>
              </div>
              <strong className="settings-minimal-current" data-runtime-engine-active="">
                Lite
              </strong>
            </div>
          </section>

          <section className="daily-settings-group" id="settings-model">
            <div className="daily-settings-group__head">
              <h2>Model</h2>
              <PromptButton prompt="Test the active model route with sanitized proof.">
                Test
              </PromptButton>
            </div>
            <div className="daily-settings-row">
              <div>
                <strong>Active route</strong>
                <span data-provider-picker="active">Configured route</span>
              </div>
              <strong className="settings-minimal-current" data-provider-picker="fallbacks">
                Live routes
              </strong>
            </div>
            <form id="model-preference-form" className="daily-settings-form daily-route-form">
              <label className="settings-minimal-select">
                <span>Primary provider</span>
                <select id="pref-provider" name="providerId" required defaultValue="">
                  <option value="">Not configured</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-minimal-select">
                <span>Primary model</span>
                <input
                  id="pref-model"
                  name="modelId"
                  type="text"
                  placeholder="e.g. gpt-4o-mini"
                  autoComplete="off"
                />
              </label>
              <label className="settings-minimal-select">
                <span>Secondary model</span>
                <input
                  id="pref-secondary-model"
                  name="secondaryModelId"
                  type="text"
                  placeholder="Used if primary model fails"
                  autoComplete="off"
                />
              </label>
              <label className="settings-minimal-select">
                <span>Route id (optional)</span>
                <input
                  id="pref-route"
                  name="routeId"
                  type="text"
                  placeholder="optional route id"
                  autoComplete="off"
                />
              </label>
              <label className="settings-minimal-select">
                <span>Primary channel</span>
                <select id="pref-channel" name="channelId" defaultValue="">
                  <option value="">Not configured</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="daily-route-form__actions">
                <button className="daily-button" type="submit">
                  Save route
                </button>
                <button className="daily-button" type="button" id="btn-preview-pref">
                  Preview
                </button>
              </div>
              <div id="pref-result-panel" className="daily-route-result" hidden aria-live="polite" />
            </form>
            <details className="daily-disclosure">
              <summary>Provider catalog</summary>
              <div className="daily-provider-summary" data-provider-model-catalog-summary="">
                <div className="info-row">
                  <span className="info-row__label">Routes</span>
                  <span className="info-row__value mono">loading</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Live</span>
                  <span className="info-row__value mono">loading</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Models</span>
                  <span className="info-row__value mono">loading</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Media</span>
                  <span className="info-row__value mono">loading</span>
                </div>
              </div>
              <div className="daily-card-feed" data-provider-model-catalog-list="" />
            </details>
          </section>

          <section className="daily-settings-group" id="settings-channels">
            <div className="daily-settings-group__head">
              <h2>Channels</h2>
              <SectorButton sector="channels">Manage</SectorButton>
            </div>
            <p className="daily-settings-hint">
              Primary channel is set with the Model route form above. Connectors below are optional.
            </p>
            <SettingsLinkRow name="Telegram" action="Connect" />
            <SettingsLinkRow name="Discord" action="Connect" />
            <SettingsLinkRow name="Slack" action="Connect" />
            <SettingsLinkRow name="WhatsApp" action="Connect" />
          </section>

          <section className="daily-settings-group" id="settings-security">
            <h2>Security</h2>
            <div className="daily-settings-row">
              <div>
                <strong>Execution policy</strong>
                <span>Risky work requires preview.</span>
              </div>
              <strong className="settings-minimal-current">Approval</strong>
            </div>
            <details className="daily-disclosure">
              <summary>Execution engines</summary>
              <div className="runtime-engine-panel" aria-label="Runtime engines">
                <div
                  className="runtime-engine-grid settings-engine-list"
                  data-runtime-engine-cards=""
                  data-runtime-engine-layout="compact"
                />
              </div>
            </details>
            <details className="daily-disclosure">
              <summary>Trusted folders</summary>
              <div className="trusted-workspace-panel settings-trusted-panel" aria-label="Trusted workspaces">
                <form className="trusted-workspace-form" data-trusted-workspace-form="">
                  <label>
                    <span>Folder path</span>
                    <input
                      name="path"
                      type="text"
                      placeholder="C:\\projects\\playground"
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    <span>Label</span>
                    <input name="label" type="text" placeholder="Playground" autoComplete="off" />
                  </label>
                  <label>
                    <span>State</span>
                    <select name="state" defaultValue="trusted">
                      <option value="trusted">Trusted</option>
                      <option value="sensitive">Sensitive</option>
                      <option value="untrusted">Untrusted</option>
                    </select>
                  </label>
                  <button type="submit">Add folder</button>
                </form>
                <div className="trusted-workspace-list" data-trusted-workspaces-list="" />
              </div>
            </details>
          </section>

          <section className="daily-settings-group" id="settings-advanced">
            <h2>Advanced</h2>
            <details className="daily-disclosure">
              <summary>Activation diagnostics</summary>
              <div className="daily-provider-summary" data-provider-activation-summary="">
                <div className="info-row">
                  <span className="info-row__label">Execution</span>
                  <span className="info-row__value mono">loading</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Proof</span>
                  <span className="info-row__value mono">loading</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Adapters</span>
                  <span className="info-row__value mono">loading</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Connectors</span>
                  <span className="info-row__value mono">loading</span>
                </div>
              </div>
              <div className="daily-card-feed" data-provider-activation-list="" />
            </details>
            <details className="daily-disclosure zavorth-config-details">
              <summary>Runtime JSON</summary>
              <div className="zavorth-config-editor-wrapper">
                <textarea
                  className="zavorth-config-textarea"
                  id="zavorth-config-editor-textarea"
                  autoComplete="off"
                  spellCheck={false}
                  defaultValue={`{
  "zavorthControl": {
    "live": true,
    "theme": "dark",
    "safety": "high"
  }
}`}
                />
                <div className="zavorth-config-editor-actions">
                  <span className="zavorth-config-editor-status" id="zavorth-config-status">
                    JSON status: OK
                  </span>
                  <button className="daily-button" id="zavorth-config-save-btn" type="button">
                    Save
                  </button>
                </div>
              </div>
            </details>
          </section>
        </div>
      </section>
    </div>
  );
}

export function renderDashboardReactIsland(id: DashboardReactIslandId): ReactNode {
  switch (id) {
    case "overview":
      return <WorkOverviewIsland />;
    case "sales-os":
      return <ReviewApprovalsIsland />;
    case "instances":
      return <ProofReceiptsIsland />;
    case "channels":
      return <ChannelsIsland />;
    case "sessions":
      return <SessionsIsland />;
    case "cron":
      return <CronIsland />;
    case "agents":
      return <AgentsIsland />;
    case "skills":
      return <SkillsIsland />;
    case "config":
      return <ConfigIsland />;
    default:
      return null;
  }
}
