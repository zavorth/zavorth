export const ZAVORTH_BLUEPRINT_APPLICATION_PLANNING_PACK_NOW = '2026-05-02T05:20:00.000Z' as const;
export const ZAVORTH_BLUEPRINT_APPLICATION_PLANNING_PACK_RUNTIME_ID = 'zavorth-blueprint-application-planning-pack' as const;

export type ZavorthBlueprintPlanningDecision = 'zavorth-blueprint-application-plan-ready';

export type ZavorthBlueprintParityStatus =
  | 'implemented'
  | 'partially-implemented'
  | 'not-started'
  | 'obsolete'
  | 'blocked'
  | 'needs-design';

export type ZavorthBlueprintPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type ZavorthBlueprintSource = {
  nativeContract: 'ZavorthBlueprintSource/v1';
  path: string;
  treatedAs: 'historical-runtime-blueprint';
  publicDocsReference: 'universal agent runtime blueprint';
  productRenameApplied: false;
};

export type ZavorthBlueprintInventoryItem = {
  nativeContract: 'ZavorthBlueprintInventoryItem/v1';
  id: string;
  macroSection: string;
  themes: string[];
  systems: string[];
  relevantRisks: string[];
};

export type ZavorthBlueprintParityItem = {
  nativeContract: 'ZavorthBlueprintParityItem/v1';
  id: string;
  area: string;
  status: ZavorthBlueprintParityStatus;
  currentEquivalents: string[];
  remainingGap: string;
};

export type ZavorthBlueprintUnnecessaryWork = {
  nativeContract: 'ZavorthBlueprintUnnecessaryWork/v1';
  id: string;
  reason:
    | 'already-implemented'
    | 'legacy-identity-only'
    | 'conflicts-with-current-zavorth'
    | 'overengineering-now'
    | 'future-phase'
    | 'would-duplicate-current-system'
    | 'would-reintroduce-legacy-identity';
  summary: string;
};

export type ZavorthBlueprintRecommendedWork = {
  nativeContract: 'ZavorthBlueprintRecommendedWork/v1';
  id: string;
  priority: ZavorthBlueprintPriority;
  title: string;
  expectedBenefit: string;
  dependencies: string[];
};

export type ZavorthBlueprintRoadmapPack = {
  nativeContract: 'ZavorthBlueprintRoadmapPack/v1';
  packId: '283' | '284' | '285' | '286' | '287' | '288' | '289' | '290';
  title: string;
  objective: string;
  dependsOn: string[];
  risk: 'low' | 'medium' | 'high';
  testFocus: string[];
  doneWhen: string[];
};

export type ZavorthBlueprintNextPackBrief = {
  nativeContract: 'ZavorthBlueprintNextPackBrief/v1';
  packId: '283';
  slug: '283-canonical-workspace-bootstrap';
  objective: string;
  likelyFiles: string[];
  likelyTests: string[];
  risks: string[];
  successCriteria: string[];
};

export type ZavorthBlueprintBlockedAction = {
  nativeContract: 'ZavorthBlueprintBlockedAction/v1';
  action:
    | 'blueprint-runtime-apply'
    | 'runtime-behavior-change'
    | 'npm-publish'
    | 'stable-latest-change'
    | 'provider-tool-command-execution'
    | 'runtime-persistent-start'
    | 'raw-history-import'
    | 'external-module-copy'
    | 'legacy-public-identity-reintroduction';
  performed: false;
};

export type ZavorthBlueprintApplicationPlanningFinalState = {
  decision: ZavorthBlueprintPlanningDecision;
  runtimeBehaviorChanged: false;
  blueprintApplied: false;
  nextPack: '283-canonical-workspace-bootstrap';
  npmPublishActuallyPerformed: false;
  providerToolCommandExecuted: false;
  runtimePersistentStartPerformed: false;
  rawHistoryImported: false;
  legacyPublicIdentityReintroduced: false;
  rawSecretSerialized: false;
};

