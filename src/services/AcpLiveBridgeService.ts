import {
  ZAVORTH_ACP_LIVE_BRIDGE_CONTRACT_VERSION,
  type AcpLiveBridgeCheck,
  type AcpLiveBridgeSnapshot,
  type AcpLiveBridgeStatus,
} from '../contracts/AcpLiveBridgeContract.js';

type Runtime = {
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
};

export class AcpLiveBridgeService {
  private readonly now: () => Date;
  private readonly env: NodeJS.ProcessEnv;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
  }

  public buildSnapshot(): AcpLiveBridgeSnapshot {
    const enabled = readBoolean(this.env.ZAVORTH_ACPX_BRIDGE_ENABLED);
    const approvalRef = readApprovalRef(this.env);
    const checks = this.buildChecks({ enabled, approvalRef });
    const failed = checks.filter((check) => check.status === 'failed');
    const status: AcpLiveBridgeStatus = !enabled
      ? 'disabled'
      : failed.length > 0
        ? 'blocked'
        : 'ready';

    return {
      contractVersion: ZAVORTH_ACP_LIVE_BRIDGE_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'acp-live-bridge',
      generatedAt: this.now().toISOString(),
      status,
      headline: headlineFor(status),
      bridge: {
        id: 'acpx',
        protocol: 'ACP',
        transport: 'owner-gated-live-bridge',
        enabledByDefault: false,
        enabledByEnv: enabled,
        liveExecutionPerformed: false,
        dryRunAvailable: true,
      },
      checks,
      summary: {
        passed: checks.length - failed.length,
        failed: failed.length,
        requiredFailed: failed.length,
        liveReady: status === 'ready',
      },
      activation: {
        command: 'zavorth acp live',
        jsonCommand: 'zavorth acp live --json',
        checkCommand: 'npm run acp:live-bridge:check --silent',
        requiredEnv: [
          'ZAVORTH_ACPX_BRIDGE_ENABLED=true',
          'ZAVORTH_ACPX_BRIDGE_OWNER_APPROVED=true or ZAVORTH_ACPX_BRIDGE_APPROVAL_ID',
          'ZAVORTH_ACPX_BRIDGE_CWD',
          'ZAVORTH_ACPX_BRIDGE_WORKSPACE_ROOTS',
          'ZAVORTH_ACPX_BRIDGE_ALLOWED_SERVERS',
        ],
      },
      policy: {
        noDefaultEnable: true,
        ownerApprovalRequired: true,
        cwdControlRequired: true,
        workspaceRootsRequired: true,
        serverAllowlistRequired: true,
        writesAndShellRequireApproval: true,
        bypassPermissionsAllowed: false,
        rawSecretsSerialized: false,
      },
      receipt: {
        kind: 'agent-runtime.acp.live-bridge-readiness',
        liveExecutionPerformed: false,
        executionAuthorityGranted: status === 'ready',
        approvalRef,
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    return [
      'Zavorth ACP Live Bridge',
      snapshot.headline,
      '',
      `Status: ${snapshot.status}`,
      `Live ready: ${snapshot.summary.liveReady ? 'yes' : 'no'}`,
      `Execution authority: ${snapshot.receipt.executionAuthorityGranted ? 'granted' : 'blocked'}`,
      '',
      'Checks',
      ...snapshot.checks.map((check) =>
        `- ${check.label}: ${check.status}. ${check.summary}`,
      ),
      '',
      'Policy',
      '- ACP never enables by default.',
      '- Owner approval, CWD control, workspace roots and server allowlist are required.',
      '- Writes and shell still require Zavorth approval.',
    ].join('\n');
  }

  private buildChecks(input: { enabled: boolean; approvalRef: string | null }): AcpLiveBridgeCheck[] {
    return [
      check(
        'explicit-enable',
        'Explicit enable',
        input.enabled,
        input.enabled
          ? 'ACP bridge was explicitly enabled by env.'
          : 'Set ZAVORTH_ACPX_BRIDGE_ENABLED=true to arm ACP.',
        ['ZAVORTH_ACPX_BRIDGE_ENABLED'],
      ),
      check(
        'owner-approval',
        'Owner approval',
        Boolean(input.approvalRef),
        input.approvalRef
          ? 'Owner approval reference is present.'
          : 'ACP live bridge requires an approval id or explicit owner-approved flag.',
        ['ZAVORTH_ACPX_BRIDGE_APPROVAL_ID', 'ZAVORTH_ACPX_BRIDGE_OWNER_APPROVED'],
      ),
      check(
        'controlled-cwd',
        'Controlled CWD',
        Boolean(readString(this.env.ZAVORTH_ACPX_BRIDGE_CWD)),
        'ACP bridge must run from an explicit controlled CWD.',
        ['ZAVORTH_ACPX_BRIDGE_CWD'],
      ),
      check(
        'workspace-roots',
        'Workspace roots',
        parseList(this.env.ZAVORTH_ACPX_BRIDGE_WORKSPACE_ROOTS).length > 0,
        'ACP bridge must be constrained to explicit workspace roots.',
        ['ZAVORTH_ACPX_BRIDGE_WORKSPACE_ROOTS'],
      ),
      check(
        'allowed-servers',
        'Allowed ACP servers',
        parseList(this.env.ZAVORTH_ACPX_BRIDGE_ALLOWED_SERVERS).length > 0,
        'ACP bridge must use an explicit server allowlist.',
        ['ZAVORTH_ACPX_BRIDGE_ALLOWED_SERVERS'],
      ),
      check(
        'tool-policy',
        'Tool policy',
        true,
        'Zavorth policy remains authoritative; writes and shell still require approval.',
        ['ZAVORTH_ACPX_BRIDGE_ALLOWED_TOOLS'],
      ),
      check(
        'receipts',
        'Artifact receipts',
        true,
        'ACP readiness emits a receipt and does not serialize secrets.',
        [],
      ),
    ];
  }
}

function check(
  id: AcpLiveBridgeCheck['id'],
  label: string,
  passed: boolean,
  summary: string,
  envRefs: string[],
): AcpLiveBridgeCheck {
  return {
    id,
    label,
    status: passed ? 'passed' : 'failed',
    required: true,
    summary,
    envRefs,
  };
}

function headlineFor(status: AcpLiveBridgeStatus): string {
  if (status === 'ready') {
    return 'ACP live bridge is armed behind Zavorth governance.';
  }
  if (status === 'blocked') {
    return 'ACP live bridge is enabled but blocked until required governance is complete.';
  }
  return 'ACP live bridge is disabled by default.';
}

function readBoolean(value: unknown): boolean {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}

function readString(value: unknown): string {
  return String(value || '').trim();
}

function parseList(value: unknown): string[] {
  return readString(value).split(/[,\n;]/).map((entry) => entry.trim()).filter(Boolean);
}

function readApprovalRef(env: NodeJS.ProcessEnv): string | null {
  const id = readString(env.ZAVORTH_ACPX_BRIDGE_APPROVAL_ID);
  if (id) return id;
  return readBoolean(env.ZAVORTH_ACPX_BRIDGE_OWNER_APPROVED) ? 'owner-approved-env' : null;
}
