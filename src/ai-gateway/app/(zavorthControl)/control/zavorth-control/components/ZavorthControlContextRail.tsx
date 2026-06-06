import React from 'react';
import {
  ZavorthControlOverviewSector as ZavorthControlNexusContext,
} from './ZavorthControlOverviewSector';

type AnyRecord = Record<string, any>;

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
  return label(value, 'revisavel');
}

function capabilityStatus(capability: AnyRecord): string {
  if (capability.status) return label(capability.status, 'Disponivel');
  if (capability.requiresApproval) return 'Precisa revisar';
  if (capability.installed || capability.enabled) return 'Instalada';
  if (capability.archived) return 'Arquivada';
  if (capability.draft) return 'Em rascunho';
  return 'Disponivel';
}

export function ZavorthControlTaskTimeline({ viewModel = {} }: { viewModel?: AnyRecord }) {
  const run = viewModel.agentRun || {};
  const events = array(viewModel.events);
  const approvals = array(viewModel.approvals).filter((approval) => approval.status === 'pending');
  const artifacts = array(viewModel.artifacts);
  const memorySignals = array(viewModel.memorySignals);
  const steps = [
    { id: 'ask', title: 'Pedir', detail: label(run.input || viewModel.messages?.[0]?.text, 'Conversa direta com o agente.'), status: 'done' },
    { id: 'understand', title: 'Entender', detail: `${events.length} evento(s) de contexto`, status: events.length ? 'done' : 'idle' },
    { id: 'act', title: 'Agir', detail: approvals.length ? 'Aguardando sua revisao' : 'Execucao quieta quando for baixo risco', status: approvals.length ? 'attention' : 'idle' },
    { id: 'deliver', title: 'Entregar', detail: artifacts.length ? `${artifacts.length} entrega(s)` : 'Resultado aparece na conversa', status: artifacts.length ? 'done' : 'idle' },
    { id: 'review', title: 'Revisar', detail: memorySignals.length ? `${memorySignals.length} memoria(s) revisavel(is)` : 'Receipt e memoria quando houver evidencia', status: memorySignals.length ? 'attention' : 'idle' },
  ];

  return (
    <section className="bcc-context-rail__section bcc-task-timeline" aria-label="Timeline da tarefa">
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
      <button type="button">View receipt</button>
    </section>
  );
}

export function ZavorthControlMemoryCenter({ viewModel = {} }: { viewModel?: AnyRecord }) {
  const memories = array(viewModel.memorySignals).slice(0, 3);
  const visibleMemories = memories.length ? memories : [{
    id: 'memory-empty',
    title: 'Nada aprendido nesta conversa',
    source: 'Sem evidencia nova',
    confidence: 'n/a',
    expiry: 'sem prazo',
  }];

  return (
    <section className="bcc-context-rail__section bcc-memory-center" aria-label="Centro de memoria">
      <header>
        <span>Memoria</span>
        <strong>{memories.length ? 'revisavel' : 'quieta'}</strong>
      </header>
      <div className="bcc-context-list">
        {visibleMemories.map((memory) => (
          <article key={label(memory.id || memory.title, 'memory')} className="bcc-context-item">
            <strong>{label(memory.title || memory.text || memory.summary, 'Preferencia revisavel')}</strong>
            <small>Origem: {label(memory.source || memory.origin || memory.evidenceRef, 'conversa atual')}</small>
            <small>Confianca: {confidenceLabel(memory.confidence)} · Expira: {label(memory.expiry || memory.expiresAt, 'revisar depois')}</small>
            <div className="bcc-context-actions">
              <button type="button">Editar</button>
              <button type="button">Esquecer</button>
              <button type="button">Nunca aprender isso</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ZavorthControlSkillCatalog({ viewModel = {} }: { viewModel?: AnyRecord }) {
  const capabilities = array(viewModel.capabilities).slice(0, 4);
  const skills = capabilities.length ? capabilities : [{
    id: 'skill-empty',
    label: 'Sem skill ativa nesta conversa',
    risk: 'safe',
    status: 'Disponivel',
  }];

  return (
    <section className="bcc-context-rail__section bcc-skill-catalog" aria-label="Catalogo de skills">
      <header>
        <span>Skills</span>
        <strong>catalogo</strong>
      </header>
      <div className="bcc-context-list">
        {skills.map((skill) => (
          <article key={label(skill.id || skill.label, 'skill')} className="bcc-context-item">
            <strong>{label(skill.label || skill.name || skill.id, 'Skill')}</strong>
            <small>{capabilityStatus(skill)} · risco {label(skill.risk, 'safe')}</small>
            <small>Ultimo smoke: {label(skill.lastSmoke || skill.smokeStatus, 'Built-in verified')}</small>
            <div className="bcc-context-actions">
              <button type="button">Testar skill</button>
              <button type="button">Promover</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ZavorthControlSetupGuides({ viewModel = {} }: { viewModel?: AnyRecord }) {
  const runtime = viewModel.runtime || {};
  const integrations = array(viewModel.integrations);
  const providerStatus = label(viewModel.providerCockpit?.status || runtime.currentProviderLabel, 'provider');
  const channelStatus = integrations.some((integration) => integration.liveReady)
    ? 'Live verified'
    : 'Built-in verified';

  return (
    <section className="bcc-context-rail__section bcc-setup-guides" aria-label="Guias de setup">
      <header>
        <span>Setup</span>
        <strong>{label(runtime.status, 'ready')}</strong>
      </header>
      <div className="bcc-context-list">
        <article className="bcc-context-item">
          <strong>Provider</strong>
          <small>{providerStatus}</small>
          <button type="button">Abrir configuracao</button>
        </article>
        <article className="bcc-context-item">
          <strong>Canais</strong>
          <small>{channelStatus}</small>
          <button type="button">Abrir configuracao</button>
        </article>
        <article className="bcc-context-item">
          <strong>Execucao</strong>
          <small>{label(runtime.productModeLabel, 'chat')} · dry-run quando nao houver backend forte</small>
          <button type="button">Abrir configuracao</button>
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
}: {
  viewModel?: AnyRecord;
  nexusWorkbench?: AnyRecord;
  onRunObservatoryQueryChange?: (query: AnyRecord) => void;
  onResolveNexusApproval?: (approval: AnyRecord | null) => void;
  onRunNexusWorkbenchAction?: (action: AnyRecord | null) => void;
}) {
  // projection-only: this rail never fetches, sends, installs, forgets or promotes directly.
  // All actions are labels for governed routes owned by the main runtime and setup surfaces.
  return (
    <aside className="bcc-context-rail" aria-label="Contexto discreto da conversa">
      <details open>
        <summary>Contexto</summary>
        <ZavorthControlTaskTimeline viewModel={viewModel} />
        <ZavorthControlMemoryCenter viewModel={viewModel} />
        <ZavorthControlSkillCatalog viewModel={viewModel} />
        <ZavorthControlSetupGuides viewModel={viewModel} />
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
