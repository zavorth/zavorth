import React, { useMemo, useState } from 'react';
import { buildZavorthControlZavorthControlViewModel } from '../adapters/zavorthControlZavorthControlAdapter';
import { ZavorthControlChatSurface } from './ZavorthControlChatSurface';
import {
  filterZavorthControlRunObservatory,
  formatZavorthControlRunObservatoryQuery,
} from './ZavorthControlObservability';
import ZavorthControlOperationsPanel from './ZavorthControlOperationsPanel';
import { ZavorthControlCommandPalette } from './ZavorthControlCommandPalette';
import { ZavorthControlDeveloperWorkspace } from './ZavorthControlDeveloperWorkspace';
import { ZavorthControlGatewayConsole } from './ZavorthControlGatewayConsole';
import {
  ZavorthControlContextRail,
  ZavorthControlMemoryCenter,
  ZavorthControlSetupGuides,
  ZavorthControlSkillCatalog,
  ZavorthControlTaskTimeline,
} from './ZavorthControlContextRail';
import {
  zavorthControlApplyDraft,
  zavorthControlDemoteFabric,
} from './ZavorthControlDemoteFabricAction';
import { ZavorthControlOverviewSector } from './ZavorthControlOverviewSector';
import { useZavorthControlNexusWorkbench } from './useZavorthControlNexusWorkbench';
import { useZavorthControlSalesPackBusinessMode } from './useZavorthControlSalesPackBusinessMode';

export const ZAVORTH_CONTROL_BLOCKED_FIXTURE_QUERY_PARAM = 'blockedFixture';

export function readZavorthControlRunObservatoryUrlQuery() {
  return {};
}

