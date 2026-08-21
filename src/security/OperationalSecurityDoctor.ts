import fs from 'node:fs';
import path from 'node:path';
import {
  buildAgentSecurityInventory,
  validateAgentSecurityInventory,
} from './AgentSecurityInventory.js';
import {
  inspectToolApprovalSigningKeyState,
  type ApprovalSigningKeyInspection,
} from './ApprovalSigningKeyService.js';
import {
  inspectSecurityProfileConfiguration,
  listSecurityProfilePolicies,
  type SecurityProfileConfigurationInspection,
  type SecurityProfileId,
} from './SecurityProfile.js';
import {
  inspectSecurityOperationalPreset,
  type SecurityOperationalPresetInspection,
} from './SecurityOperationalPreset.js';



export type OperationalSecurityDoctorStatus = 'healthy' | 'attention' | 'blocked';
export type OperationalSecurityDoctorCheckStatus = 'pass' | 'attention' | 'fail';
export type OperationalSecurityDoctorSeverity = 'info' | 'warn' | 'critical';

export type OperationalSecurityDoctorCheck = {
  id: string;
  status: OperationalSecurityDoctorCheckStatus;
  severity: OperationalSecurityDoctorSeverity;
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string | null;
  command: string | null;
};

export type OperationalSecurityDoctorReport = {
  generatedAt: string;
  ok: boolean;
  strict: boolean;
  status: OperationalSecurityDoctorStatus;
  profile: {
    id: SecurityProfileId;
    label: string;
    source: string;
    reason: string;
  };
  summary: {
    total: number;
    passed: number;
    attention: number;
    failed: number;
  };
  checks: OperationalSecurityDoctorCheck[];
  recommendations: string[];
  nextSteps: Array<{
    id: string;
    label: string;
    command: string | null;
    required: boolean;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type OperationalSecurityDoctorInput = {
  env?: Record<string, string | undefined>;
  workspace?: string | null;
  projectRoot?: string | null;
  now?: () => Date;
  strict?: boolean;
};

type DangerousEnvOverride = {
  name: string;
  values: string[];
  severity: OperationalSecurityDoctorSeverity;
  summary: string;
};

export const REQUIRED_SECURITY_CONTROL_FILES = [
  'security/AgentSecurityPolicyEngine',
  'security/AgentToolSecurityCatalog',
  'security/ApprovalSigningKeyService',
  'security/ContinuousSecurityMonitor',
  'security/LlmEgressGuard',
  'security/SafeFetchService',
  'security/SecurityPolicyBroker',
  'security/SecurityOperationalPreset',
  'security/SecurityProfile',
  'security/SensitiveDataGuard',
  'security/ToolApprovalEnvelope',
  'security/ToolOutputTrust',
  'security/UntrustedContent',
];

const DANGEROUS_ENV_OVERRIDES: DangerousEnvOverride[] = [
  {
    name: 'NODE_TLS_REJECT_UNAUTHORIZED',
    values: ['0'],
    severity: 'critical',
    summary: 'Disables TLS verification in Node.js.',
  },
  {
    name: 'ALLOW_PRIVATE_EGRESS_TARGETS',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Allows egress to private networks and can reopen SSRF.',
  },
  {
    name: 'ALLOW_API_KEY_REVEAL',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Allows API keys to be revealed in response/API.',
  },
  {
    name: 'MITM_DISABLE_TLS_VERIFY',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Turns off TLS validation in MITM mode.',
  },
  {
    name: 'ZAVORTH_REMOTE_SHELL_ALLOW_HOST_CODE_BINARIES',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Allows code binaries in the host remote shell.',
  },
  {
    name: 'ZAVORTH_NODE_HOST_SYSTEM_RUN_ALLOW_CODE',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Allows code execution through system.run on a node host.',
  },
  {
    name: 'ZAVORTH_ALLOW_LOCAL_JAIL_SHELL',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Allows shell in the local jail.',
  },
  {
    name: 'ZAVORTH_REMOTE_MESH_ALLOW_INSECURE_HTTP',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Allows insecure HTTP on the remote mesh.',
  },
  {
    name: 'ZAVORTH_ALLOW_QUERY_AUTH_TOKEN',
    values: ['1', 'true'],
    severity: 'warn',
    summary: 'Allows auth token in query string; useful in dev, risky for daily use.',
  },
  {
    name: 'ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE',
    values: ['1', 'true'],
    severity: 'warn',
    summary: 'Allows ephemeral code execution in remote shell.',
  },
  {
    name: 'ZAVORTH_ALLOW_LOCAL_JAIL_SANDBOX',
    values: ['1', 'true'],
    severity: 'warn',
    summary: 'Allows local sandbox jail explicitly.',
  },
  {
    name: 'ZAVORTH_REMOTE_MESH_ALLOW_INSECURE_HTTP_FOR_TAILNET',
    values: ['1', 'true'],
    severity: 'warn',
    summary: 'Allows HTTP on tailnet; must stay restricted to trusted networks.',
  },
  {
    name: 'DISABLE_SQLITE_AUTO_BACKUP',
    values: ['1', 'true'],
    severity: 'warn',
    summary: 'Disables automatic SQLite backup.',
  },
];

export function buildOperationalSecurityDoctorReport(
  input: OperationalSecurityDoctorInput = {},
): OperationalSecurityDoctorReport {
  const env = input.env || process.env;
  const projectRoot = path.resolve(input.projectRoot || process.cwd());
  const now = input.now || (() => new Date());
  const strict = input.strict === true;
  const profileInspection = inspectSecurityProfileConfiguration({
    env,
    workspace: input.workspace || projectRoot,
    projectRoot,
  });
  const presetInspection = inspectSecurityOperationalPreset({ projectRoot });
  const signingKeyInspection = inspectToolApprovalSigningKeyState(env);
  const checks = [
    buildOperationalPresetCheck(presetInspection),
    buildProfileCheck(profileInspection),
    buildApprovalSigningKeyCheck(signingKeyInspection),
    buildDangerousEnvOverrideCheck(env),
    buildRequiredControlsCheck(projectRoot),
    buildInventoryCheck(),
    buildProfileCoverageCheck(),
  ];
  const failed = checks.filter((check) => check.status === 'fail').length;
  const attention = checks.filter((check) => check.status === 'attention').length;
  const status: OperationalSecurityDoctorStatus =
    failed > 0 ? 'blocked' : attention > 0 ? 'attention' : 'healthy';
  const ok = failed === 0 && (!strict || attention === 0);
  const recommendations = buildRecommendations(checks);

  return {
    generatedAt: now().toISOString(),
    ok,
    strict,
    status,
    profile: {
      id: profileInspection.resolution.profile.id,
      label: profileInspection.resolution.profile.label,
      source: profileInspection.resolution.source,
      reason: profileInspection.resolution.reason,
    },
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.status === 'pass').length,
      attention,
      failed,
    },
    checks,
    recommendations,
    nextSteps: checks
      .filter((check) => check.status !== 'pass' && (check.recommendation || check.command))
      .map((check) => ({
        id: check.id,
        label: check.recommendation || check.summary,
        command: check.command,
        required: check.status === 'fail' || strict,
      })),
    narrative: {
      headline: status === 'healthy'
        ? 'Operational security is healthy.'
        : status === 'blocked'
          ? 'Operational security blocked by real risk.'
          : 'Operational security ready with attention points.',
      operatorSummary: buildOperatorSummary(status, profileInspection, signingKeyInspection, checks, presetInspection),
    },
  };
}

