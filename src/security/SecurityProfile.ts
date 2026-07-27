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
    label: 'Personal use',
    audience: 'Standard user',
    summary: 'Low friction for daily tasks, with clear confirmation for sensitive actions.',
    confirmationStyle: 'minimal',
    denyCapabilities: ['unknown'],
    requireConfirmationCapabilities: ['credential', 'configuration', 'desktop', 'destructive', 'external-send', 'shell', 'webhook'],
    requireConfirmationForHostMutation: true,
    requireConfirmationForExternalSend: true,
    requireConfirmationForCredentials: true,
  },
  professional: {
    id: 'professional',
    label: 'Professional use',
    audience: 'Developer or individual operator',
    summary: 'Secure default for daily work: observation flows, mutation and external egress require confirmation.',
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
    label: 'Enterprise use',
    audience: 'Managed environment',
    summary: 'Stricter profile for corporate workspaces, with fail-closed and strong auditing.',
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
  home: 'personal',
  personal: 'personal',
  work: 'professional',
  dev: 'professional',
  professional: 'professional',
  bigtech: 'enterprise',
  corporate: 'enterprise',
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
      reason: 'Profile explicitly set by metadata/runtime configuration.',
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
      reason: 'Profile defined by environment variable.',
    };
  }

  if (isEnterpriseSignal(input, env)) {
    return {
      profile: getSecurityProfilePolicy('enterprise'),
      source: 'enterprise-signal',
      reason: 'Managed/corporate environment signals were detected.',
    };
  }

  const presetState = input.ignoreOperationalPreset
    ? null
    : readSecurityOperationalPresetState({ projectRoot: input.projectRoot });
  if (presetState) {
    return {
      profile: getSecurityProfilePolicy(presetState.securityProfile),
      source: 'preset',
      reason: `Profile defined by operational preset ${presetState.activePreset}.`,
    };
  }

  return {
    profile: getSecurityProfilePolicy('professional'),
    source: 'default',
    reason: 'No explicit profile provided; using professional as a secure default without high friction.',
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
      summary: 'A security profile is configured with an unknown value.',
      recommendations: [
        'Use one of these profiles: personal, professional, or enterprise.',
      ],
    };
  }

  return {
    status: 'ready',
    resolution,
    configuredValue: firstConfigured?.text || null,
    configuredSource: firstConfigured?.source || null,
    invalidValues: [],
    summary: `Perfil active: ${resolution.profile.label}.`,
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
      reasons.push(`Profile ${profile.id} requires confirmation for capability ${capability}.`);
    }
  }

  if (
    profile.requireConfirmationForHostMutation
    && definition?.canMutateHost
    && !isObservationOnlyCapabilitySet(uniqueCapabilities)
  ) {
    reasons.push(`Profile ${profile.id} requires confirmation for host/workspace mutations.`);
  }

  if (profile.requireConfirmationForExternalSend && definition?.canExfiltrateData) {
    const isSafeLookup = uniqueCapabilities.includes('network')
      && uniqueCapabilities.includes('untrusted-input')
      && !uniqueCapabilities.includes('external-send');
    if (!isSafeLookup) {
      reasons.push(`Profile ${profile.id} requires confirmation for external data send.`);
    }
  }

  if (
    profile.requireConfirmationForCredentials
    && (uniqueCapabilities.includes('credential') || uniqueCapabilities.includes('configuration'))
  ) {
    reasons.push(`Profile ${profile.id} requires confirmation for credentials/configuration.`);
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
  const profileLabel = decision.securityProfile?.label || 'active security profile';
  const capabilitySummary = humanizeCapabilities(decision.capabilities);
  return [
    `Zavorth wants to run "${decision.toolName}".`,
    `Profile: ${profileLabel}.`,
    `For security, please confirm before allowing ${capabilitySummary}.`,
    'The action will only proceed if you approve.',
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
    return 'sending data outside the computer';
  }
  if (capabilities.includes('shell')) {
    return 'executing commands';
  }
  if (capabilities.includes('desktop')) {
    return 'controlling the computer interface';
  }
  if (capabilities.includes('credential') || capabilities.includes('configuration')) {
    return 'modifying credentials or configuration';
  }
  if (capabilities.includes('filesystem') || capabilities.includes('destructive')) {
    return 'changing files or workspace';
  }
  return 'a sensitive action';
}