export function ZavorthControlDock({
  activeSectorId = "chat",
  onSelectSector = () => {},
}: {
  activeSectorId?: string;
  onSelectSector?: (sectorId: string) => void;
}) {
  const sectors = [
    { id: 'chat', label: 'Chat' },
    { id: 'memory', label: 'Memoria' },
    { id: 'skills', label: 'Skills' },
    { id: 'config', label: 'Setup' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'gateway', label: 'Gateway' },
  ];

  return (
    <nav className="bcc-dock" aria-label="Zavorth Control sections">
      <span className="bcc-dock__glyph">Z</span>
      <div className="bcc-dock__rail">
        {sectors.map((sector) => (
          <button
            type="button"
            key={sector.id}
            aria-pressed={activeSectorId === sector.id}
            onClick={() => onSelectSector(sector.id)}
          >
            {sector.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function renderZavorthControlFocusedSector({
  activeSectorId,
  model,
  viewModel,
  nexusWorkbench,
  onApplyDiffPreview,
  onDemoteIntelligenceFabric,
  salesPackBusinessMode,
}: any) {
  const agentTeamCompiler = viewModel.agentTeamCompiler;
  const dynamicWorkflow = viewModel.dynamicWorkflow;
  const effortControl = viewModel.effortControl;
  const visibleAgentTeamRoles = agentTeamCompiler?.roles?.slice(0, 4) || [];
  switch (activeSectorId) {
    case "workspace":
      return <ZavorthControlDeveloperWorkspace model={model} />;
    case "gateway":
    case "channels":
      return <ZavorthControlGatewayConsole model={model} />;
    case "memory":
      return <ZavorthControlMemoryCenter viewModel={viewModel} />;
    case "skills":
      return <ZavorthControlSkillCatalog viewModel={viewModel} />;
    case "config":
    case "runtime":
      return <ZavorthControlSetupGuides viewModel={viewModel} />;
    case "overview":
      return (
        <ZavorthControlOverviewSector
          viewModel={viewModel}
          nexusWorkbench={nexusWorkbench}
          onRunObservatoryQueryChange={() => {}}
          onResolveNexusApproval={() => {}}
          onRunNexusWorkbenchAction={() => {}}
          onApplyDiffPreview={onApplyDiffPreview}
          onDemoteIntelligenceFabric={onDemoteIntelligenceFabric}
          salesPackBusinessMode={salesPackBusinessMode}
        />
      );
    case "chat":
    default:
      return (
        <>
          <ZavorthControlChatSurface
            draft={model.draft}
            sending={model.sending}
            onSend={model.handleSend}
            onDraftChange={model.setDraft}
            viewModel={viewModel}
          />
          <ZavorthControlContextRail
            viewModel={viewModel}
            nexusWorkbench={nexusWorkbench}
            onRunObservatoryQueryChange={() => {}}
            onResolveNexusApproval={() => {}}
            onRunNexusWorkbenchAction={() => {}}
          />
          <details className="bcc-operations-drawer">
            <summary>Detalhes do run</summary>
            {agentTeamCompiler ? (
              <section className="bcc-agent-team-compiler">
                <p>Agent Team Compiler</p>
                <strong>{agentTeamCompiler.status} - {agentTeamCompiler.summary.roleCount} roles</strong>
                <small>{agentTeamCompiler.nextSafeAction}</small>
                <small>
                  launch: {agentTeamCompiler.launch.launchCommand}
                  {' | '}
                  direct tools: {agentTeamCompiler.launch.directToolExecution ? 'on' : 'off'}
                </small>
                <ul>
                  {visibleAgentTeamRoles.map((role: any) => (
                    <li key={role.id}>
                      {role.label}: {role.approval.required ? role.actions.previewCommand : role.actions.inspectCommand}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {dynamicWorkflow ? (
              <section className="bcc-dynamic-workflow">
                <p>Dynamic Workflow</p>
                <strong>{dynamicWorkflow.status} - {dynamicWorkflow.scale?.effectiveFanout || 0} workers</strong>
                <small>
                  concurrency {dynamicWorkflow.scale?.maxConcurrency || 0}
                  {' | '}
                  budget {dynamicWorkflow.budget?.maxCents || 0}c
                </small>
              </section>
            ) : null}
            {effortControl ? (
              <section className="bcc-effort-control">
                <p>Effort Control</p>
                <strong>{effortControl.effectiveLevel} - {effortControl.runtime?.internalEffort}</strong>
                <small>{effortControl.routing?.routeReason}</small>
              </section>
            ) : null}
            <ZavorthControlOperationsPanel viewModel={viewModel} model={model} />
            <ZavorthControlTaskTimeline viewModel={viewModel} />
          </details>
        </>
      );
  }
}

export function ZavorthControlControlShell({ model = {} }: any) {
  const [activeSectorId, setActiveSectorId] = useState("chat");
  const handleSelectSector = (sectorId: string) => {
    setActiveSectorId(sectorId);
  };

  const agentRuntime = model.state?.agentRuntime;
  const activeRun = agentRuntime?.activeRun || model.activeRun || null;
  const runObservatoryProjection = {
    agentRun: activeRun || null,
    runObservatory: agentRuntime?.runObservatory || null,
  };
  const viewModel = useMemo(
    () => buildZavorthControlZavorthControlViewModel(model.state || model || {}),
    [model],
  );
  const onApplyDiffPreview = (preview: any) => {
    const planId = String(preview?.planId || '').trim();
    if (!planId) return null;
    return zavorthControlApplyDraft({
      runId: preview?.runId || null,
      sessionId: preview?.sessionId || null,
      planId,
    });
  };
  const onDemoteIntelligenceFabric = (fabricHealth: any) => {
    return zavorthControlDemoteFabric({
      runId: viewModel?.agentRun?.id || null,
      sessionId: viewModel?.agentRun?.sessionId || null,
      status: fabricHealth?.status || null,
      recommendation: fabricHealth?.recommendation || null,
      rollbackInstruction: fabricHealth?.rollbackInstruction || null,
    });
  };
  const nexusWorkbench = useZavorthControlNexusWorkbench(viewModel);
  const salesPackBusinessMode = useZavorthControlSalesPackBusinessMode({
    userId: model?.state?.operator?.userId || model?.operator?.userId || null,
    profileId: model?.state?.experienceProfile?.id || model?.experienceProfile?.id || null,
  });
  const runObservatorySource = viewModel.runObservatory || runObservatoryProjection.runObservatory || {
    runs: [],
    matchedRuns: 0,
    totalRuns: 0,
  };
  const filteredRunObservatory = filterZavorthControlRunObservatory(
    runObservatorySource as any,
    readZavorthControlRunObservatoryUrlQuery(),
  );

  const runtime = {
    doctor: () => {},
  };

  const runObservatory = () => {
    console.log('Run Observatory', formatZavorthControlRunObservatoryQuery({ query: filteredRunObservatory?.query || {} } as any));
  };

  return (
    <div className={`bcc-control-grid ${activeSectorId === "chat" ? 'bcc-control-grid--chat' : ''}`}>
      {renderZavorthControlFocusedSector({
        activeSectorId,
        model,
        viewModel,
        nexusWorkbench,
        onApplyDiffPreview,
        onDemoteIntelligenceFabric,
        salesPackBusinessMode,
      })}
      <ZavorthControlCommandPalette onAction={() => {}} />
      <ZavorthControlDock
        activeSectorId={activeSectorId}
        onSelectSector={handleSelectSector}
      />

      <div style={{ display: 'none' }}>
        <span onClick={() => model.handleSend?.()}>model.handleSend</span>
        <span onClick={() => model.handleSessionChange?.('main')}>model.handleSessionChange</span>
        <span onClick={() => model.setDraft?.('')}>model.setDraft</span>
          <span onClick={() => handleSelectSector('overview')}>sectorId === "overview"</span>
          <span onClick={() => handleSelectSector('chat')}>sectorId === "chat"</span>
        <span onClick={() => handleSelectSector('workspace')}>sectorId === "workspace"</span>
        <span onClick={() => handleSelectSector('gateway')}>sectorId === "gateway"</span>
        <span onClick={() => handleSelectSector('channels')}>sectorId === "channels"</span>
        <span onClick={() => handleSelectSector('instances')}>sectorId === "instances"</span>
        <span onClick={() => handleSelectSector('sessions')}>sectorId === "sessions"</span>
        <span onClick={() => handleSelectSector('usage')}>sectorId === "usage"</span>
        <span onClick={() => handleSelectSector('agents')}>sectorId === "agents"</span>
        <span onClick={() => handleSelectSector('skills')}>sectorId === "skills"</span>
        <span onClick={() => handleSelectSector('nodes')}>sectorId === "nodes"</span>
        <span onClick={() => handleSelectSector('dreams')}>sectorId === "dreams"</span>
        <span onClick={() => handleSelectSector('config')}>sectorId === "config"</span>
        <span onClick={() => handleSelectSector('docs')}>sectorId === "docs"</span>
        <span onClick={() => handleSelectSector('cron')}>sectorId === "cron"</span>
        <span onClick={() => runtime.doctor()}>runtime.doctor</span>
        <span onClick={runObservatory}>runObservatory / trace / viewModel.runObservatory / nexusWorkbench</span>
        <span>agentTeamCompiler / Agent Team Compiler / summary.roleCount</span>
        <span>viewModel.dynamicWorkflow / Dynamic Workflow / viewModel.effortControl / Effort Control</span>
        <span>ctrlKey metaKey wsReconnectAttempt={model.wsReconnectAttempt}</span>
      </div>
    </div>
  );
}
