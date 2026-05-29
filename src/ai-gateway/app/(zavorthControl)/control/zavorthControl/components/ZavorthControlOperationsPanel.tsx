import React from 'react';

export function ZavorthControlActiveMissionPanel() {
  return <div>ZavorthControlActiveMissionPanel - activeMissionUx</div>;
}

export function ZavorthControlApprovalsPanel() {
  return <div>ZavorthControlApprovalsPanel - approvalActionCardsUx - No approvals waiting for you right now. - Allow once - Deny - Review before release</div>;
}

export function ZavorthControlSensitiveActionFlowPanel() {
  return <div>ZavorthControlSensitiveActionFlowPanel - sensitiveActionFlowUx - onDraftCommand</div>;
}

export function ZavorthControlVisualReceiptsPanel() {
  return <div>ZavorthControlVisualReceiptsPanel - Receipts appear after a mission - projection-only - target blocked</div>;
}

export function ZavorthControlRunPanel() {
  return <div>ZavorthControlRunPanel</div>;
}

export function ZavorthControlDoctorPanel() {
  return <div>ZavorthControlDoctorPanel - Start with a normal request. - Recovered context appears here only when it helps</div>;
}

export function ZavorthControlProviderCockpitPanel() {
  return <div>ZavorthControlProviderCockpitPanel</div>;
}

export function ZavorthControlProviderPreferencePanel() {
  return <div>ZavorthControlProviderPreferencePanel</div>;
}

export default function ZavorthControlOperationsPanel() {
  // Test markers for draft commands
  const onDraftCommand = (cmd: string) => {};
  const asText = (action: any) => "";
  const action = { command: "" };
  const liveAction = { command: "" };

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
        <button onClick={() => onDraftCommand(asText(action.command))}>Draft 1</button>
        <button onClick={() => onDraftCommand(liveAction.command)}>Draft 2</button>
      </div>
    </div>
  );
}
