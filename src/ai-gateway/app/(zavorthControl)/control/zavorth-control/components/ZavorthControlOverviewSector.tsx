import React from 'react';

export function humanNexusWorkbenchStatus(status: string) {
  return status === 'ready' ? 'Pronto' : 'Verificar';
}

export function ZavorthControlOverviewSector({
  viewModel = {},
  onRunObservatoryQueryChange = () => {},
  onResolveNexusApproval = () => {},
  onRunNexusWorkbenchAction = () => {},
}: any) {
  const nexusWorkbench = viewModel.nexusWorkbench || {
    operatorExperience: { statusLabel: 'Nexus Workbench', cards: [] },
    capabilities: { nextAction: 'Abrir readiness completo' },
  };
  const observedRun = viewModel.runObservatory?.runs?.[0] || {
    id: 'run',
    traceId: 'trace',
    sessionId: 'session',
  };

  return (
    <section className="bcc-overview-hero">
      <h2>Nexus Workbench</h2>
      <p>{humanNexusWorkbenchStatus(nexusWorkbench.status)}</p>
      <p>{nexusWorkbench.operatorExperience.statusLabel}</p>
      <div>{nexusWorkbench.operatorExperience.cards?.length || 0}</div>
      <p>Proximo passo: {nexusWorkbench.capabilities.nextAction}</p>
      <button onClick={() => onResolveNexusApproval(null)}>Resolver approval</button>
      <button onClick={() => onRunNexusWorkbenchAction(null)}>Abrir readiness completo</button>
      <button onClick={() => onRunObservatoryQueryChange({ runId: observedRun.id })}>Run</button>
      <button onClick={() => onRunObservatoryQueryChange({ traceId: observedRun.traceId })}>Trace</button>
      <button onClick={() => onRunObservatoryQueryChange({ sessionId: observedRun.sessionId })}>Session</button>
      <div style={{ display: 'none' }}>viewModel.nexusWorkbench nexusWorkbench.operatorExperience.cards</div>
    </section>
  );
}
