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
    summary: 'Desativa verificacao TLS no Node.js.',
  },
  {
    name: 'ALLOW_PRIVATE_EGRESS_TARGETS',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Permite egress para redes privadas e pode reabrir SSRF.',
  },
  {
    name: 'ALLOW_API_KEY_REVEAL',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Permite revelar API keys em resposta/API.',
  },
  {
    name: 'MITM_DISABLE_TLS_VERIFY',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Desliga validacao TLS no modo MITM.',
  },
  {
    name: 'ZAVORTH_REMOTE_SHELL_ALLOW_HOST_CODE_BINARIES',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Libera binarios de codigo no shell remoto do host.',
  },
  {
    name: 'ZAVORTH_NODE_HOST_SYSTEM_RUN_ALLOW_CODE',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Libera execucao de codigo via system.run em node host.',
  },
  {
    name: 'ZAVORTH_ALLOW_LOCAL_JAIL_SHELL',
    values: ['1', 'true'],
    severity: 'critical',
    summary: 'Libera shell no local jail.',
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
    summary: 'Permite token de auth em query string; util em dev, ruim para uso diario.',
  },
  {
    name: 'ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE',
    values: ['1', 'true'],
    severity: 'warn',
    summary: 'Libera codigo efemero no remote shell.',
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
    summary: 'Desativa backup automatico do SQLite.',
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
        ? 'Seguranca operacional saudavel.'
        : status === 'blocked'
          ? 'Seguranca operacional bloqueada por risco real.'
          : 'Seguranca operacional pronta com pontos de atencao.',
      operatorSummary: buildOperatorSummary(status, profileInspection, signingKeyInspection, checks, presetInspection),
    },
  };
}

export function formatOperationalSecurityDoctorReport(report: OperationalSecurityDoctorReport): string {
  const statusLabel = report.status === 'healthy'
    ? 'healthy'
    : report.status === 'blocked'
      ? 'blocked'
      : 'atencao';
  const lines = [
    '[zavorth-security] security doctor',
    `[zavorth-security] status: ${statusLabel} | profile: ${report.profile.label} (${report.profile.source})`,
    `[zavorth-security] checks: ${report.summary.passed} ok, ${report.summary.attention} atencao, ${report.summary.failed} falha`,
    '',
    ...report.checks.map((check) =>
      `[${check.status}] ${check.id}: ${check.summary}${check.recommendation ? ` Recommendation: ${check.recommendation}` : ''}`,
    ),
  ];

  if (report.nextSteps.length > 0) {
    lines.push('', 'Proximos passos');
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
      title: 'Perfil de seguranca',
      summary: inspection.summary,
      evidence: inspection.invalidValues.map((entry) => `${entry.key}=${entry.value}`),
      recommendation: 'Corrija o perfil para personal, professional ou enterprise.',
      command: 'zavorth doctor security --json',
    };
  }

  return {
    id: 'security-profile',
    status: 'pass',
    severity: 'info',
    title: 'Perfil de seguranca',
    summary: `Perfil ativo: ${inspection.resolution.profile.label}.`,
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
      title: 'Preset operacional',
      summary: inspection.summary,
      evidence: [inspection.presetPath],
      recommendation: inspection.recommendations[0] || 'Aplique um preset operacional.',
      command: 'zavorth security preset professional --apply',
    };
  }

  return {
    id: 'operational-security-preset',
    status: 'pass',
    severity: 'info',
    title: 'Preset operacional',
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
      title: 'Chave de aprovacao',
      summary: inspection.summary,
      evidence: inspection.reasons,
      recommendation: inspection.nextSteps[0] || 'Corrija a chave de aprovacao.',
      command: null,
    };
  }

  if (inspection.status === 'ready-on-demand') {
    return {
      id: 'approval-signing-key',
      status: 'pass',
      severity: 'info',
      title: 'Chave de aprovacao',
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
      title: 'Chave de aprovacao',
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
    title: 'Chave de aprovacao',
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
      title: 'Overrides perigosos',
      summary: 'Nenhum override inseguro conhecido esta ativo.',
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
    title: 'Overrides perigosos',
    summary: `${active.length} override(s) que enfraquecem seguranca estao ativos.`,
    evidence: active.map((override) => `${override.name}: ${override.summary}`),
    recommendation: 'Remova esses overrides do ambiente diario; use-os somente em diagnosticos isolados e temporarios.',
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
      title: 'Controles centrais',
      summary: `${missing.length} controle(s) centrais de seguranca nao foram encontrados.`,
      evidence: missing,
      recommendation: 'Restaure os arquivos de controle antes de executar agentes com tools sensiveis.',
      command: 'npm run security:ci',
    };
  }

  return {
    id: 'core-security-controls',
    status: 'pass',
    severity: 'info',
    title: 'Controles centrais',
    summary: 'Controles centrais de perfil, approval, egress, prompt injection e dados sensiveis estao presentes.',
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
      title: 'Inventario de tools',
      summary: `${findings.length} achado(s) no inventario de seguranca de tools.`,
      evidence: findings.map((finding) => `${finding.severity}:${finding.id}:${finding.message}`),
      recommendation: 'Classifique todas as capabilities antes de expor a tool ao agente.',
      command: 'npm test -- --runTestsByPath tests/security/AgentSecurityInventory.test.ts --runInBand',
    };
  }

  return {
    id: 'agent-security-inventory',
    status: 'pass',
    severity: 'info',
    title: 'Inventario de tools',
    summary: 'Inventario central de tools esta completo e sem fallback exposto.',
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
      title: 'Cobertura de perfis',
      summary: 'Perfis de seguranca perderam cobertura obrigatoria.',
      evidence: [
        ...missing.map((profile) => `missing=${profile}`),
        ...incomplete.map((profile) => `incomplete=${profile.id}`),
      ],
      recommendation: 'Restaure os perfis personal/professional/enterprise com unknown deny e confirmacao para shell/egress/credenciais.',
      command: 'npm test -- --runTestsByPath tests/security/SecurityProfile.test.ts --runInBand',
    };
  }

  return {
    id: 'security-profile-coverage',
    status: 'pass',
    severity: 'info',
    title: 'Cobertura de perfis',
    summary: 'Perfis personal, professional e enterprise preservam controles minimos.',
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
  const presetLabel = presetInspection.preset?.label || 'sem preset operacional';
  const failed = checks.filter((check) => check.status === 'fail').length;
  const attention = checks.filter((check) => check.status === 'attention').length;
  if (status === 'healthy') {
    if (signingKeyInspection.status === 'ready-on-demand') {
      return `Perfil ${activeProfile} ativo via ${presetLabel}, aprovacoes prontas sob demanda e nenhum override inseguro conhecido.`;
    }
    return `Perfil ${activeProfile} ativo via ${presetLabel}, aprovacoes persistentes e nenhum override inseguro conhecido.`;
  }
  if (status === 'blocked') {
    return `Perfil ${activeProfile} ativo via ${presetLabel}, mas ${failed} falha(s) bloqueiam seguranca operacional.`;
  }
  if (signingKeyInspection.status === 'ready-on-demand' && attention === 1) {
    return `Perfil ${activeProfile} ativo via ${presetLabel}. A unica pendencia e a chave local que sera criada automaticamente no primeiro approval.`;
  }
  return `Perfil ${activeProfile} ativo via ${presetLabel} com ${attention} ponto(s) de atencao para revisar.`;
}
