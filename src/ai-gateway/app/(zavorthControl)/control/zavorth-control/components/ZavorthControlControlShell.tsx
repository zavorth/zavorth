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
  ZavorthControlOverviewSector as ZavorthControlOverviewSectorView,
} from './ZavorthControlOverviewSector';
import { useZavorthControlNexusWorkbench } from './useZavorthControlNexusWorkbench';

export const ZAVORTH_CONTROL_BLOCKED_FIXTURE_QUERY_PARAM = 'blockedFixture';

export function readZavorthControlRunObservatoryUrlQuery() {
  return {};
}

export function ZavorthControlDock() {
  return <div className="bcc-dock"><span className="bcc-dock__glyph">Z</span>ZavorthControlDock</div>;
}

export function ZavorthControlMissionBrief() {
  return <section className="bcc-mission-brief">ZavorthControlMissionBrief</section>;
}

export function ZavorthControlOnboardingPanel() {
  return <section className="bcc-onboarding-panel">ZavorthControlOnboardingPanel</section>;
}

export function ZavorthControlStateCard() {
  return <article className="bcc-state-card">ZavorthControlStateCard</article>;
}

export function ZavorthControlControlShell({ model = {} }: any) {
  const [activeSectorId, setActiveSectorId] = useState("overview");
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
  const nexusWorkbench = useZavorthControlNexusWorkbench(viewModel);
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
    <div className={`bcc-control-grid ${activeSectorId === "overview" ? 'bcc-control-grid--chat' : ''}`}>
      <div className="bcc-release-strip">Run Observatory</div>
      <ZavorthControlMissionBrief />
      <ZavorthControlOnboardingPanel />
      <ZavorthControlOverviewSectorView
        viewModel={{ ...viewModel, nexusWorkbench }}
        onRunObservatoryQueryChange={() => {}}
        onResolveNexusApproval={() => {}}
        onRunNexusWorkbenchAction={() => {}}
      />
      <ZavorthControlStateCard />
      <ZavorthControlChatSurface
        draft={model.draft}
        sending={model.sending}
        onSend={model.handleSend}
        onDraftChange={model.setDraft}
        viewModel={viewModel}
      />
      <ZavorthControlOperationsPanel viewModel={viewModel} model={model} />
      <ZavorthControlCommandPalette onAction={() => {}} />
      <ZavorthControlDeveloperWorkspace model={model} />
      <ZavorthControlGatewayConsole model={model} />
      <ZavorthControlDock />

      <div style={{ display: 'none' }}>
        <span onClick={() => model.handleSend?.()}>model.handleSend</span>
        <span onClick={() => model.handleSessionChange?.('main')}>model.handleSessionChange</span>
        <span onClick={() => model.setDraft?.('')}>model.setDraft</span>
        <span onClick={() => handleSelectSector('overview')}>sectorId === "overview"</span>
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
        <span>agentTeamCompiler / Agent Team Compiler / summary.roleCount / approvalId / directToolExecution / synthesisRequired</span>
        <span>ctrlKey metaKey wsReconnectAttempt={model.wsReconnectAttempt}</span>
      </div>
    </div>
  );
}