export function formatOperationalSecurityDoctorReport(report: OperationalSecurityDoctorReport): string {
  const statusLabel = report.status === 'healthy'
    ? 'healthy'
    : report.status === 'blocked'
      ? 'blocked'
      : 'attention';
  const lines = [
    '[zavorth-security] security doctor',
    `[zavorth-security] status: ${statusLabel} | profile: ${report.profile.label} (${report.profile.source})`,
    `[zavorth-security] checks: ${report.summary.passed} ok, ${report.summary.attention} attention, ${report.summary.failed} fail`,
    '',
    ...report.checks.map((check) =>
      `[${check.status}] ${check.id}: ${check.summary}${check.recommendation ? ` Recommendation: ${check.recommendation}` : ''}`,
    ),
  ];

  if (report.nextSteps.length > 0) {
    lines.push('', 'Next steps');
    for (const step of report.nextSteps.slice(0, 6)) {
      lines.push(`- ${step.label}${step.command ? ` (${step.command})` : ''}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function buildProfileCheck(
  inspection: SecurityProfileConfigurationInspection,
): OperationalSecurityDoctorCheck {
  if (inspection.status === 'attention') {
    return {
      id: 'security-profile',
      status: 'attention',
      severity: 'warn',
      title: 'Security profile',
      summary: inspection.summary,
      evidence: inspection.invalidValues.map((entry) => `${entry.key}=${entry.value}`),
      recommendation: 'Set the profile to personal, professional, or enterprise.',
      command: 'zavorth doctor security --json',
    };
  }

  return {
    id: 'security-profile',
    status: 'pass',
    severity: 'info',
    title: 'Security profile',
    summary: `Active profile: ${inspection.resolution.profile.label}.`,
    evidence: [inspection.resolution.reason],
    recommendation: null,
    command: null,
  };
}

function buildOperationalPresetCheck(
  inspection: SecurityOperationalPresetInspection,
): OperationalSecurityDoctorCheck {
  if (inspection.status !== 'ready') {
    return {
      id: 'operational-security-preset',
      status: 'attention',
      severity: 'warn',
      title: 'Operational preset',
      summary: inspection.summary,
      evidence: [inspection.presetPath],
      recommendation: inspection.recommendations[0] || 'Apply an operational preset.',
      command: 'zavorth security preset professional --apply',
    };
  }

  return {
    id: 'operational-security-preset',
    status: 'pass',
    severity: 'info',
    title: 'Operational preset',
    summary: inspection.summary,
    evidence: [
      `preset=${inspection.state?.activePreset}`,
      `profile=${inspection.state?.securityProfile}`,
      `mcp=${inspection.state?.mcpProfile}`,
    ],
    recommendation: null,
    command: null,
  };
}

function buildApprovalSigningKeyCheck(
  inspection: ApprovalSigningKeyInspection,
): OperationalSecurityDoctorCheck {
  if (inspection.status === 'blocked') {
    return {
      id: 'approval-signing-key',
      status: 'fail',
      severity: 'critical',
      title: 'Approval signing key',
      summary: inspection.summary,
      evidence: inspection.reasons,
      recommendation: inspection.nextSteps[0] || 'Fix the approval signing key.',
      command: null,
    };
  }

  if (inspection.status === 'ready-on-demand') {
    return {
      id: 'approval-signing-key',
      status: 'pass',
      severity: 'info',
      title: 'Approval signing key',
      summary: inspection.summary,
      evidence: [
        inspection.filePath ? `file=${inspection.filePath}` : `source=${inspection.source}`,
        'auto-create-on-first-approval=true',
      ],
      recommendation: null,
      command: null,
    };
  }

  if (inspection.status !== 'ready') {
    return {
      id: 'approval-signing-key',
      status: 'attention',
      severity: 'warn',
      title: 'Approval signing key',
      summary: inspection.summary,
      evidence: [
        inspection.filePath ? `file=${inspection.filePath}` : `source=${inspection.source}`,
        ...inspection.reasons,
      ],
      recommendation: inspection.nextSteps[0] || null,
      command: null,
    };
  }

  return {
    id: 'approval-signing-key',
    status: 'pass',
    severity: 'info',
    title: 'Approval key',
    summary: inspection.summary,
    evidence: [
      inspection.envVar ? `env=${inspection.envVar}` : `file=${inspection.filePath}`,
    ].filter(Boolean) as string[],
    recommendation: null,
    command: null,
  };
}

function buildDangerousEnvOverrideCheck(
  env: Record<string, string | undefined>,
): OperationalSecurityDoctorCheck {
  const active = DANGEROUS_ENV_OVERRIDES.filter((override) =>
    override.values.includes(String(env[override.name] || '').trim().toLowerCase()),
  );
  if (active.length === 0) {
    return {
      id: 'dangerous-env-overrides',
      status: 'pass',
      severity: 'info',
      title: 'Dangerous overrides',
      summary: 'No known insecure overrides are active.',
      evidence: [],
      recommendation: null,
      command: null,
    };
  }

  const critical = active.some((override) => override.severity === 'critical');
  return {
    id: 'dangerous-env-overrides',
    status: critical ? 'fail' : 'attention',
    severity: critical ? 'critical' : 'warn',
    title: 'Dangerous overrides',
    summary: `${active.length} override(s) weakening security are active.`,
    evidence: active.map((override) => `${override.name}: ${override.summary}`),
    recommendation: 'Remove these overrides from daily use; use them only for isolated, temporary diagnostics.',
    command: null,
  };
}

function buildRequiredControlsCheck(projectRoot: string): OperationalSecurityDoctorCheck {
  const missing = REQUIRED_SECURITY_CONTROL_FILES.filter((modulePath) => !securityControlExists(projectRoot, modulePath));
  if (missing.length > 0) {
    return {
      id: 'core-security-controls',
      status: 'fail',
      severity: 'critical',
      title: 'Central controls',
      summary: `${missing.length} central security control(s) were not found.`,
      evidence: missing,
      recommendation: 'Restore the control files before running agents with sensitive tools.',
      command: 'npm run security:ci',
    };
  }

  return {
    id: 'core-security-controls',
    status: 'pass',
    severity: 'info',
    title: 'Central controls',
    summary: 'Central controls for profile, approval, egress, prompt injection, and sensitive data are present.',
    evidence: REQUIRED_SECURITY_CONTROL_FILES.map((modulePath) => `${modulePath}.ts|.js`),
    recommendation: null,
    command: null,
  };
}

function securityControlExists(projectRoot: string, modulePath: string): boolean {
  return [
    path.join(projectRoot, 'src', `${modulePath}.ts`),
    path.join(projectRoot, 'dist', `${modulePath}.js`),
  ].some((candidate) => fs.existsSync(candidate));
}

function buildInventoryCheck(): OperationalSecurityDoctorCheck {
  const findings = validateAgentSecurityInventory(buildAgentSecurityInventory());
  if (findings.length > 0) {
    const hasError = findings.some((finding) => finding.severity === 'error');
    return {
      id: 'agent-security-inventory',
      status: hasError ? 'fail' : 'attention',
      severity: hasError ? 'critical' : 'warn',
      title: 'Tools inventory',
      summary: `${findings.length} finding(s) in the tools security inventory.`,
      evidence: findings.map((finding) => `${finding.severity}:${finding.id}:${finding.message}`),
      recommendation: 'Classify all capabilities before exposing the tool to the agent.',
      command: 'npm test -- --runTestsByPath tests/security/AgentSecurityInventory.test.ts --runInBand',
    };
  }

  return {
    id: 'agent-security-inventory',
    status: 'pass',
    severity: 'info',
    title: 'Tools inventory',
    summary: 'Central tools inventory is complete with no exposed fallback.',
    evidence: [],
    recommendation: null,
    command: null,
  };
}

function buildProfileCoverageCheck(): OperationalSecurityDoctorCheck {
  const profiles = listSecurityProfilePolicies();
  const missing = ['personal', 'professional', 'enterprise']
    .filter((profile) => !profiles.some((entry) => entry.id === profile));
  const incomplete = profiles.filter((profile) =>
    !profile.denyCapabilities.includes('unknown')
    || !profile.requireConfirmationCapabilities.includes('shell')
    || !profile.requireConfirmationCapabilities.includes('external-send')
    || !profile.requireConfirmationForHostMutation
    || !profile.requireConfirmationForCredentials,
  );

  if (missing.length > 0 || incomplete.length > 0) {
    return {
      id: 'security-profile-coverage',
      status: 'fail',
      severity: 'critical',
      title: 'Profile coverage',
      summary: 'Security profiles lost required coverage.',
      evidence: [
        ...missing.map((profile) => `missing=${profile}`),
        ...incomplete.map((profile) => `incomplete=${profile.id}`),
      ],
      recommendation: 'Restore personal/professional/enterprise profiles with unknown deny and confirmation for shell/egress/credentials.',
      command: 'npm test -- --runTestsByPath tests/security/SecurityProfile.test.ts --runInBand',
    };
  }

  return {
    id: 'security-profile-coverage',
    status: 'pass',
    severity: 'info',
    title: 'Profile coverage',
    summary: 'Personal, professional, and enterprise profiles preserve minimum controls.',
    evidence: profiles.map((profile) => `${profile.id}:${profile.confirmationStyle}`),
    recommendation: null,
    command: null,
  };
}

function buildRecommendations(checks: OperationalSecurityDoctorCheck[]): string[] {
  return checks
    .filter((check) => check.status !== 'pass' && check.recommendation)
    .map((check) => check.recommendation as string)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function buildOperatorSummary(
  status: OperationalSecurityDoctorStatus,
  profileInspection: SecurityProfileConfigurationInspection,
  signingKeyInspection: ApprovalSigningKeyInspection,
  checks: OperationalSecurityDoctorCheck[],
  presetInspection: SecurityOperationalPresetInspection,
): string {
  const activeProfile = profileInspection.resolution.profile.label;
  const presetLabel = presetInspection.preset?.label || 'no operational preset';
  const failed = checks.filter((check) => check.status === 'fail').length;
  const attention = checks.filter((check) => check.status === 'attention').length;
  if (status === 'healthy') {
    if (signingKeyInspection.status === 'ready-on-demand') {
      return `Profile ${activeProfile} active via ${presetLabel}, approvals ready on demand, and no known insecure overrides.`;
    }
    return `Profile ${activeProfile} active via ${presetLabel}, persistent approvals, and no known insecure overrides.`;
  }
  if (status === 'blocked') {
    return `Profile ${activeProfile} active via ${presetLabel}, but ${failed} failure(s) block operational security.`;
  }
  if (signingKeyInspection.status === 'ready-on-demand' && attention === 1) {
    return `Profile ${activeProfile} active via ${presetLabel}. The only pending item is the local key that will be auto-created on first approval.`;
  }
  return `Profile ${activeProfile} active via ${presetLabel} with ${attention} attention point(s) to review.`;
}
