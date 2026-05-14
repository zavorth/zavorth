import type {
  AgentPolicyDecision,
  AgentToolCapability,
  AgentToolSecurityDefinition,
} from './AgentSecurityPolicyEngine.js';
import { readSecurityOperationalPresetState } from './SecurityOperationalPreset.js';

export type SecurityProfileId = 'personal' | 'professional' | 'enterprise';
export type SecurityProfileSource =
  | 'explicit'
  | 'environment'
  | 'enterprise-signal'
  | 'preset'
  | 'default';

export type SecurityProfilePolicy = {
  id: SecurityProfileId;
  label: string;
  audience: string;
  summary: string;
  confirmationStyle: 'minimal' | 'balanced' | 'strict';
  denyCapabilities: AgentToolCapability[];
  requireConfirmationCapabilities: AgentToolCapability[];
  requireConfirmationForHostMutation: boolean;
  requireConfirmationForExternalSend: boolean;
  requireConfirmationForCredentials: boolean;
};

export type SecurityProfileResolution = {
  profile: SecurityProfilePolicy;
  source: SecurityProfileSource;
  reason: string;
};

export type SecurityProfileResolutionInput = {
  profile?: unknown;
  metadata?: Record<string, unknown> | null;
  workspace?: string | null;
  projectRoot?: string | null;
  ignoreOperationalPreset?: boolean;
  env?: Record<string, string | undefined>;
};

export type SecurityProfileConfirmationRequirement = {
  required: boolean;
  reasons: string[];
};

export type SecurityProfileConfigurationInspection = {
  status: 'ready' | 'attention';
  resolution: SecurityProfileResolution;
  configuredValue: string | null;
  configuredSource: 'explicit' | 'metadata' | 'environment' | null;
  invalidValues: Array<{
    source: 'explicit' | 'metadata' | 'environment';
    key: string;
    value: string;
  }>;
  summary: string;
  recommendations: string[];
};

const PROFILE_POLICIES: Record<SecurityProfileId, SecurityProfilePolicy> = {
  personal: {
    id: 'personal',
    label: 'Uso pessoal',
    audience: 'Usuario comum',
    summary: 'Baixa friccao para tarefas cotidianas, com confirmacao clara para acoes sensiveis.',
    confirmationStyle: 'minimal',
    denyCapabilities: ['unknown'],
    requireConfirmationCapabilities: ['credential', 'configuration', 'desktop', 'destructive', 'external-send', 'shell', 'webhook'],
    requireConfirmationForHostMutation: true,
    requireConfirmationForExternalSend: true,
    requireConfirmationForCredentials: true,
  },
  professional: {
    id: 'professional',
    label: 'Uso profissional',
    audience: 'Desenvolvedor ou operador individual',
    summary: 'Padrao seguro para trabalho diario: observacao flui, mutacao e egress externo pedem confirmacao.',
    confirmationStyle: 'balanced',
    denyCapabilities: ['unknown'],
    requireConfirmationCapabilities: [
      'configuration',
      'credential',
      'desktop',
      'destructive',
      'external-send',
      'mcp',
      'plugin',
      'shell',
      'skill',
      'webhook',
    ],
    requireConfirmationForHostMutation: true,
    requireConfirmationForExternalSend: true,
    requireConfirmationForCredentials: true,
  },
  enterprise: {
    id: 'enterprise',
    label: 'Uso corporativo',
    audience: 'Ambiente gerenciado',
    summary: 'Perfil mais rigido para workspaces corporativos, com fail-closed e auditoria forte.',
    confirmationStyle: 'strict',
    denyCapabilities: ['unknown'],
    requireConfirmationCapabilities: [
      'browser',
      'configuration',
      'credential',
      'desktop',
      'destructive',
      'external-send',
      'mcp',
      'plugin',
      'sandbox',
      'shell',
      'skill',
      'webhook',
    ],
    requireConfirmationForHostMutation: true,
    requireConfirmationForExternalSend: true,
    requireConfirmationForCredentials: true,
  },
};

const PROFILE_ALIASES: Record<string, SecurityProfileId> = {
  casa: 'personal',
  comum: 'personal',
  dona_maria: 'personal',
  home: 'personal',
  pessoal: 'personal',
  personal: 'personal',
  trabalho: 'professional',
  dev: 'professional',
  professional: 'professional',
  profissional: 'professional',
  work: 'professional',
  bigtech: 'enterprise',
  corporate: 'enterprise',
  corporativo: 'enterprise',
  enterprise: 'enterprise',
  managed: 'enterprise',
};

export function getSecurityProfilePolicy(profile: SecurityProfileId): SecurityProfilePolicy {
  return PROFILE_POLICIES[profile];
}

