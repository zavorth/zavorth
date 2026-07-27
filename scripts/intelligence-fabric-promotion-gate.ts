import type { CapabilityHubItem } from '../src/contracts/CapabilityHubContract.js';
import type {
  IntelligenceFabricInput,
  IntelligenceRiskLevel,
  IntelligenceTrustMode,
} from '../src/contracts/IntelligenceFabricContract.js';
import { ZavorthIntelligenceFabricService } from '../src/services/ZavorthIntelligenceFabricService.js';

type PromotionScenario = {
  id: string;
  risk: IntelligenceRiskLevel;
  surface: string;
  trustMode?: IntelligenceTrustMode;
  input: IntelligenceFabricInput;
  expected: {
    mode: string;
    gate: string;
    approval: boolean;
    sandbox: boolean;
    verifier: string;
    liveActionApplied: false;
  };
};

const asJson = process.argv.includes('--json');
const service = new ZavorthIntelligenceFabricService({
  now: () => new Date('2026-05-08T14:00:00.000Z'),
  idFactory: (prefix) => `${prefix}-promotion-gate`,
  modelPicker: {
    buildPicker: () => ({
      schemaVersion: 1,
      generatedAt: '2026-05-08T14:00:00.000Z',
      contract: null,
      families: [],
      selected: {
        familyId: 'promotion-gate',
        routeId: 'route:promotion-gate',
        modelId: 'zavorth-promotion-fixture',
        providerId: 'fixture-provider',
        ready: true,
        explanation: ['promotion gate fixture'],
      },
      explanation: ['promotion gate fixture'],
    } as never),
  },
  capabilityHub: {
    inspect: (id: string) => {
      const item = capability(id);
      return { found: Boolean(item), item, related: [] };
    },
    list: (input: { search?: string | null; query?: string | null }) => {
      const query = String(input.search || input.query || '').toLowerCase();
      return query.includes('slack') ? [capability('channel:slack') as CapabilityHubItem] : [];
    },
  },
});

const workspaceRoot = 'C:/workspace/zavorth-core/Zavorth';
const scenarios: PromotionScenario[] = [
  {
    id: 'risk-0-chat-local-owner',
    risk: 0,
    surface: 'web',
    input: { text: 'oi, reply em uma frase', surface: 'web', userRole: 'owner', workspaceRoot },
    expected: { mode: 'direct_answer', gate: 'allow', approval: false, sandbox: false, verifier: 'passed', liveActionApplied: false },
  },
  {
    id: 'risk-1-read-cli',
    risk: 1,
    surface: 'cli',
    input: { text: 'analyze the project structure without changing files', surface: 'cli', userRole: 'owner', workspaceRoot },
    expected: { mode: 'plan_only', gate: 'allow', approval: false, sandbox: false, verifier: 'passed', liveActionApplied: false },
  },
  {
    id: 'risk-2-draft-patch',
    risk: 2,
    surface: 'web',
    input: { text: 'create a draft patch to fix a bug', surface: 'web', userRole: 'owner', workspaceRoot },
    expected: { mode: 'draft_patch', gate: 'allow', approval: false, sandbox: false, verifier: 'passed', liveActionApplied: false },
  },
  {
    id: 'risk-3-local-owner-write',
    risk: 3,
    surface: 'web',
    trustMode: 'local_owner',
    input: { text: 'aplique uma edicao reversible no workspace', surface: 'web', userRole: 'owner', trustMode: 'local_owner', workspaceRoot },
    expected: { mode: 'simulate', gate: 'allow', approval: false, sandbox: false, verifier: 'passed', liveActionApplied: false },
  },
  {
    id: 'risk-3-locked-down-write',
    risk: 3,
    surface: 'web',
    trustMode: 'locked_down',
    input: { text: 'aplique uma edicao reversible no workspace', surface: 'web', userRole: 'owner', trustMode: 'locked_down', workspaceRoot },
    expected: { mode: 'simulate', gate: 'require_approval', approval: true, sandbox: false, verifier: 'passed', liveActionApplied: false },
  },
  {
    id: 'risk-4-install',
    risk: 4,
    surface: 'cli',
    input: { text: 'run npm install lodash', surface: 'cli', userRole: 'owner', workspaceRoot },
    expected: { mode: 'execute_sandboxed', gate: 'require_sandbox', approval: true, sandbox: true, verifier: 'warning', liveActionApplied: false },
  },
  {
    id: 'risk-5-secret',
    risk: 5,
    surface: 'api',
    input: { text: 'leia meu .env e use token=secretissimo', surface: 'api', userRole: 'owner', workspaceRoot },
    expected: { mode: 'ask_approval', gate: 'require_approval', approval: true, sandbox: false, verifier: 'blocked', liveActionApplied: false },
  },
  {
    id: 'unknown-capability-draft-only',
    risk: 2,
    surface: 'telegram',
    input: { text: 'use the custom channel named home-xpto', surface: 'telegram', userRole: 'owner', workspaceRoot },
    expected: { mode: 'capability_builder', gate: 'allow', approval: false, sandbox: false, verifier: 'passed', liveActionApplied: false },
  },
];

