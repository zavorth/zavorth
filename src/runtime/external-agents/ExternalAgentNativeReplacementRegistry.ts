export const EXTERNAL_AGENT_NATIVE_REPLACEMENT_RULES = {
  internalizeOnlyAfterSidecarUnderstood: true,
  rewriteAroundZavorthContracts: true,
  provenanceOutOfCanonicalNames: true,
  testsPreservedBeforeReplacement: true,
  adapterRemovableOnlyAfterParity: true,
  sourceModulesCopied: false,
} as const;

export type ExternalAgentNativeReplacementArea =
  | 'gateway-event'
  | 'capability-policy'
  | 'channel-bridge'
  | 'session-memory'
  | 'worker-delegation'
  | 'command-center';

export type ExternalAgentNativeReplacementContract =
  | 'NormalizedInboundMessage'
  | 'ToolExposurePolicyInput'
  | 'UniversalToolExposureProfile'
  | 'UniversalReplyPacket'
  | 'CanonicalSessionContextSnapshot'
  | 'UniversalAgentExecutorResult'
  | 'ZavorthCommandCenterAssimilationSnapshot';

export type ExternalAgentNativeReplacementParityCase = {
  id: string;
  label: string;
  contract: ExternalAgentNativeReplacementContract;
  adapterBehavior: unknown;
  nativeBehavior: unknown;
  mode?: 'public-contract-exact';
};

export type ExternalAgentNativeReplacementRules = typeof EXTERNAL_AGENT_NATIVE_REPLACEMENT_RULES;

export type ExternalAgentNativeReplacementCandidate = {
  id: string;
  label: string;
  area: ExternalAgentNativeReplacementArea;
  nativeContract: ExternalAgentNativeReplacementContract;
  adapterPath?: string;
  nativePath: string;
  publicSurfaceIds: string[];
  parityCases: ExternalAgentNativeReplacementParityCase[];
  rules?: Partial<ExternalAgentNativeReplacementRules>;
};

export type ExternalAgentNativeReplacementParityResult = {
  id: string;
  label: string;
  contract: ExternalAgentNativeReplacementContract;
  passed: boolean;
  reason: string;
};

export type ExternalAgentNativeReplacementIdentityLeak = {
  path: string;
  value: string;
};

export type ExternalAgentNativeReplacementCandidateResult = {
  id: string;
  label: string;
  area: ExternalAgentNativeReplacementArea;
  nativeContract: ExternalAgentNativeReplacementContract;
  nativePath: string;
  adapterPath?: string;
  status: 'parity-ready' | 'blocked';
  adapterPathStatus: 'optional-removable' | 'required-until-parity';
  canRemoveAdapter: boolean;
  rules: ExternalAgentNativeReplacementRules;
  ruleViolations: string[];
  parity: ExternalAgentNativeReplacementParityResult[];
  identityLeaks: ExternalAgentNativeReplacementIdentityLeak[];
};

export type ExternalAgentNativeReplacementPlan = {
  version: 'external-agent-native-replacement-plan/v1';
  status: 'ready' | 'blocked';
  generatedAt: string;
  candidates: ExternalAgentNativeReplacementCandidateResult[];
  summary: {
    total: number;
    parityReady: number;
    blocked: number;
    removableAdapters: number;
  };
  guarantee: {
    adapterDependencyOptionalOrRemovable: boolean;
    publicSurfacesZavorthNative: boolean;
    sourceModulesCopied: false;
  };
};

export type ExternalAgentNativeReplacementRegistryOptions = {
  now?: () => Date;
  forbiddenSourceTerms?: string[];
};

const SOURCE_EVIDENCE_KEYS = new Set([
  'diagnostics',
  'inventoryEvidence',
  'sourceRuntimeName',
  'sourceRuntimeVersion',
  'sourceCapabilityName',
  'rawKind',
  'observedAt',
]);

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sortObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(value).sort().reduce<Record<string, unknown>>((acc, key) => {
    if (SOURCE_EVIDENCE_KEYS.has(key)) {
      return acc;
    }
    const next = canonicalizeNativeReplacementContract(value[key]);
    if (next !== undefined) {
      acc[key] = next;
    }
    return acc;
  }, {});
}

export function canonicalizeNativeReplacementContract(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeNativeReplacementContract);
  }
  if (isRecord(value)) {
    return sortObject(value);
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalizeNativeReplacementContract(value));
}

function scanIdentityLeaks(
  value: unknown,
  forbiddenTerms: string[],
  path: string,
  leaks: ExternalAgentNativeReplacementIdentityLeak[],
): void {
  if (typeof value === 'string') {
    const matched = forbiddenTerms.find((term) => term && value.toLowerCase().includes(term.toLowerCase()));
    if (matched) {
      leaks.push({ path, value });
    }
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanIdentityLeaks(entry, forbiddenTerms, `${path}[${index}]`, leaks));
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const keyMatched = forbiddenTerms.find((term) => term && key.toLowerCase().includes(term.toLowerCase()));
    if (keyMatched) {
      leaks.push({ path: `${path}.${key}`, value: key });
    }
    scanIdentityLeaks(entry, forbiddenTerms, `${path}.${key}`, leaks);
  });
}