export type ZavorthBlueprintApplicationPlanningPackNormalization = {
  nativeContract: 'ZavorthBlueprintApplicationPlanningPack/v1';
  packId: '282';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_BLUEPRINT_APPLICATION_PLANNING_PACK_RUNTIME_ID;
  decision: ZavorthBlueprintPlanningDecision;
  blueprintSource: ZavorthBlueprintSource;
  blueprintInventory: ZavorthBlueprintInventoryItem[];
  parityMatrix: ZavorthBlueprintParityItem[];
  unnecessaryWork: ZavorthBlueprintUnnecessaryWork[];
  recommendedWork: ZavorthBlueprintRecommendedWork[];
  packRoadmap: ZavorthBlueprintRoadmapPack[];
  nextPackBrief: ZavorthBlueprintNextPackBrief;
  blockedActions: ZavorthBlueprintBlockedAction[];
  validationCommands: string[];
  finalState: ZavorthBlueprintApplicationPlanningFinalState;
};

export type ZavorthBlueprintApplicationPlanningPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_BLUEPRINT_APPLICATION_PLANNING_PACK_RUNTIME_ID;
};

function blueprintSource(): ZavorthBlueprintSource {
  return {
    nativeContract: 'ZavorthBlueprintSource/v1',
    path: process.env.ZAVORTH_BLUEPRINT_SOURCE_PATH || '<legacy-workspace>/zavorth_universal_agent_runtime_blueprint.md',
    treatedAs: 'historical-runtime-blueprint',
    publicDocsReference: 'universal agent runtime blueprint',
    productRenameApplied: false,
  };
}

function blueprintInventory(): ZavorthBlueprintInventoryItem[] {
  return [
    {
      nativeContract: 'ZavorthBlueprintInventoryItem/v1',
      id: 'foundation-agent-loop',
      macroSection: 'mission, problems, principles, target architecture, contracts, migration phases',
      themes: ['agent-loop-first', 'natural-language-first', 'channels-as-adapters', 'session-as-unit'],
      systems: ['agent gateway', 'agent run service', 'reply pipeline', 'context assembler', 'tool exposure policy'],
      relevantRisks: ['large rewrite', 'duplicate gateways', 'overexposed tools'],
    },
    {
      nativeContract: 'ZavorthBlueprintInventoryItem/v1',
      id: 'executive-backlog-and-expansions',
      macroSection: 'decision matrix, P0-P4 backlog, post-agent-loop expansion features',
      themes: ['run observability', 'capability discovery', 'memory with receipts', 'safety narrative'],
      systems: ['Run Observatory', 'Natural Capability Discovery', 'Memory With Receipts', 'Provider Arena'],
      relevantRisks: ['dashboards before working loop', 'marketing features before first-run value'],
    },
    {
      nativeContract: 'ZavorthBlueprintInventoryItem/v1',
      id: 'capability-autopilot',
      macroSection: 'readiness, diagnosis, repair planning, permission, validation, fallback, preflight',
      themes: ['diagnosis-first', 'receipts', 'approval', 'controlled repair'],
      systems: ['Capability Autopilot', 'Repair Planner', 'Validation Resume Loop', 'Preflight Entrypoint'],
      relevantRisks: ['unsafe autorepair', 'provider/tool execution without explicit gate'],
    },
    {
      nativeContract: 'ZavorthBlueprintInventoryItem/v1',
      id: 'product-runtime-consolidation',
      macroSection: 'product entry runtime, first-run, command center, release and installer path',
      themes: ['product surface must reflect real runtime', 'local receipts', 'release gates'],
      systems: ['Product Entry Runtime', 'Command Center', 'Capability Router', 'Hosted Installer'],
      relevantRisks: ['public docs ahead of actual alpha tag', 'hosted installer supply-chain'],
    },
  ];
}

