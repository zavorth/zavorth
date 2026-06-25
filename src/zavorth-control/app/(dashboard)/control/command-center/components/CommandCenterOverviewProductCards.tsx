import type { DashboardCommandCenterViewModel } from "../contracts";
import { CommandCenterCard } from "./CommandCenterPrimitives";

export function CommandCenterOverviewProductCards({
  viewModel,
}: {
  viewModel: DashboardCommandCenterViewModel;
}) {
  const runArtifactReceiptReplay = viewModel.runArtifactReceiptReplay;
  const productizationEvidence = viewModel.productizationEvidence;
  const productEntryRuntime = viewModel.productEntryRuntime;
  const releaseInstallerRollbackPath = viewModel.releaseInstallerRollbackPath;
  const publicSiteDocsDemoSync = viewModel.publicSiteDocsDemoSync;
  const feedbackTelemetryProductLoop = viewModel.feedbackTelemetryProductLoop;
  const publicAdoptionPilotLoop = viewModel.publicAdoptionPilotLoop;
  const integrationShowcasePartnerSurface = viewModel.integrationShowcasePartnerSurface;
  const releaseAdoptionReadiness = viewModel.releaseAdoptionReadiness;
  const releaseCandidatePreCanaryGate = viewModel.releaseCandidatePreCanaryGate;
  const blueprintCompletionGate = viewModel.blueprintCompletionGate;
  const visibleReplayFrames = runArtifactReceiptReplay?.frames.slice(0, 6) || [];
  const visibleProductizationGates = productizationEvidence?.gates.slice(0, 6) || [];
  const visibleProductEntryGates = productEntryRuntime?.gates.slice(0, 6) || [];
  const visibleReleasePathGates = releaseInstallerRollbackPath?.gates.slice(0, 6) || [];
  const visiblePublicSyncGates = publicSiteDocsDemoSync?.gates.slice(0, 6) || [];
  const visibleFeedbackLoopGates = feedbackTelemetryProductLoop?.gates.slice(0, 6) || [];
  const visiblePilotLoopGates = publicAdoptionPilotLoop?.gates.slice(0, 6) || [];
  const visibleIntegrationShowcaseGates = integrationShowcasePartnerSurface?.gates.slice(0, 6) || [];
  const visibleReleaseAdoptionGates = releaseAdoptionReadiness?.gates.slice(0, 6) || [];
  const visiblePreCanaryGates = releaseCandidatePreCanaryGate?.gates.slice(0, 6) || [];
  const visibleBlueprintCompletionGates = blueprintCompletionGate?.gates.slice(0, 6) || [];

  return (
    <>
      {runArtifactReceiptReplay ? (
                <CommandCenterCard label="Replay Hardening" title={`${runArtifactReceiptReplay.status} - ${runArtifactReceiptReplay.summary.frameCount} frames`}>
                  <p className="bcc-empty-note">{runArtifactReceiptReplay.replay.summary}</p>
                  <div className="bcc-list">
                    {visibleReplayFrames.length > 0 ? visibleReplayFrames.map((frame) => (
                      <div key={frame.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          #{frame.order} {frame.kind}: {frame.title}
                        </span>
                        <span className="bcc-list-item__meta">
                          {frame.source} - {frame.status} - {frame.detail}
                        </span>
                      </div>
                    )) : (
                      <p className="bcc-empty-note">Nenhum frame publicado.</p>
                    )}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy</span>
                      <span className="bcc-list-item__meta">
                        {runArtifactReceiptReplay.policy.replayUsesReceiptsOnly ? "receipts only" : "revisar"} - {runArtifactReceiptReplay.surface.replayHint}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {productizationEvidence ? (
                <CommandCenterCard label="Productization Evidence" title={`${productizationEvidence.status} - ${productizationEvidence.releaseReadiness.status}`}>
                  <p className="bcc-empty-note">{productizationEvidence.surface.releaseHint}</p>
                  <div className="bcc-list">
                    {visibleProductizationGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Release policy</span>
                      <span className="bcc-list-item__meta">
                        stable permitido: {String(productizationEvidence.summary.stableReleaseAllowed)} - {productizationEvidence.nextSafeAction}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {productEntryRuntime ? (
                <CommandCenterCard label="Product Entry Runtime" title={`${productEntryRuntime.status} - ${productEntryRuntime.entry.requestedSurface}`}>
                  <p className="bcc-empty-note">{productEntryRuntime.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visibleProductEntryGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Handoff</span>
                      <span className="bcc-list-item__meta">
                        {productEntryRuntime.entry.handoffAllowed ? "liberado" : "aguardando"} - {productEntryRuntime.surface.goCommand}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {releaseInstallerRollbackPath ? (
                <CommandCenterCard label="Release / Installer / Rollback" title={`${releaseInstallerRollbackPath.status} - ${releaseInstallerRollbackPath.release.releaseBundleStatus}`}>
                  <p className="bcc-empty-note">{releaseInstallerRollbackPath.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visibleReleasePathGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy</span>
                      <span className="bcc-list-item__meta">
                        release: {String(releaseInstallerRollbackPath.policy.noReleasePublished)} - installer: {String(releaseInstallerRollbackPath.policy.noInstallerExecuted)} - canary: {String(releaseInstallerRollbackPath.policy.noCanaryStarted)}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {publicSiteDocsDemoSync ? (
                <CommandCenterCard label="Public Site / Docs / Demo Sync" title={`${publicSiteDocsDemoSync.status} - ${publicSiteDocsDemoSync.sync.publicRoutes.length} rotas`}>
                  <p className="bcc-empty-note">{publicSiteDocsDemoSync.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visiblePublicSyncGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy publica</span>
                      <span className="bcc-list-item__meta">
                        deploy: {String(!publicSiteDocsDemoSync.policy.noPublicDeployExecuted)} - stable: {String(publicSiteDocsDemoSync.readiness.canAnnounceStable)} - demo live: {String(!publicSiteDocsDemoSync.policy.noDemoLiveExecution)}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {feedbackTelemetryProductLoop ? (
                <CommandCenterCard label="Feedback / Telemetry Opt-In" title={`${feedbackTelemetryProductLoop.status} - ${feedbackTelemetryProductLoop.gates.length} gates`}>
                  <p className="bcc-empty-note">{feedbackTelemetryProductLoop.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visibleFeedbackLoopGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy opt-in</span>
                      <span className="bcc-list-item__meta">
                        telemetry: {String(!feedbackTelemetryProductLoop.policy.noTelemetryEnabled)} - envio: {String(!feedbackTelemetryProductLoop.policy.noFeedbackSent)} - raw payload: {String(!feedbackTelemetryProductLoop.policy.noRawPayloadSerialized)}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {publicAdoptionPilotLoop ? (
                <CommandCenterCard label="Public Adoption / Pilot Loop" title={`${publicAdoptionPilotLoop.status} - ${publicAdoptionPilotLoop.pilot.ledgerEntryCount} pilotos`}>
                  <p className="bcc-empty-note">{publicAdoptionPilotLoop.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visiblePilotLoopGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy piloto</span>
                      <span className="bcc-list-item__meta">
                        coleta implicita: {String(!publicAdoptionPilotLoop.policy.noImplicitCollection)} - payload workspace: {String(!publicAdoptionPilotLoop.policy.noWorkspacePayloadStored)} - dashboard agregado: {String(publicAdoptionPilotLoop.policy.dashboardAggregatedOnly)}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {integrationShowcasePartnerSurface ? (
                <CommandCenterCard label="Integration Showcase / Partner Surface" title={`${integrationShowcasePartnerSurface.status} - ${integrationShowcasePartnerSurface.showcase.vendorCount} vendors`}>
                  <p className="bcc-empty-note">{integrationShowcasePartnerSurface.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visibleIntegrationShowcaseGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy partner surface</span>
                      <span className="bcc-list-item__meta">
                        fixture sem credencial: {String(integrationShowcasePartnerSurface.policy.noCredentialRequiredForFixture)} - sem rede: {String(integrationShowcasePartnerSurface.policy.noNetworkRequiredForFixture)} - claim formal: {String(integrationShowcasePartnerSurface.partnerSurface.canClaimFormalPartner)}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {releaseAdoptionReadiness ? (
                <CommandCenterCard label="Release & Adoption Readiness" title={`${releaseAdoptionReadiness.status} - score ${releaseAdoptionReadiness.publicAdoption.readinessScore}`}>
                  <p className="bcc-empty-note">{releaseAdoptionReadiness.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visibleReleaseAdoptionGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy release/adoption</span>
                      <span className="bcc-list-item__meta">
                        deploy: {String(!releaseAdoptionReadiness.policy.noDeployExecuted)} - canary: {String(!releaseAdoptionReadiness.policy.noCanaryStarted)} - metricas agregadas: {String(releaseAdoptionReadiness.policy.adoptionMetricsAggregatedOnly)}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {releaseCandidatePreCanaryGate ? (
                <CommandCenterCard label="Release Candidate / Pre-Canary" title={`${releaseCandidatePreCanaryGate.status} - go/no-go ${releaseCandidatePreCanaryGate.goNoGo.decision}`}>
                  <p className="bcc-empty-note">{releaseCandidatePreCanaryGate.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visiblePreCanaryGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy pre-canary</span>
                      <span className="bcc-list-item__meta">
                        canary: {String(!releaseCandidatePreCanaryGate.policy.noCanaryStarted)} - rollout: {String(!releaseCandidatePreCanaryGate.policy.noRolloutStarted)} - auto-promote: {String(!releaseCandidatePreCanaryGate.policy.noAutoPromoteEnabled)}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
      
              {blueprintCompletionGate ? (
                <CommandCenterCard label="Blueprint Completion" title={`${blueprintCompletionGate.status} - ${blueprintCompletionGate.summary.completedGateCount}/${blueprintCompletionGate.summary.requiredGateCount}`}>
                  <p className="bcc-empty-note">{blueprintCompletionGate.nextSafeAction}</p>
                  <div className="bcc-list">
                    {visibleBlueprintCompletionGates.map((gate) => (
                      <div key={gate.id} className="bcc-list-item">
                        <span className="bcc-list-item__title">
                          {gate.status}: {gate.label}
                        </span>
                        <span className="bcc-list-item__meta">
                          {gate.command} - {gate.detail}
                        </span>
                      </div>
                    ))}
                    <div className="bcc-list-item">
                      <span className="bcc-list-item__title">Policy final</span>
                      <span className="bcc-list-item__meta">
                        manual: {String(blueprintCompletionGate.policy.manualPromotionRequired)} - sem auto-execute: {String(blueprintCompletionGate.policy.noAutoExecute)} - sem skip approval: {String(blueprintCompletionGate.policy.noSkipApproval)}
                      </span>
                    </div>
                  </div>
                </CommandCenterCard>
              ) : null}
          </>
  );
}