function evaluateParityCase(
  parityCase: ExternalAgentNativeReplacementParityCase,
): ExternalAgentNativeReplacementParityResult {
  const adapter = stableStringify(parityCase.adapterBehavior);
  const native = stableStringify(parityCase.nativeBehavior);
  const passed = adapter === native;
  return {
    id: parityCase.id,
    label: parityCase.label,
    contract: parityCase.contract,
    passed,
    reason: passed
      ? 'Native behavior matches adapter behavior at the Zavorth public-contract layer.'
      : 'Native behavior differs from adapter behavior at the Zavorth public-contract layer.',
  };
}

function resolveRules(
  rules: Partial<ExternalAgentNativeReplacementRules> = {},
): ExternalAgentNativeReplacementRules {
  return {
    ...EXTERNAL_AGENT_NATIVE_REPLACEMENT_RULES,
    ...rules,
    sourceModulesCopied: false,
  };
}

function sourceModuleCopyWasRequested(
  rules: Partial<ExternalAgentNativeReplacementRules> = {},
): boolean {
  return Object.prototype.hasOwnProperty.call(rules, 'sourceModulesCopied')
    && (rules as Record<string, unknown>).sourceModulesCopied !== false;
}

function evaluateRuleViolations(
  rules: ExternalAgentNativeReplacementRules,
  sourceModuleCopyRequested: boolean,
): string[] {
  const violations: string[] = [];
  if (!rules.internalizeOnlyAfterSidecarUnderstood) {
    violations.push('Native replacement requires sidecar behavior to be understood first.');
  }
  if (!rules.rewriteAroundZavorthContracts) {
    violations.push('Native replacement must be rewritten around Zavorth contracts.');
  }
  if (!rules.provenanceOutOfCanonicalNames) {
    violations.push('Provenance must stay out of canonical public names.');
  }
  if (!rules.testsPreservedBeforeReplacement) {
    violations.push('Parity tests must be preserved before replacement.');
  }
  if (!rules.adapterRemovableOnlyAfterParity) {
    violations.push('Adapter dependency can be removed only after parity passes.');
  }
  if (rules.sourceModulesCopied !== false || sourceModuleCopyRequested) {
    violations.push('Source runtime modules cannot be copied into native replacement candidates.');
  }
  return violations;
}

export class ExternalAgentNativeReplacementRegistry {
  private readonly now: () => Date;
  private readonly forbiddenSourceTerms: string[];
  private readonly candidates = new Map<string, ExternalAgentNativeReplacementCandidate>();

  constructor(options: ExternalAgentNativeReplacementRegistryOptions = {}) {
    this.now = options.now || (() => new Date());
    this.forbiddenSourceTerms = options.forbiddenSourceTerms || [];
  }

  public register(candidate: ExternalAgentNativeReplacementCandidate): void {
    this.candidates.set(normalizeText(candidate.id, `candidate-${this.candidates.size + 1}`), candidate);
  }

  public buildPlan(): ExternalAgentNativeReplacementPlan {
    const results = Array.from(this.candidates.values()).map((candidate) => this.evaluateCandidate(candidate));
    const parityReady = results.filter((result) => result.status === 'parity-ready').length;
    const removableAdapters = results.filter((result) => result.canRemoveAdapter).length;
    const blocked = results.length - parityReady;
    return {
      version: 'external-agent-native-replacement-plan/v1',
      status: blocked === 0 ? 'ready' : 'blocked',
      generatedAt: this.now().toISOString(),
      candidates: results,
      summary: {
        total: results.length,
        parityReady,
        blocked,
        removableAdapters,
      },
      guarantee: {
        adapterDependencyOptionalOrRemovable: results.every((result) => result.adapterPathStatus === 'optional-removable'),
        publicSurfacesZavorthNative: results.every((result) => result.identityLeaks.length === 0),
        sourceModulesCopied: false,
      },
    };
  }

  private evaluateCandidate(
    candidate: ExternalAgentNativeReplacementCandidate,
  ): ExternalAgentNativeReplacementCandidateResult {
    const rules = resolveRules(candidate.rules);
    const ruleViolations = evaluateRuleViolations(rules, sourceModuleCopyWasRequested(candidate.rules));
    const parity = candidate.parityCases.map(evaluateParityCase);
    const parityPassed = parity.length > 0 && parity.every((result) => result.passed);
    const publicPayload = {
      id: candidate.id,
      label: candidate.label,
      area: candidate.area,
      nativeContract: candidate.nativeContract,
      nativePath: candidate.nativePath,
      publicSurfaceIds: candidate.publicSurfaceIds,
      nativeBehavior: candidate.parityCases.map((parityCase) => parityCase.nativeBehavior),
    };
    const identityLeaks: ExternalAgentNativeReplacementIdentityLeak[] = [];
    scanIdentityLeaks(publicPayload, this.forbiddenSourceTerms, '$', identityLeaks);
    const canRemoveAdapter = parityPassed && ruleViolations.length === 0 && identityLeaks.length === 0;

    return {
      id: candidate.id,
      label: candidate.label,
      area: candidate.area,
      nativeContract: candidate.nativeContract,
      nativePath: candidate.nativePath,
      adapterPath: candidate.adapterPath,
      status: canRemoveAdapter ? 'parity-ready' : 'blocked',
      adapterPathStatus: canRemoveAdapter ? 'optional-removable' : 'required-until-parity',
      canRemoveAdapter,
      rules,
      ruleViolations,
      parity,
      identityLeaks,
    };
  }
}
