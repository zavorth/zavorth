import type {
  SourceAgentRuntimeBridgeReadiness,
  SourceAgentRuntimePackageEvidence,
} from '../../contracts/SourceAgentRuntimeBridgeContract.js';

export type AcpxBridgeRuntimeAdapterOptions = {
  enabledByEnv?: boolean;
  packageEvidence?: SourceAgentRuntimePackageEvidence[];
};

export class AcpxBridgeRuntimeAdapter {
  public buildReadiness(options: AcpxBridgeRuntimeAdapterOptions = {}): SourceAgentRuntimeBridgeReadiness {
    const evidence = options.packageEvidence || [];
    const hasAcpxUsage = evidence.some((entry) =>
      (
        entry.packageName === '@agentclientprotocol/claude-agent-acp'
        || entry.packageName === 'acpx'
        || entry.packageName === '@zed-industries/codex-acp'
      ) && entry.directness !== 'not-present',
    );

    return {
      bridgeId: 'acpx',
      status: hasAcpxUsage ? 'owner_decision_required' : 'missing',
      decision: 'optional-bridge-owner-gated',
      usageKind: 'acp-bridge',
      packages: [
        '@agentclientprotocol/claude-agent-acp',
        'acpx',
        '@zed-industries/codex-acp',
      ],
      enabledByDefault: false,
      enabledByEnv: options.enabledByEnv === true,
      liveExecutionPerformed: false,
      dryRunAvailable: true,
      requiresOwnerApproval: true,
      activationEnvVars: [
        'ZAVORTH_ACPX_BRIDGE_ENABLED=true',
        'ZAVORTH_ACPX_BRIDGE_CWD',
        'ZAVORTH_ACPX_BRIDGE_WORKSPACE_ROOTS',
        'ZAVORTH_ACPX_BRIDGE_ALLOWED_SERVERS',
      ],
      cwdPolicy: {
        controlledCwdRequired: true,
        workspaceRootsRequired: true,
      },
      toolPolicy: {
        zavorthPolicyRequired: true,
        canUseToolRequired: true,
        approvalRequiredForWritesAndShell: true,
        bypassPermissionsAllowed: false,
      },
      artifactReceipts: {
        required: true,
        kinds: [
          'agent-runtime.acp.session-plan',
          'agent-runtime.acp.tool-policy',
          'agent-runtime.acp.bridge-receipt',
        ],
      },
      reason: hasAcpxUsage ? 'Source has ACPX/Claude/Codex ACP bridge packages; Zavorth keeps ACP as an optional bridge behind owner approval.'
        : 'ACPX and ACP bridge packages were not found in the scanned Source checkout.',
    };
  }
}