export function listSecurityProfilePolicies(): SecurityProfilePolicy[] {
  return Object.values(PROFILE_POLICIES).map((profile) => ({
    ...profile,
    denyCapabilities: [...profile.denyCapabilities],
    requireConfirmationCapabilities: [...profile.requireConfirmationCapabilities],
  }));
}

export function normalizeSecurityProfileId(value: unknown): SecurityProfileId | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!normalized) {
    return null;
  }
  return PROFILE_ALIASES[normalized] || null;
}

export function resolveSecurityProfile(input: SecurityProfileResolutionInput = {}): SecurityProfileResolution {
  const metadata = input.metadata || {};
  const env = input.env || process.env;
  const explicit = normalizeSecurityProfileId(
    input.profile
    || metadata.securityProfile
    || metadata.security_profile
    || metadata.zavorthSecurityProfile
    || metadata.workspaceSecurityProfile,
  );
  if (explicit) {
    return {
      profile: getSecurityProfilePolicy(explicit),
      source: 'explicit',
      reason: 'Perfil informado explicitamente por metadata/configuracao do runtime.',
    };
  }

  const envProfile = normalizeSecurityProfileId(
    env.ZAVORTH_SECURITY_PROFILE
    || env.ZAVORTH_PROFILE
    || env.ZAVORTH_SECURITY_MODE,
  );
  if (envProfile) {
    return {
      profile: getSecurityProfilePolicy(envProfile),
      source: 'environment',
      reason: 'Perfil definido por variavel de ambiente.',
    };
  }

  if (isEnterpriseSignal(input, env)) {
    return {
      profile: getSecurityProfilePolicy('enterprise'),
      source: 'enterprise-signal',
      reason: 'Sinais de ambiente gerenciado/corporativo foram detectados.',
    };
  }

  const presetState = input.ignoreOperationalPreset
    ? null
    : readSecurityOperationalPresetState({ projectRoot: input.projectRoot });
  if (presetState) {
    return {
      profile: getSecurityProfilePolicy(presetState.securityProfile),
      source: 'preset',
      reason: `Perfil definido pelo preset operacional ${presetState.activePreset}.`,
    };
  }

  return {
    profile: getSecurityProfilePolicy('professional'),
    source: 'default',
    reason: 'Nenhum perfil explicito foi informado; usando professional como padrao seguro sem alta friccao.',
  };
}

export function inspectSecurityProfileConfiguration(
  input: SecurityProfileResolutionInput = {},
): SecurityProfileConfigurationInspection {
  const metadata = input.metadata || {};
  const env = input.env || process.env;
  const resolution = resolveSecurityProfile(input);
  const candidates = [
    { source: 'explicit' as const, key: 'profile', value: input.profile },
    { source: 'metadata' as const, key: 'securityProfile', value: metadata.securityProfile },
    { source: 'metadata' as const, key: 'security_profile', value: metadata.security_profile },
    { source: 'metadata' as const, key: 'zavorthSecurityProfile', value: metadata.zavorthSecurityProfile },
    { source: 'metadata' as const, key: 'workspaceSecurityProfile', value: metadata.workspaceSecurityProfile },
    { source: 'environment' as const, key: 'ZAVORTH_SECURITY_PROFILE', value: env.ZAVORTH_SECURITY_PROFILE },
    { source: 'environment' as const, key: 'ZAVORTH_PROFILE', value: env.ZAVORTH_PROFILE },
    { source: 'environment' as const, key: 'ZAVORTH_SECURITY_MODE', value: env.ZAVORTH_SECURITY_MODE },
    { source: 'metadata' as const, key: 'securityOperationalPreset', value: input.ignoreOperationalPreset ? null : readSecurityOperationalPresetState({ projectRoot: input.projectRoot })?.activePreset },
  ];

  const configured = candidates
    .map((candidate) => ({
      ...candidate,
      text: String(candidate.value || '').trim(),
    }))
    .filter((candidate) => candidate.text.length > 0);
  const invalidValues = configured
    .filter((candidate) => candidate.key !== 'ZAVORTH_PROFILE' && !normalizeSecurityProfileId(candidate.text))
    .map((candidate) => ({
      source: candidate.source,
      key: candidate.key,
      value: candidate.text,
    }));
  const firstConfigured = configured.find((candidate) => normalizeSecurityProfileId(candidate.text));

  if (invalidValues.length > 0) {
    return {
      status: 'attention',
      resolution,
      configuredValue: firstConfigured?.text || null,
      configuredSource: firstConfigured?.source || null,
      invalidValues,
      summary: 'Existe perfil de seguranca configurado com valor desconhecido.',
      recommendations: [
        'Use um destes perfis: personal, professional ou enterprise.',
        'Aliases em portugues tambem funcionam: pessoal, profissional ou corporativo.',
      ],
    };
  }

  return {
    status: 'ready',
    resolution,
    configuredValue: firstConfigured?.text || null,
    configuredSource: firstConfigured?.source || null,
    invalidValues: [],
    summary: `Perfil ativo: ${resolution.profile.label}.`,
    recommendations: [],
  };
}

