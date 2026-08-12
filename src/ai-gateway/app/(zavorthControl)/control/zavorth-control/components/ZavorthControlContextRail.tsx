import React from 'react';
import {
  ZavorthControlOverviewSector as ZavorthControlNexusContext,
} from './ZavorthControlOverviewSector';

type AnyRecord = Record<string, any>;
type ActionCallback = (payload: AnyRecord) => void;

function array(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value as AnyRecord[] : [];
}

function label(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function confidenceLabel(value: unknown): string {
  if (typeof value === 'number') {
    return `${Math.round(value * 100)}%`;
  }
  return label(value, 'reviewable');
}

function capabilityStatus(capability: AnyRecord): string {
  if (capability.status) return label(capability.status, 'available');
  if (capability.requiresApproval) return 'Needs review';
  if (capability.installed || capability.enabled) return 'Installed';
  if (capability.archived) return 'Archived';
  if (capability.draft) return 'Draft';
  return 'available';
}

function ProjectionActionButton({
  children,
  onAction,
  payload,
}: {
  children: React.ReactNode;
  onAction?: ActionCallback;
  payload: AnyRecord;
}) {
  return (
    <button
      type="button"
      disabled={!onAction}
      aria-disabled={!onAction}
      onClick={() => onAction?.(payload)}
    >
      {children}
    </button>
  );
}

export function ZavorthControlTaskTimeline({
  viewModel = {},
  onViewReceipt,
}: {
  viewModel?: AnyRecord;
  onViewReceipt?: ActionCallback;
}) {
  const run = viewModel.agentRun || {};
  const events = array(viewModel.events);
  const approvals = array(viewModel.approvals).filter((approval) => approval.status === 'pending');
  const artifacts = array(viewModel.artifacts);
  const memorySignals = array(viewModel.memorySignals);
  const steps = [
    { id: 'ask', title: 'Ask', detail: label(run.input || viewModel.messages?.[0]?.text, 'direct conversation with the agent.'), status: 'done' },
    { id: 'understand', title: 'Understand', detail: `${events.length} context event(s)`, status: events.length ? 'done' : 'idle' },
    { id: 'act', title: 'Act', detail: approvals.length ? 'Waiting for your review' : 'Execution is quiet when risk is low', status: approvals.length ? 'attention' : 'idle' },
    { id: 'deliver', title: 'Deliver', detail: artifacts.length ? `${artifacts.length} delivery item(s)` : 'Result appears in the conversation', status: artifacts.length ? 'done' : 'idle' },
    { id: 'review', title: 'Review', detail: memorySignals.length ? `${memorySignals.length} reviewable memory item(s)` : 'Receipt and memory when evidence exists', status: memorySignals.length ? 'attention' : 'idle' },
  ];

  return (
    <section className="bcc-context-rail__section bcc-task-timeline" aria-label="Timeline da task">
      <header>
        <span>Timeline</span>
        <strong>{label(run.status, 'Ready')}</strong>
      </header>
      <ol>
        {steps.map((step) => (
          <li key={step.id} data-status={step.status}>
            <span>{step.title}</span>
            <small>{step.detail}</small>
          </li>
        ))}
      </ol>
      <ProjectionActionButton onAction={onViewReceipt} payload={{ source: 'task-timeline', run }}>
        View receipt
      </ProjectionActionButton>
    </section>
  );
}

export function ZavorthControlMemoryCenter({
  viewModel = {},
  onEdit,
  onForget,
  onNeverLearn,
}: {
  viewModel?: AnyRecord;
  onEdit?: ActionCallback;
  onForget?: ActionCallback;
  onNeverLearn?: ActionCallback;
}) {
  const memories = array(viewModel.memorySignals).slice(0, 3);
  const visibleMemories = memories.length ? memories : [{
    id: 'memory-empty',
    title: 'Nada aprendido nesta conversation',
    source: 'without evidence nova',
    confidence: 'n/a',
    expiry: 'without prazo',
  }];

  return (
    <section className="bcc-context-rail__section bcc-memory-center" aria-label="Memory center">
      <header>
        <span>Memory</span>
        <strong>{memories.length ? 'reviewable' : 'quiet'}</strong>
      </header>
      <div className="bcc-context-list">
        {visibleMemories.map((memory) => (
          <article key={label(memory.id || memory.title, 'memory')} className="bcc-context-item">
            <strong>{label(memory.title || memory.text || memory.summary, 'Editable preference')}</strong>
            <small>Origem: {label(memory.source || memory.origin || memory.evidenceRef, 'current conversation')}</small>
            <small>Confidence: {confidenceLabel(memory.confidence)} · Expires: {label(memory.expiry || memory.expiresAt, 'review after')}</small>
            <div className="bcc-context-actions">
              <ProjectionActionButton onAction={onEdit} payload={memory}>Edit</ProjectionActionButton>
              <ProjectionActionButton onAction={onForget} payload={memory}>Forget</ProjectionActionButton>
              <ProjectionActionButton onAction={onNeverLearn} payload={memory}>Never learn this</ProjectionActionButton>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ZavorthControlSkillCatalog({
  viewModel = {},
  onTestSkill,
  onPromote,
}: {
  viewModel?: AnyRecord;
  onTestSkill?: ActionCallback;
  onPromote?: ActionCallback;
}) {
  const capabilities = array(viewModel.capabilities).slice(0, 4);
  const skills = capabilities.length ? capabilities : [{
    id: 'skill-empty',
    label: 'no skill active in this conversation',
    risk: 'safe',
    status: 'available',
  }];

  return (
    <section className="bcc-context-rail__section bcc-skill-catalog" aria-label="skill catalog">
      <header>
        <span>Skills</span>
        <strong>Catalog</strong>
      </header>
      <div className="bcc-context-list">
        {skills.map((skill) => (
          <article key={label(skill.id || skill.label, 'skill')} className="bcc-context-item">
            <strong>{label(skill.label || skill.name || skill.id, 'Skill')}</strong>
            <small>{capabilityStatus(skill)} · risk {label(skill.risk, 'safe')}</small>
            <small>Latest smoke: {label(skill.lastSmoke || skill.smokeStatus, 'Built-in verified')}</small>
            <div className="bcc-context-actions">
              <ProjectionActionButton onAction={onTestSkill} payload={skill}>Test skill</ProjectionActionButton>
              <ProjectionActionButton onAction={onPromote} payload={skill}>Promote</ProjectionActionButton>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ZavorthControlSetupGuides({
  viewModel = {},
  onOpenConfig,
}: {
  viewModel?: AnyRecord;
  onOpenConfig?: ActionCallback;
}) {
  const runtime = viewModel.runtime || {};
  const integrations = array(viewModel.integrations);
  const providerStatus = label(viewModel.providerCockpit?.status || runtime.currentProviderLabel, 'provider');
  const channelStatus = integrations.some((integration) => integration.liveReady) ? 'Live verified'
    : 'Built-in verified';

  return (
    <section className="bcc-context-rail__section bcc-setup-guides" aria-label="Setup guides">
      <header>
        <span>Setup</span>
        <strong>{label(runtime.status, 'ready')}</strong>
      </header>
      <div className="bcc-context-list">
        <article className="bcc-context-item">
          <strong>Provider</strong>
          <small>{providerStatus}</small>
          <ProjectionActionButton onAction={onOpenConfig} payload={{ target: 'provider' }}>Open configuration</ProjectionActionButton>
        </article>
        <article className="bcc-context-item">
          <strong>Channels</strong>
          <small>{channelStatus}</small>
          <ProjectionActionButton onAction={onOpenConfig} payload={{ target: 'channels' }}>Open configuration</ProjectionActionButton>
        </article>
        <article className="bcc-context-item">
          <strong>Execution</strong>
          <small>{label(runtime.productModeLabel, 'chat')} · dry-run when no strong backend is available</small>
          <ProjectionActionButton onAction={onOpenConfig} payload={{ target: 'runtime' }}>Open configuration</ProjectionActionButton>
        </article>
      </div>
    </section>
  );
}

export function ZavorthControlContextRail({
  viewModel = {},
  nexusWorkbench,
  onRunObservatoryQueryChange = () => {},
  onResolveNexusApproval = () => {},
  onRunNexusWorkbenchAction = () => {},
  onViewReceipt,
  onEditMemory,
  onForgetMemory,
  onNeverLearnMemory,
  onTestSkill,
  onPromoteSkill,
  onOpenConfig,
}: {
  viewModel?: AnyRecord;
  nexusWorkbench?: AnyRecord;
  onRunObservatoryQueryChange?: (query: AnyRecord) => void;
  onResolveNexusApproval?: (approval: AnyRecord | null) => void;
  onRunNexusWorkbenchAction?: (action: AnyRecord | null) => void;
  onViewReceipt?: ActionCallback;
  onEditMemory?: ActionCallback;
  onForgetMemory?: ActionCallback;
  onNeverLearnMemory?: ActionCallback;
  onTestSkill?: ActionCallback;
  onPromoteSkill?: ActionCallback;
  onOpenConfig?: ActionCallback;
}) {
  // projection-only: this rail never fetches, sends, installs, forgets or promotes directly.
  // All actions are labels for governed routes owned by the main runtime and setup surfaces.
  return (
    <aside className="bcc-context-rail" aria-label="Contexto discreto da conversation">
      <details open>
        <summary>Context</summary>
        <ZavorthControlTaskTimeline viewModel={viewModel} onViewReceipt={onViewReceipt} />
        <ZavorthControlMemoryCenter
          viewModel={viewModel}
          onEdit={onEditMemory}
          onForget={onForgetMemory}
          onNeverLearn={onNeverLearnMemory}
        />
        <ZavorthControlSkillCatalog
          viewModel={viewModel}
          onTestSkill={onTestSkill}
          onPromote={onPromoteSkill}
        />
        <ZavorthControlSetupGuides viewModel={viewModel} onOpenConfig={onOpenConfig} />
        <div className="bcc-context-rail__section bcc-nexus-context">
          <ZavorthControlNexusContext
            viewModel={{ ...viewModel, nexusWorkbench }}
            onRunObservatoryQueryChange={onRunObservatoryQueryChange}
            onResolveNexusApproval={onResolveNexusApproval}
            onRunNexusWorkbenchAction={onRunNexusWorkbenchAction}
          />
        </div>
      </details>
    </aside>
  );
}