function parityMatrix(): ZavorthBlueprintParityItem[] {
  return [
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'agent-gateway-run-service',
      area: 'agent gateway, run service, structured failures, reply path',
      status: 'implemented',
      currentEquivalents: [
        'src/runtime/agent/ZavorthAgentGateway.ts',
        'src/runtime/agent/AgentRunService.ts',
        'src/runtime/agent/FailureSemanticsRegistry.ts',
      ],
      remainingGap: 'Improve product wording and real executor coupling rather than recreate the gateway.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'workspace-bootstrap',
      area: 'canonical workspace bootstrap and first-run readiness snapshot',
      status: 'partially-implemented',
      currentEquivalents: [
        'src/services/RuntimeBootstrapService.ts',
        'src/services/RuntimeBootstrapRepairService.ts',
        'src/runtime/agent/context/WorkspaceIdentityContextAssembler.ts',
        'scripts/setup-v3.ts',
        'scripts/ops-go.ts',
        'scripts/ops-doctor.ts',
      ],
      remainingGap: 'A single side-effect-free workspace readiness contract should feed setup, go, doctor, run, and tests.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'failure-explanation-ux',
      area: 'human failure explanation and next-step rendering',
      status: 'partially-implemented',
      currentEquivalents: [
        'src/runtime/agent/FailureSemanticsRegistry.ts',
        'src/cli/ZavorthCliGoRenderer.ts',
        'scripts/ops-doctor.ts',
      ],
      remainingGap: 'The core exists, but terminal UX should standardize blocker, cause, next command, retryability, and redaction.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'run-observatory',
      area: 'execution timeline, run narrative, orphan cleanup, process/listener visibility',
      status: 'partially-implemented',
      currentEquivalents: [
        'src/runtime/sessions/v2/SessionGarbageCollector.ts',
        'src/runtime/sessions/v2/SessionRegistryService.ts',
        'src/observability/telemetry/TelemetryRuntimeService.ts',
      ],
      remainingGap: 'Create a product-facing Run Observatory that unifies runId/traceId/events/process cleanup into one local receipt surface.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'natural-capability-discovery',
      area: 'natural language capability discovery and safe next action selection',
      status: 'needs-design',
      currentEquivalents: [
        'src/services/ZavorthCapabilityOsService.ts',
        'src/capabilities/CapabilityRegistry.ts',
        'src/services/CapabilityAutopilotReadinessService.ts',
      ],
      remainingGap: 'Capability catalog exists, but natural requests still need a user-facing discovery contract with confidence, safety, and next surface.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'policy-hot-reload',
      area: 'policy reload, validation, rollback, receipts',
      status: 'partially-implemented',
      currentEquivalents: [
        'src/channels/policies/ChannelPolicyManager.ts',
        'src/services/ZavorthChannelActionService.ts',
        'src/platform/trust/ZavorthTrustPolicy.ts',
      ],
      remainingGap: 'Channel policy reload exists; runtime/tool/capability policy needs an atomic cross-domain reload model.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'context-compaction-plugin-interface',
      area: 'pluggable hot/warm/cold context compaction and recall receipts',
      status: 'not-started',
      currentEquivalents: [
        'src/context-engine/ContextEngine.ts',
        'src/runtime/context/WorkspaceOperationalMemoryService.ts',
      ],
      remainingGap: 'Compaction is internal; define a plugin interface with redaction, budget, fallback, and receipt requirements.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'doctor-setup-intelligence',
      area: 'doctor/setup intelligence, blocker prioritization, repair-safe guidance',
      status: 'implemented',
      currentEquivalents: [
        'scripts/ops-doctor.ts',
        'scripts/setup-v3.ts',
        'src/domain/gateway/application/runtime-access/RuntimeInstallJourneyService.ts',
      ],
      remainingGap: 'Consolidate around the workspace snapshot and reduce ops noise for first-run users.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'hosted-installer-flow',
      area: 'hosted installer, public install docs, alpha package smoke',
      status: 'blocked',
      currentEquivalents: [
        'scripts/install-zavorth.ps1',
        'scripts/install-zavorth.sh',
        'docs/280-zavorth-official-installer-script-pack.md',
        'docs/281-zavorth-alpha3-product-install-release-pack.md',
      ],
      remainingGap: 'Hosted installer should wait until alpha tag and DNS/hosting are intentionally coordinated.',
    },
    {
      nativeContract: 'ZavorthBlueprintParityItem/v1',
      id: 'legacy-named-gateway-paths',
      area: 'legacy blueprint names and path examples',
      status: 'obsolete',
      currentEquivalents: ['Zavorth public package, CLI, create package, and docs'],
      remainingGap: 'Do not apply old names; map architecture intent to Zavorth equivalents only.',
    },
  ];
}

