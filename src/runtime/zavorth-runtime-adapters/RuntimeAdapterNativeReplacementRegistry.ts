export const RUNTIME_ADAPTER_NATIVE_REPLACEMENT_RULES = {
  internalizeOnlyAfterSidecarUnderstood: true,
  rewriteAroundZavorthContracts: true,
  provenanceOutOfCanonicalNames: true,
  testsPreservedBeforeReplacement: true,
  adapterRemovableOnlyAfterConsistency: true,
  sourceModulesCopied: false,
} as const;

export type RuntimeAdapterNativeReplacementArea =
  | 'gateway-event'
  | 'capability-policy'
  | 'channel-bridge'
  | 'session-memory'
  | 'worker-delegation'
  | 'zavorthControl';

export type RuntimeAdapterNativeReplacementContract =
  | 'NormalizedInboundMessage'
  | 'ToolExposurePolicyInput'
  | 'UniversalToolExposureProfile'
  | 'UniversalReplyPacket'
  | 'CanonicalSessionContextSnapshot'
  | 'UniversalAgentExecutorResult'
  | 'ZavorthControlAssimilationSnapshot';

export type RuntimeAdapterNativeReplacementConsistencyCase = {
  id: string;
  label: string;
  contract: RuntimeAdapterNativeReplacementContract;
  adapterBehavior: unknown;
  nativeBehavior: unknown;
  mode?: 'public-contract-exact';
};

export type RuntimeAdapterNativeReplacementRules = typeof RUNTIME_ADAPTER_NATIVE_REPLACEMENT_RULES;

export type RuntimeAdapterNativeReplacementCandidate = {
  id: string;
  label: string;
  area: RuntimeAdapterNativeReplacementArea;
  nativeContract: RuntimeAdapterNativeReplacementContract;
  adapterPath?: string;
  nativePath: string;
  publicSurfaceIds: string[];
  consistencyCases: RuntimeAdapterNativeReplacementConsistencyCase[];
  rules?: Partial<RuntimeAdapterNativeReplacementRules>;
};

export type RuntimeAdapterNativeReplacementConsistencyResult = {
  id: string;
  label: string;
  contract: RuntimeAdapterNativeReplacementContract;
  passed: boolean;
  reason: string;
};

export type RuntimeAdapterNativeReplacementIdentityLeak = {
  path: string;
  value: string;
};

export type RuntimeAdapterNativeReplacementCandidateResult = {
  id: string;
  label: string;
  area: RuntimeAdapterNativeReplacementArea;
  nativeContract: RuntimeAdapterNativeReplacementContract;
  nativePath: string;
  adapterPath?: string;
  status: 'consistency-ready' | 'blocked';
  adapterPathStatus: 'optional-removable' | 'required-until-consistency';
  canRemoveAdapter: boolean;
  rules: RuntimeAdapterNativeReplacementRules;
  ruleViolations: string[];
  consistency: RuntimeAdapterNativeReplacementConsistencyResult[];
  identityLeaks: RuntimeAdapterNativeReplacementIdentityLeak[];
};

export type RuntimeAdapterNativeReplacementPlan = {
  version: 'runtime-adapter-native-replacement-plan/v1';
  status: 'ready' | 'blocked';
  generatedAt: string;
  candidates: RuntimeAdapterNativeReplacementCandidateResult[];
  summary: {
    total: number;
    consistencyReady: number;
    blocked: number;
    removableAdapters: number;
  };
  guarantee: {
    adapterDependencyOptionalOrRemovable: boolean;
    publicSurfacesZavorthNative: boolean;
    sourceModulesCopied: false;
  };
};

