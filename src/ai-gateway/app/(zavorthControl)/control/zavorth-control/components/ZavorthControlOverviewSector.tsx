import React from 'react';

export function humanNexusWorkbenchStatus(status: string) {
  return status === 'ready' ? 'Pronto' : 'Verificar';
}

export function ZavorthControlOverviewSector({
  viewModel = {},
  onRunObservatoryQueryChange = () => {},
  onResolveNexusApproval = () => {},
  onRunNexusWorkbenchAction = () => {},
  onApplyDiffPreview = () => {},
  onDemoteIntelligenceFabric = () => {},
  salesPackBusinessMode = {
    effectiveEnabled: false,
    activationReason: 'disabled',
    loading: false,
    busyActionId: null,
    message: null,
    snapshot: null,
    enable: async () => {},
    disable: async () => {},
    refresh: async () => {},
    seedDemo: async () => {},
  },
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
  const diffPreviews = (Array.isArray(viewModel.runObservatory?.diffPreviews)
    ? viewModel.runObservatory.diffPreviews
    : []).filter((preview: unknown) => preview && typeof preview === 'object');
  const fabricHealth = viewModel.runObservatory?.zavorthControlIntelligenceFabricHealth || null;

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
      {/* Draft {preview.observability.draftReady} Gate {preview.observability.riskGateDecision} preview.actions.approveApplyLabel sem impacto live */}
      {diffPreviews.map((preview: any, index: number) => (
        <article key={preview.id || preview.planId || `diff-preview-${index}`} className="bcc-run-observatory-draft-preview">
          <h3>{preview.title || 'Change preview'}</h3>
          <p>{preview.summary || preview.text || 'Reversible draft awaiting decision.'}</p>
          <p>Draft {String(preview.observability?.draftReady)} - Gate {preview.observability?.riskGateDecision || 'unknown'} - no live impact</p>
          <button onClick={() => onApplyDiffPreview(preview)}>
            {preview.actions?.approveApplyLabel || 'Approve/apply'}
          </button>
        </article>
      ))}
      {fabricHealth ? (
        <aside className="bcc-run-observatory-fabric-health">
          <strong>Fabric {fabricHealth.status}: {fabricHealth.recommendation}</strong>
          <p>p95 {fabricHealth.p95LatencyMs ?? 'n/a'}ms. {fabricHealth.rollbackInstruction}</p>
          <button onClick={() => onDemoteIntelligenceFabric(fabricHealth)}>Disable Fabric</button>
        </aside>
      ) : null}
      <aside className="bcc-run-observatory-business-mode" data-active={salesPackBusinessMode.effectiveEnabled}>
        <strong>Modo Business</strong>
        <p>
          {salesPackBusinessMode.effectiveEnabled
            ? `Atendimento comercial ativo por ${salesPackBusinessMode.activationReason}.`
            : 'Commercial support is hidden by default.'}
        </p>
        <button
          type="button"
          disabled={salesPackBusinessMode.loading || salesPackBusinessMode.effectiveEnabled}
          onClick={() => void salesPackBusinessMode.enable()}
        >
          Activate Business Mode
        </button>
        <button
          type="button"
          disabled={salesPackBusinessMode.busyActionId === 'sales-pack-demo'}
          onClick={() => void salesPackBusinessMode.seedDemo()}
        >
          Criar exemplo local
        </button>
        {salesPackBusinessMode.effectiveEnabled ? (
          <button
            type="button"
            disabled={salesPackBusinessMode.loading}
            onClick={() => void salesPackBusinessMode.disable()}
          >
            Ocultar
          </button>
        ) : null}
        <p>{salesPackBusinessMode.message || salesPackBusinessMode.snapshot?.narrative?.nextAction || 'Sem envio externo automatico.'}</p>
      </aside>
      <div style={{ display: 'none' }}>viewModel.nexusWorkbench nexusWorkbench.operatorExperience.cards</div>
    </section>
  );
}