function unnecessaryWork(): ZavorthBlueprintUnnecessaryWork[] {
  return [
    {
      nativeContract: 'ZavorthBlueprintUnnecessaryWork/v1',
      id: 'recreate-agent-gateway',
      reason: 'already-implemented',
      summary: 'The gateway/run/failure core exists; next work should converge UX and gaps, not rebuild it.',
    },
    {
      nativeContract: 'ZavorthBlueprintUnnecessaryWork/v1',
      id: 'apply-legacy-product-names',
      reason: 'would-reintroduce-legacy-identity',
      summary: 'Historical names in the blueprint must stay quarantined and never return to public Zavorth UX.',
    },
    {
      nativeContract: 'ZavorthBlueprintUnnecessaryWork/v1',
      id: 'new-policy-plane-from-scratch',
      reason: 'would-duplicate-current-system',
      summary: 'Existing channel, trust, tool, and capability policy surfaces should be unified through adapters and receipts.',
    },
    {
      nativeContract: 'ZavorthBlueprintUnnecessaryWork/v1',
      id: 'first-run-swarm-mesh-hardware',
      reason: 'overengineering-now',
      summary: 'Swarm, mesh, replay learning, hardware plane, and provider arena are later capabilities, not first-run blockers.',
    },
    {
      nativeContract: 'ZavorthBlueprintUnnecessaryWork/v1',
      id: 'write-enabled-create-package-now',
      reason: 'future-phase',
      summary: 'The create package should stay dry-run until workspace bootstrap, failure UX, and hosted installer gates mature.',
    },
  ];
}

function recommendedWork(): ZavorthBlueprintRecommendedWork[] {
  return [
    {
      nativeContract: 'ZavorthBlueprintRecommendedWork/v1',
      id: 'canonical-workspace-bootstrap',
      priority: 'P0',
      title: 'Canonical Workspace Bootstrap',
      expectedBenefit: 'One readiness snapshot feeds setup, go, doctor, run, installers, and tests.',
      dependencies: ['pack-282'],
    },
    {
      nativeContract: 'ZavorthBlueprintRecommendedWork/v1',
      id: 'failure-explanation-ux',
      priority: 'P0',
      title: 'Failure Explanation UX',
      expectedBenefit: 'Every blocker becomes a concise cause, impact, and next safe command.',
      dependencies: ['canonical-workspace-bootstrap'],
    },
    {
      nativeContract: 'ZavorthBlueprintRecommendedWork/v1',
      id: 'run-observatory-orphan-cleanup',
      priority: 'P1',
      title: 'Run Observatory And Orphan Cleanup',
      expectedBenefit: 'Local runs, listeners, receipts, and cleanup become visible without persistent runtime start.',
      dependencies: ['failure-explanation-ux'],
    },
    {
      nativeContract: 'ZavorthBlueprintRecommendedWork/v1',
      id: 'natural-capability-discovery',
      priority: 'P1',
      title: 'Natural Capability Discovery',
      expectedBenefit: 'Natural requests map to safe capabilities, dry-runs, and approval needs without hidden execution.',
      dependencies: ['canonical-workspace-bootstrap'],
    },
    {
      nativeContract: 'ZavorthBlueprintRecommendedWork/v1',
      id: 'policy-hot-reload',
      priority: 'P1',
      title: 'Policy Hot Reload',
      expectedBenefit: 'Operator policy changes become atomic, validated, reversible, and receipt-backed.',
      dependencies: ['natural-capability-discovery'],
    },
    {
      nativeContract: 'ZavorthBlueprintRecommendedWork/v1',
      id: 'context-compaction-plugin-interface',
      priority: 'P2',
      title: 'Context Compaction Plugin Interface',
      expectedBenefit: 'Long sessions gain controlled context compaction without hiding policy/tool state or secrets.',
      dependencies: ['policy-hot-reload'],
    },
    {
      nativeContract: 'ZavorthBlueprintRecommendedWork/v1',
      id: 'doctor-setup-intelligence',
      priority: 'P2',
      title: 'Doctor Setup Intelligence',
      expectedBenefit: 'Setup/go/doctor tell the same story and prioritize blockers for common users.',
      dependencies: ['run-observatory-orphan-cleanup', 'policy-hot-reload'],
    },
    {
      nativeContract: 'ZavorthBlueprintRecommendedWork/v1',
      id: 'hosted-installer-release',
      priority: 'P3',
      title: 'Hosted Installer Release',
      expectedBenefit: 'Official one-line installers can be hosted with checksums, dry-run, rollback, and alpha-tag clarity.',
      dependencies: ['doctor-setup-intelligence', 'resolved-alpha-publish'],
    },
  ];
}