export function resolveSecurityProfileConfirmationRequirement(
  profile: SecurityProfilePolicy,
  capabilities: AgentToolCapability[],
  definition?: AgentToolSecurityDefinition | null,
): SecurityProfileConfirmationRequirement {
  const uniqueCapabilities = Array.from(new Set(capabilities));
  const reasons: string[] = [];

  for (const capability of uniqueCapabilities) {
    if (
      profile.requireConfirmationCapabilities.includes(capability)
      && !isObservationOnlyCapabilitySet(uniqueCapabilities)
    ) {
      reasons.push(`Perfil ${profile.id} pede confirmacao para capacidade ${capability}.`);
    }
  }

  if (
    profile.requireConfirmationForHostMutation
    && definition?.canMutateHost
    && !isObservationOnlyCapabilitySet(uniqueCapabilities)
  ) {
    reasons.push(`Perfil ${profile.id} pede confirmacao para mudancas no host/workspace.`);
  }

  if (profile.requireConfirmationForExternalSend && definition?.canExfiltrateData) {
    const isSafeLookup = uniqueCapabilities.includes('network')
      && uniqueCapabilities.includes('untrusted-input')
      && !uniqueCapabilities.includes('external-send');
    if (!isSafeLookup) {
      reasons.push(`Perfil ${profile.id} pede confirmacao para envio externo de dados.`);
    }
  }

  if (
    profile.requireConfirmationForCredentials
    && (uniqueCapabilities.includes('credential') || uniqueCapabilities.includes('configuration'))
  ) {
    reasons.push(`Perfil ${profile.id} pede confirmacao para credenciais/configuracao.`);
  }

  return {
    required: reasons.length > 0,
    reasons: Array.from(new Set(reasons)),
  };
}

export function resolveSecurityProfileDeniedCapabilities(
  profile: SecurityProfilePolicy,
  capabilities: AgentToolCapability[],
): AgentToolCapability[] {
  return Array.from(new Set(capabilities.filter((capability) => profile.denyCapabilities.includes(capability)))).sort();
}

export function formatUserFacingSecurityApprovalMessage(decision: AgentPolicyDecision): string {
  const profileLabel = decision.securityProfile?.label || 'perfil de seguranca ativo';
  const capabilitySummary = humanizeCapabilities(decision.capabilities);
  return [
    `O Zavorth quer executar "${decision.toolName}".`,
    `Perfil: ${profileLabel}.`,
    `Por seguranca, confirme antes de permitir ${capabilitySummary}.`,
    'A acao so continua se voce aprovar.',
  ].join(' ');
}

function isObservationOnlyCapabilitySet(capabilities: AgentToolCapability[]): boolean {
  return capabilities.includes('local-observation')
    && capabilities.every((capability) =>
      capability === 'filesystem'
      || capability === 'local-observation'
      || capability === 'network'
      || capability === 'rag'
      || capability === 'telegram'
      || capability === 'untrusted-input',
    );
}

function isEnterpriseSignal(
  input: SecurityProfileResolutionInput,
  env: Record<string, string | undefined>,
): boolean {
  const metadata = input.metadata || {};
  if (
    env.ZAVORTH_ENTERPRISE_MODE === '1'
    || env.ZAVORTH_MANAGED_DEVICE === '1'
    || env.CI_SECURITY_ENTERPRISE === '1'
    || metadata.enterpriseManaged === true
    || metadata.managedDevice === true
  ) {
    return true;
  }

  const workspace = String(input.workspace || metadata.workspace || '').toLowerCase();
  return /\b(corp|enterprise|managed|bigtech)\b/.test(workspace.replace(/[\\/_.-]+/g, ' '));
}

function humanizeCapabilities(capabilities: AgentToolCapability[]): string {
  if (capabilities.includes('external-send') || capabilities.includes('webhook')) {
    return 'envio de dados para fora do computador';
  }
  if (capabilities.includes('shell')) {
    return 'execucao de comandos';
  }
  if (capabilities.includes('desktop')) {
    return 'controle da interface do computador';
  }
  if (capabilities.includes('credential') || capabilities.includes('configuration')) {
    return 'alteracao de credenciais ou configuracoes';
  }
  if (capabilities.includes('filesystem') || capabilities.includes('destructive')) {
    return 'mudancas em arquivos ou workspace';
  }
  return 'uma acao sensivel';
}
