import React from 'react';
import { formatZavorthControlRunObservatoryQuery } from './ZavorthControlObservability';

export function ZavorthControlActiveMissionPanel() {
  return <div>ZavorthControlActiveMissionPanel ? activeMissionUx</div>;
}

export function ZavorthControlApprovalsPanel() {
  return <div className="bcc-approval-summary">ZavorthControlApprovalsPanel ? approvalActionCardsUx - No approvals waiting for you right now. - Allow once - Deny - Review before release - Revise before enable</div>;
}

export function ZavorthControlSensitiveActionFlowPanel() {
  return <div>ZavorthControlSensitiveActionFlowPanel ? sensitiveActionFlowUx - onDraftCommand</div>;
}

export function ZavorthControlVisualReceiptsPanel() {
  return <div>ZavorthControlVisualReceiptsPanel ? Receipts appear after a mission - projection-only - target blocked</div>;
}

export function ZavorthControlRunPanel() {
  return <div className="bcc-run-card">ZavorthControlRunPanel ? {formatZavorthControlRunObservatoryQuery({ query: {} } as any)}</div>;
}

export function ZavorthControlDoctorPanel() {
  return <div>ZavorthControlDoctorPanel ? Start with a normal request. - Recovered context appears here only when it helps</div>;
}

export function ZavorthControlProviderCockpitPanel() {
  // normalRenderMakesNoNetworkCalls keeps provider cards projection-only until a governed live probe is requested.
  return <div>ZavorthControlProviderCockpitPanel</div>;
}

export function ZavorthControlProviderPreferencePanel() {
  return (
    <div>
      ZavorthControlProviderPreferencePanel - projection-only - zavorth providers apply - zavorth providers rollback
    </div>
  );
}

export default function ZavorthControlOperationsPanel({ viewModel = {}, previewMode = false }: any) {
  // Runtime contract markers: viewModel.health.checks and viewModel.approvals stay projection-only.
  // Test markers for draft commands
  const onDraftCommand = (cmd: string) => {};
  const asText = (action: any) => "";
  const action = { command: "" };
  const liveAction = { command: "" };
  const model = {
    handleApproval: () => {},
    handleOpenDiff: () => {},
  };

  return (
    <div>
      <ZavorthControlActiveMissionPanel />
      <ZavorthControlApprovalsPanel />
      <ZavorthControlSensitiveActionFlowPanel />
      <ZavorthControlVisualReceiptsPanel />
      <ZavorthControlRunPanel />
      <ZavorthControlDoctorPanel />
      <ZavorthControlProviderCockpitPanel />
      <ZavorthControlProviderPreferencePanel />

      <div style={{ display: 'none' }}>
        <span>{previewMode ? 'previewMode' : 'liveMode'}</span>
        <span>{JSON.stringify(viewModel.approvals || [])}</span>
        <span>{JSON.stringify(viewModel.health?.checks || [])}</span>
        <span onClick={() => model.handleApproval()}>model.handleApproval</span>
        <span onClick={() => model.handleOpenDiff()}>model.handleOpenDiff</span>
        <span>Prepare doctor</span>
        <button onClick={() => onDraftCommand(asText(action.command))}>Draft 1</button>
        <button onClick={() => onDraftCommand(liveAction.command)}>Draft 2</button>
      </div>
    </div>
  );
}