function packRoadmap(): ZavorthBlueprintRoadmapPack[] {
  return [
    {
      nativeContract: 'ZavorthBlueprintRoadmapPack/v1',
      packId: '283',
      title: 'Canonical Workspace Bootstrap Pack',
      objective: 'Define one side-effect-free workspace readiness contract for setup, go, doctor, run, installers, and tests.',
      dependsOn: ['282'],
      risk: 'medium',
      testFocus: ['workspace fixtures', 'go --dry-run', 'doctor --help', 'create package dry-run'],
      doneWhen: ['snapshot includes cwd, repo, Node/npm, package manager, ports, blockers, next command', 'no runtime starts in dry-run'],
    },
    {
      nativeContract: 'ZavorthBlueprintRoadmapPack/v1',
      packId: '284',
      title: 'Failure Explanation UX Pack',
      objective: 'Normalize failures into what happened, likely cause, next command, retryability, risk, and redaction.',
      dependsOn: ['283'],
      risk: 'medium',
      testFocus: ['OTP failure fixture', 'port occupied fixture', 'missing env fixture', 'terminal render snapshots'],
      doneWhen: ['common blockers render concise explanations', 'debug detail remains opt-in and redacted'],
    },
    {
      nativeContract: 'ZavorthBlueprintRoadmapPack/v1',
      packId: '285',
      title: 'Run Observatory And Orphan Cleanup Pack',
      objective: 'Create local run/process/listener observability and safe orphan cleanup dry-run/apply boundaries.',
      dependsOn: ['283', '284'],
      risk: 'medium',
      testFocus: ['orphan fixtures', 'listener 18789 fixture', 'dry-run cleanup', 'receipt generation'],
      doneWhen: ['cleanup never kills without ownership evidence', 'run timeline is queryable locally'],
    },
    {
      nativeContract: 'ZavorthBlueprintRoadmapPack/v1',
      packId: '286',
      title: 'Natural Capability Discovery Pack',
      objective: 'Map natural requests to capability candidates with confidence, required approval, and safe next steps.',
      dependsOn: ['283'],
      risk: 'medium',
      testFocus: ['natural intent fixtures', 'no execution by discovery', 'capability registry parity'],
      doneWhen: ['discovery returns safe candidates without performing provider/tool/command actions'],
    },
    {
      nativeContract: 'ZavorthBlueprintRoadmapPack/v1',
      packId: '287',
      title: 'Policy Hot Reload Pack',
      objective: 'Reload runtime/tool/capability policy atomically with validation, rollback, and receipts.',
      dependsOn: ['286'],
      risk: 'high',
      testFocus: ['valid reload', 'invalid reload keeps previous policy', 'receipt redaction', 'tool exposure recalculation'],
      doneWhen: ['runs use stable policy snapshots', 'failed reloads are explicit and non-permissive'],
    },
    {
      nativeContract: 'ZavorthBlueprintRoadmapPack/v1',
      packId: '288',
      title: 'Context Compaction Plugin Interface Pack',
      objective: 'Define pluggable context compaction with redaction, budget, fallback, and receipts.',
      dependsOn: ['283', '286', '287'],
      risk: 'medium',
      testFocus: ['long session fixture', 'plugin failure fallback', 'redaction invariant', 'replay determinism'],
      doneWhen: ['compaction emits what was summarized or omitted', 'policy/tool state cannot be hidden silently'],
    },
    {
      nativeContract: 'ZavorthBlueprintRoadmapPack/v1',
      packId: '289',
      title: 'Doctor Setup Intelligence Pack',
      objective: 'Make setup/go/doctor consume the same snapshot and prioritize blockers for common users.',
      dependsOn: ['283', '284', '285', '287'],
      risk: 'medium',
      testFocus: ['doctor fixtures', 'setup incomplete fixture', 'go blocked fixture', 'redaction'],
      doneWhen: ['doctor separates blockers from optional checks', 'setup/go/doctor recommend consistent next commands'],
    },
    {
      nativeContract: 'ZavorthBlueprintRoadmapPack/v1',
      packId: '290',
      title: 'Hosted Installer Release Pack',
      objective: 'Host reviewed installer scripts with checksums, dry-run smoke, alpha package clarity, and rollback.',
      dependsOn: ['281-publish-resolved', '289'],
      risk: 'high',
      testFocus: ['remote dry-run', 'checksum', 'npm dist-tag check', 'rollback rehearsal'],
      doneWhen: ['hosted scripts download expected content', 'dry-run does not install globally or start runtime'],
    },
  ];
}