export type RuntimeAdapterNativeReplacementRegistryOptions = {
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
  leaks: RuntimeAdapterNativeReplacementIdentityLeak[],
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

function evaluateConsistencyCase(
  consistencyCase: RuntimeAdapterNativeReplacementConsistencyCase,
): RuntimeAdapterNativeReplacementConsistencyResult {
  const adapter = stableStringify(consistencyCase.adapterBehavior);
  const native = stableStringify(consistencyCase.nativeBehavior);
  const passed = adapter === native;
  return {
    id: consistencyCase.id,
    label: consistencyCase.label,
    contract: consistencyCase.contract,
    passed,
    reason: passed
      ? 'Native behavior matches adapter behavior at the Zavorth public-contract layer.'
      : 'Native behavior differs from adapter behavior at the Zavorth public-contract layer.',
  };
}

function resolveRules(
  rules: Partial<RuntimeAdapterNativeReplacementRules> = {},
): RuntimeAdapterNativeReplacementRules {
  return {
    ...RUNTIME_ADAPTER_NATIVE_REPLACEMENT_RULES,
    ...rules,
    sourceModulesCopied: false,
  };
}

function sourceModuleCopyWasRequested(
  rules: Partial<RuntimeAdapterNativeReplacementRules> = {},
): boolean {
  return Object.prototype.hasOwnProperty.call(rules, 'sourceModulesCopied')
    && (rules as Record<string, unknown>).sourceModulesCopied !== false;
}

function evaluateRuleViolations(
  rules: RuntimeAdapterNativeReplacementRules,
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
    violations.push('Consistency tests must be preserved before replacement.');
  }
  if (!rules.adapterRemovableOnlyAfterConsistency) {
    violations.push('Adapter dependency can be removed only after consistency passes.');
  }
  if (rules.sourceModulesCopied !== false || sourceModuleCopyRequested) {
    violations.push('Source runtime modules cannot be copied into native replacement candidates.');
  }
  return violations;
}

export class RuntimeAdapterNativeReplacementRegistry {
  private readonly now: () => Date;
  private readonly forbiddenSourceTerms: string[];
  private readonly candidates = new Map<string, RuntimeAdapterNativeReplacementCandidate>();

  constructor(options: RuntimeAdapterNativeReplacementRegistryOptions = {}) {
    this.now = options.now || (() => new Date());
    this.forbiddenSourceTerms = options.forbiddenSourceTerms || [];
  }

  public register(candidate: RuntimeAdapterNativeReplacementCandidate): void {
    this.candidates.set(normalizeText(candidate.id, `candidate-${this.candidates.size + 1}`), candidate);
  }

  public buildPlan(): RuntimeAdapterNativeReplacementPlan {
    const results = Array.from(this.candidates.values()).map((candidate) => this.evaluateCandidate(candidate));
    const consistencyReady = results.filter((result) => result.status === 'consistency-ready').length;
    const removableAdapters = results.filter((result) => result.canRemoveAdapter).length;
    const blocked = results.length - consistencyReady;
    return {
      version: 'runtime-adapter-native-replacement-plan/v1',
      status: blocked === 0 ? 'ready' : 'blocked',
      generatedAt: this.now().toISOString(),
      candidates: results,
      summary: {
        total: results.length,
        consistencyReady,
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
    candidate: RuntimeAdapterNativeReplacementCandidate,
  ): RuntimeAdapterNativeReplacementCandidateResult {
    const rules = resolveRules(candidate.rules);
    const ruleViolations = evaluateRuleViolations(rules, sourceModuleCopyWasRequested(candidate.rules));
    const consistency = candidate.consistencyCases.map(evaluateConsistencyCase);
    const consistencyPassed = consistency.length > 0 && consistency.every((result) => result.passed);
    const publicPayload = {
      id: candidate.id,
      label: candidate.label,
      area: candidate.area,
      nativeContract: candidate.nativeContract,
      nativePath: candidate.nativePath,
      publicSurfaceIds: candidate.publicSurfaceIds,
      nativeBehavior: candidate.consistencyCases.map((consistencyCase) => consistencyCase.nativeBehavior),
    };
    const identityLeaks: RuntimeAdapterNativeReplacementIdentityLeak[] = [];
    scanIdentityLeaks(publicPayload, this.forbiddenSourceTerms, '$', identityLeaks);
    const canRemoveAdapter = consistencyPassed && ruleViolations.length === 0 && identityLeaks.length === 0;

    return {
      id: candidate.id,
      label: candidate.label,
      area: candidate.area,
      nativeContract: candidate.nativeContract,
      nativePath: candidate.nativePath,
      adapterPath: candidate.adapterPath,
      status: canRemoveAdapter ? 'consistency-ready' : 'blocked',
      adapterPathStatus: canRemoveAdapter ? 'optional-removable' : 'required-until-consistency',
      canRemoveAdapter,
      rules,
      ruleViolations,
      consistency,
      identityLeaks,
    };
  }
}