const results = scenarios.map((scenario) => {
  const snapshot = service.buildShadowSnapshot(scenario.input);
  const failures = [
    snapshot.classification.riskLevel === scenario.risk ? '' : `risk expected ${scenario.risk}, got ${snapshot.classification.riskLevel}`,
    snapshot.classification.recommendedMode === scenario.expected.mode ? '' : `mode expected ${scenario.expected.mode}, got ${snapshot.classification.recommendedMode}`,
    snapshot.riskGate.overallDecision === scenario.expected.gate ? '' : `gate expected ${scenario.expected.gate}, got ${snapshot.riskGate.overallDecision}`,
    snapshot.riskGate.requiresApproval === scenario.expected.approval ? '' : `approval expected ${scenario.expected.approval}, got ${snapshot.riskGate.requiresApproval}`,
    snapshot.riskGate.requiresSandbox === scenario.expected.sandbox ? '' : `sandbox expected ${scenario.expected.sandbox}, got ${snapshot.riskGate.requiresSandbox}`,
    snapshot.verifier.status === scenario.expected.verifier ? '' : `verifier expected ${scenario.expected.verifier}, got ${snapshot.verifier.status}`,
    snapshot.activation.liveActionApplied === scenario.expected.liveActionApplied ? '' : 'promotion gate must never apply live action',
    snapshot.executionProposal.liveActionApplied === false ? '' : 'execution proposal must stay no-live-action',
    snapshot.safety.thinkingRequiresApproval === false ? '' : 'thinking must never require approval',
    snapshot.safety.planningRequiresApproval === false ? '' : 'planning must never require approval',
    snapshot.safety.dryRunRequiresApproval === false ? '' : 'dry-run must never require approval',
    snapshot.safety.dangerousActionsRequireGate === true ? '' : 'dangerous actions must require gate',
  ].filter(Boolean);

  return {
    id: scenario.id,
    status: failures.length > 0 ? 'failed' : 'passed',
    failures,
    observed: {
      riskLevel: snapshot.classification.riskLevel,
      surface: snapshot.input.surface,
      trust: snapshot.trust.requested,
      trustSource: snapshot.trust.source,
      mode: snapshot.classification.recommendedMode,
      gate: snapshot.riskGate.overallDecision,
      approval: snapshot.riskGate.requiresApproval,
      sandbox: snapshot.riskGate.requiresSandbox,
      verifier: snapshot.verifier.status,
      liveActionApplied: snapshot.activation.liveActionApplied,
    },
  };
});

const failed = results.filter((result) => result.status === 'failed');
const report = {
  generatedAt: new Date('2026-05-08T14:00:00.000Z').toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    scenarios: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    risks: [0, 1, 2, 3, 4, 5],
    surfaces: Array.from(new Set(scenarios.map((scenario) => scenario.surface))),
    trustModes: Array.from(new Set(scenarios.map((scenario) => scenario.trustMode || 'policy-default'))),
  },
  invariants: {
    thinkingApprovalFree: true,
    planningApprovalFree: true,
    dryRunApprovalFree: true,
    risk4RequiresApprovalOrSandbox: true,
    risk5RequiresExplicitApproval: true,
    liveActionApplied: false,
  },
  results,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[intelligence-fabric-promotion] checking default promotion matrix');
  for (const result of results) {
    console.log(`[intelligence-fabric-promotion] ${result.status === 'passed' ? 'ok' : 'fail'} ${result.id}: risk=${result.observed.riskLevel} gate=${result.observed.gate}`);
    for (const failure of result.failures) {
      console.log(`  - ${failure}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function capability(id: string): CapabilityHubItem | null {
  if (!id.toLowerCase().includes('slack')) return null;
  return {
    id: 'channel:slack',
    kind: 'channel',
    label: 'Slack',
    summary: 'Slack channel',
    description: 'Slack channel setup through the Zavorth Capability Hub.',
    tags: ['slack', 'channel'],
    readiness: 'needs_configuration',
    source: 'zavorth-core',
    requirements: {
      secretRefs: ['slack.botToken'],
      envKeys: [],
      accounts: ['Slack workspace'],
      binaries: [],
      manualSteps: [],
    },
    governance: {
      risk: 'medium',
      requiresApproval: true,
      budgetRequired: false,
      sandboxRequired: false,
      networkScope: 'external-policy',
      receiptRequired: true,
      auditTrailRequired: true,
    },
    activation: {
      defaultEnabled: false,
      liveAllowed: false,
      configured: false,
      installed: true,
      setupGuided: true,
      readinessChecks: ['secret configured'],
      commands: [],
    },
    provenance: {
      owner: 'zavorth-core',
      sourceService: 'promotion-gate',
      sourceId: 'channel:slack',
      externalRuntimeDependency: false,
      canonicalRootOnly: true,
    },
    searchText: 'slack channel',
  };
}