function nextPackBrief(): ZavorthBlueprintNextPackBrief {
  return {
    nativeContract: 'ZavorthBlueprintNextPackBrief/v1',
    packId: '283',
    slug: '283-canonical-workspace-bootstrap',
    objective: 'Create the canonical readiness snapshot for a cloned repo or installed CLI before any runtime start.',
    likelyFiles: [
      'src/services/CanonicalWorkspaceBootstrapService.ts',
      'src/contracts/CanonicalWorkspaceBootstrapContract.ts',
      'scripts/setup-v3.ts',
      'scripts/ops-go.ts',
      'scripts/ops-doctor.ts',
      'src/zavorth-cli.ts',
      'tests/services/CanonicalWorkspaceBootstrapService.test.ts',
    ],
    likelyTests: [
      'npx jest tests/runtime/external-agents/ZavorthCanonicalWorkspaceBootstrapPack.test.ts --runInBand --testTimeout=30000',
      'npx jest tests/services/CanonicalWorkspaceBootstrapService.test.ts --runInBand --testTimeout=30000',
      'npm run runtime:check --silent',
      'node bin/zavorth.js go --dry-run --timeout-ms=1000 --poll-ms=250',
      'node bin/zavorth.js doctor --help',
      'node packages/create-zavorth/bin/create-zavorth.js --dry-run',
    ],
    risks: ['Windows/WSL path differences', 'duplicate setup checks', 'accidental runtime start', 'raw token prompting during setup'],
    successCriteria: [
      'snapshot records workspace root, package manager, Node/npm versions, ports, env state, build state, blockers, and next command',
      'snapshot is read-only by default',
      'setup, go, and doctor can consume the same shape',
      'no provider/tool/command execution occurs in tests',
    ],
  };
}

function blockedActions(): ZavorthBlueprintBlockedAction[] {
  return [
    'blueprint-runtime-apply',
    'runtime-behavior-change',
    'npm-publish',
    'stable-latest-change',
    'provider-tool-command-execution',
    'runtime-persistent-start',
    'raw-history-import',
    'external-module-copy',
    'legacy-public-identity-reintroduction',
  ].map((action) => ({
    nativeContract: 'ZavorthBlueprintBlockedAction/v1',
    action: action as ZavorthBlueprintBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthBlueprintApplicationPlanningPack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'redaction scan',
    'public output/docs scan',
    'cleanup check',
  ];
}

export function normalizeZavorthBlueprintApplicationPlanningPack(
  options: ZavorthBlueprintApplicationPlanningPackOptions,
): ZavorthBlueprintApplicationPlanningPackNormalization {
  return {
    nativeContract: 'ZavorthBlueprintApplicationPlanningPack/v1',
    packId: '282',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'zavorth-blueprint-application-plan-ready',
    blueprintSource: blueprintSource(),
    blueprintInventory: blueprintInventory(),
    parityMatrix: parityMatrix(),
    unnecessaryWork: unnecessaryWork(),
    recommendedWork: recommendedWork(),
    packRoadmap: packRoadmap(),
    nextPackBrief: nextPackBrief(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision: 'zavorth-blueprint-application-plan-ready',
      runtimeBehaviorChanged: false,
      blueprintApplied: false,
      nextPack: '283-canonical-workspace-bootstrap',
      npmPublishActuallyPerformed: false,
      providerToolCommandExecuted: false,
      runtimePersistentStartPerformed: false,
      rawHistoryImported: false,
      legacyPublicIdentityReintroduced: false,
      rawSecretSerialized: false,
    },
  };
}

export class ZavorthBlueprintApplicationPlanningPack {
  public constructor(public readonly normalization: ZavorthBlueprintApplicationPlanningPackNormalization) {}

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public parityStatuses(): ZavorthBlueprintParityStatus[] {
    return Array.from(new Set(this.normalization.parityMatrix.map((item) => item.status)));
  }
}

export function createZavorthBlueprintApplicationPlanningPackFixture(): ZavorthBlueprintApplicationPlanningPack {
  return new ZavorthBlueprintApplicationPlanningPack(
    normalizeZavorthBlueprintApplicationPlanningPack({
      generatedAt: ZAVORTH_BLUEPRINT_APPLICATION_PLANNING_PACK_NOW,
      runtimeId: ZAVORTH_BLUEPRINT_APPLICATION_PLANNING_PACK_RUNTIME_ID,
    }),
  );
}
