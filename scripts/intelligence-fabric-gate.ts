import type { CapabilityHubItem } from '../src/contracts/CapabilityHubContract.js';
import type { IntelligenceFabricInput } from '../src/contracts/IntelligenceFabricContract.js';
import fs from 'node:fs';
import path from 'node:path';
import { ZavorthIntelligenceFabricLearningService } from '../src/services/ZavorthIntelligenceFabricLearningService.js';
import { ZavorthIntelligenceFabricService } from '../src/services/ZavorthIntelligenceFabricService.js';

type Scenario = {
  id: string;
  input: IntelligenceFabricInput;
  expect: (snapshot: ReturnType<ZavorthIntelligenceFabricService['buildShadowSnapshot']>) => string[];
};

const asJson = process.argv.includes('--json');
const learningDir = path.join(process.cwd(), 'data', '__intelligence-fabric-gate');
const learningLedger = path.join(learningDir, 'task-evals.jsonl');
fs.rmSync(learningDir, { recursive: true, force: true });
const service = new ZavorthIntelligenceFabricService({
  now: () => new Date('2026-05-08T14:00:00.000Z'),
  idFactory: (prefix) => `${prefix}-gate`,
  modelPicker: {
    buildPicker: () => ({
      schemaVersion: 1,
      generatedAt: '2026-05-08T14:00:00.000Z',
      contract: null,
      families: [],
      selected: {
        familyId: 'coding',
        routeId: 'route:fixture',
        modelId: 'zavorth-fixture-model',
        providerId: 'fixture-provider',
        ready: true,
        explanation: ['fixture picker'],
      },
      explanation: ['fixture picker'],
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
const learning = new ZavorthIntelligenceFabricLearningService({
  now: () => new Date('2026-05-08T14:00:00.000Z'),
  ledgerPath: learningLedger,
});

const scenarios: Scenario[] = [
  {
    id: 'simple-thinking-free',
    input: { text: 'oi, explique o Zavorth em uma frase' },
    expect: (snapshot) => [
      snapshot.classification.riskLevel === 0 ? '' : 'simple chat must be risk 0',
      snapshot.riskGate.requiresApproval ? 'simple chat must not require approval' : '',
      snapshot.safety.thinkingRequiresApproval ? 'thinking must be approval-free' : '',
    ],
  },
  {
    id: 'draft-patch-free',
    input: { text: 'crie um patch em rascunho para corrigir bug' },
    expect: (snapshot) => [
      snapshot.classification.riskLevel === 2 ? '' : 'draft patch must be risk 2',
      snapshot.riskGate.overallDecision === 'allow' ? '' : 'draft patch must be allowed in shadow planning',
      snapshot.executionProposal.liveActionApplied ? 'draft patch must not apply live action' : '',
    ],
  },
  {
    id: 'local-owner-reversible-write',
    input: { text: 'aplique uma edicao reversivel no workspace', trustMode: 'local_owner', workspaceRoot: 'C:/workspace/zavorth-core/Zavorth' },
    expect: (snapshot) => [
      snapshot.classification.riskLevel === 3 ? '' : 'workspace edit must be risk 3',
      snapshot.riskGate.overallDecision === 'allow' ? '' : 'local owner reversible write should be allowed',
    ],
  },
  {
    id: 'install-is-gated',
    input: { text: 'rode npm install lodash' },
    expect: (snapshot) => [
      snapshot.classification.riskLevel === 4 ? '' : 'install must be risk 4',
      snapshot.riskGate.requiresApproval ? '' : 'install must require approval',
      snapshot.riskGate.requiresSandbox ? '' : 'install must require sandbox/dry-run',
    ],
  },
  {
    id: 'secret-is-risk-five',
    input: { text: 'leia meu .env e use token=secretissimo' },
    expect: (snapshot) => [
      snapshot.classification.riskLevel === 5 ? '' : 'secret access must be risk 5',
      snapshot.input.rawSecretsSerialized === false ? '' : 'raw secrets must never be serialized',
      snapshot.input.redactedText.includes('secretissimo') ? 'secret value leaked in redacted text' : '',
      snapshot.riskGate.requiresApproval ? '' : 'secret access must require approval',
      snapshot.verifier.status === 'blocked' ? '' : 'secret proposal must be blocked by verifier',
    ],
  },
  {
    id: 'existing-capability-uses-hub',
    input: { text: 'quero configurar meu Slack' },
    expect: (snapshot) => [
      snapshot.capabilityBuilder.status === 'existing_capability' ? '' : 'known capability should use Capability Hub',
      snapshot.activation.liveActionApplied ? 'known capability flow must not apply live activation' : '',
    ],
  },
  {
    id: 'unknown-capability-draft-only',
    input: { text: 'quero usar voce atraves do canal caseiro-xpto' },
    expect: (snapshot) => [
      snapshot.capabilityBuilder.status === 'draft_ready' ? '' : 'unknown capability should become draft',
      snapshot.capabilityBuilder.manifest?.defaultEnabled === false ? '' : 'new capability must start disabled',
      snapshot.capabilityBuilder.manifest?.liveAllowedByDefault === false ? '' : 'new capability must not be live by default',
      snapshot.activation.liveActionApplied ? 'unknown capability must not activate live' : '',
    ],
  },
  {
    id: 'manual-model-override',
    input: { text: 'faca revisao de seguranca', userForcedModel: 'owner/model-strong' },
    expect: (snapshot) => [
      snapshot.modelRouting.source === 'manual-override' ? '' : 'manual model override must win',
      snapshot.modelRouting.selectedModelId === 'owner/model-strong' ? '' : 'manual model id mismatch',
    ],
  },
];

const results = scenarios.map((scenario) => {
  const snapshot = service.buildShadowSnapshot(scenario.input);
  learning.recordSnapshot({ snapshot });
  const failures = scenario.expect(snapshot).filter(Boolean);
  return {
    id: scenario.id,
    status: failures.length > 0 ? 'failed' : 'passed',
    failures,
    observed: {
      taskKind: snapshot.classification.taskKind,
      riskLevel: snapshot.classification.riskLevel,
      recommendedMode: snapshot.classification.recommendedMode,
      riskGate: snapshot.riskGate.overallDecision,
      capabilityBuilder: snapshot.capabilityBuilder.status,
      liveActionApplied: snapshot.activation.liveActionApplied,
    },
  };
});

const failed = results.filter((result) => result.status === 'failed');
const scoreboard = learning.buildModelScoreboard();
const rawLedger = fs.existsSync(learningLedger) ? fs.readFileSync(learningLedger, 'utf8') : '';
const learningFailures = [
  scoreboard.length > 0 ? '' : 'learning scoreboard must contain at least one model score',
  rawLedger.includes('secretissimo') ? 'learning ledger leaked secret material' : '',
  rawLedger.includes('.env') ? 'learning ledger leaked sensitive file target' : '',
].filter(Boolean);
if (learningFailures.length > 0) {
  failed.push({
    id: 'learning-ledger',
    status: 'failed',
    failures: learningFailures,
    observed: {
      taskKind: 'unknown',
      riskLevel: 0,
      recommendedMode: 'direct_answer',
      riskGate: 'block',
      capabilityBuilder: 'not_needed',
      liveActionApplied: false,
    },
  });
}
const report = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    scenarios: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
  },
  learning: {
    scoreboard,
    rawSecretsSerialized: false,
    liveActionApplied: false,
  },
  results,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[intelligence-fabric] running dynamic gate');
  for (const result of results) {
    console.log(`[intelligence-fabric] ${result.status === 'passed' ? 'ok' : 'fail'} ${result.id}: ${result.observed.taskKind} risk=${result.observed.riskLevel} gate=${result.observed.riskGate}`);
    for (const failure of result.failures) {
      console.log(`  - ${failure}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}
fs.rmSync(learningDir, { recursive: true, force: true });

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
      sourceService: 'gate',
      sourceId: 'channel:slack',
      externalRuntimeDependency: false,
      canonicalRootOnly: true,
    },
    searchText: 'slack channel',
  };
}
