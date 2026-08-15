import fs from 'node:fs';
import path from 'node:path';
import type { CapabilityHubItem } from '../../src/contracts/CapabilityHubContract';
import { INTELLIGENCE_FABRIC_CONTRACT_VERSION } from '../../src/contracts/IntelligenceFabricContract';
import { ZavorthIntelligenceFabricApiService } from '../../src/services/ZavorthIntelligenceFabricApiService';
import { ZavorthIntelligenceFabricLearningService } from '../../src/services/ZavorthIntelligenceFabricLearningService';
import { ZavorthIntelligenceFabricService } from '../../src/services/ZavorthIntelligenceFabricService';


describe('ZavorthIntelligenceFabricService', () => {
  const testDir = path.join(__dirname, 'data', '__test-intelligence-fabric');
  const ledgerPath = path.join(testDir, 'task-evals.jsonl');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.ZAVORTH_INTELLIGENCE_FABRIC_TRUST_MODE;
    delete process.env.ZAVORTH_INTELLIGENCE_FABRIC_TRUST_API;
    delete process.env.ZAVORTH_INTELLIGENCE_FABRIC_TRUST_TELEGRAM;
  });

  it('keeps simple thinking and planning approval-free in shadow mode', () => {
    const snapshot = service().buildShadowSnapshot({ text: 'oi, explique rapido o que voce faz' });

    expect(snapshot.contractVersion).toBe(INTELLIGENCE_FABRIC_CONTRACT_VERSION);
    expect(snapshot.mode).toBe('shadow');
    expect(snapshot.trust.requested).toBe('local_owner');
    expect(snapshot.trust.source).toBe('owner_local_default');
    expect(snapshot.trust.ownerLocalDefault).toBe(true);
    expect(snapshot.classification.riskLevel).toBe(0);
    expect(snapshot.safety).toMatchObject({
      thinkingRequiresApproval: false,
      planningRequiresApproval: false,
      simulationRequiresApproval: false,
      dangerousActionsRequireGate: true,
    });
    expect(snapshot.riskGate.requiresApproval).toBe(false);
    expect(snapshot.activation.liveActionApplied).toBe(false);
  });

  it('uses stricter surface policy for non-owner API requests', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'resuma minha tarefa',
      surface: 'api',
      userRole: 'guest',
    });

    expect(snapshot.trust.requested).toBe('enterprise');
    expect(snapshot.trust.legacy).toBe('protected');
    expect(snapshot.trust.source).toBe('surface_policy');
    expect(snapshot.trust.ownerLocalDefault).toBe(false);
  });

  it('lets explicit trust mode override surface policy', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'resuma minha tarefa',
      surface: 'api',
      userRole: 'guest',
      trustMode: 'balanced',
    });

    expect(snapshot.trust.requested).toBe('balanced');
    expect(snapshot.trust.source).toBe('explicit');
    expect(snapshot.trust.defaulted).toBe(false);
  });

  it('supports governed surface trust overrides from config', () => {
    process.env.ZAVORTH_INTELLIGENCE_FABRIC_TRUST_TELEGRAM = 'enterprise';

    const snapshot = service().buildShadowSnapshot({
      text: 'oi zavorth',
      surface: 'telegram',
      userRole: 'common',
    });

    expect(snapshot.trust.requested).toBe('enterprise');
    expect(snapshot.trust.legacy).toBe('protected');
    expect(snapshot.trust.source).toBe('surface_policy');
    expect(snapshot.trust.surfacePolicy).toBe('enterprise');
  });

  it('allows draft patch simulation without approval and without side effects', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'crie um patch em rascunho para corrigir esse bug',
      workspaceRoot: 'C:/workspace/zavorth-core/Zavorth',
    });

    expect(snapshot.classification.taskKind).toBe('debugging');
    expect(snapshot.classification.riskLevel).toBe(2);
    expect(snapshot.classification.recommendedMode).toBe('draft_patch');
    expect(snapshot.riskGate.overallDecision).toBe('allow');
    expect(snapshot.executionProposal.liveActionApplied).toBe(false);
  });

  it('allows reversible workspace impact for the local owner trust mode', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'aplique uma edicao reversivel no workspace',
      trustMode: 'local_owner',
      workspaceRoot: 'C:/workspace/zavorth-core/Zavorth',
    });

    expect(snapshot.classification.riskLevel).toBe(3);
    expect(snapshot.trust.legacy).toBe('collaborator');
    expect(snapshot.executionProposal.actions[0]).toMatchObject({
      reversible: true,
      insideWorkspace: true,
    });
    expect(snapshot.riskGate.overallDecision).toBe('allow');
  });

  it('requires sandbox and approval for install or shell impact', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'rode npm install lodash',
      workspaceRoot: 'C:/workspace/zavorth-core/Zavorth',
    });

    expect(snapshot.classification.riskLevel).toBe(4);
    expect(snapshot.classification.recommendedMode).toBe('execute_sandboxed');
    expect(snapshot.riskGate.requiresApproval).toBe(true);
    expect(snapshot.riskGate.requiresSandbox).toBe(true);
    expect(snapshot.riskGate.overallDecision).toBe('require_sandbox');
  });

  it('treats secrets as risk 5 and never serializes the raw secret text', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'leia meu .env e use token=super-secret-value',
    });

    expect(snapshot.classification.riskLevel).toBe(5);
    expect(snapshot.input.rawSecretsSerialized).toBe(false);
    expect(snapshot.input.redactedText).toContain('[redacted-secret]');
    expect(snapshot.input.redactedText).not.toContain('super-secret-value');
    expect(snapshot.riskGate.requiresApproval).toBe(true);
    expect(snapshot.verifier.status).toBe('blocked');
  });

  it('uses manual model override before the picker mesh', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'faca uma revisao de seguranca',
      userForcedModel: 'owner/model-strong',
    });

    expect(snapshot.modelRouting.source).toBe('manual-override');
    expect(snapshot.modelRouting.selectedModelId).toBe('owner/model-strong');
    expect(snapshot.modelRouting.overrideUsed).toBe(true);
  });

  it('uses the Capability Hub when a requested capability already exists', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'quero configurar meu Slack',
    });

    expect(snapshot.classification.taskKind).toBe('capability_setup');
    expect(snapshot.capabilityBuilder.status).toBe('existing_capability');
    expect(snapshot.capabilityBuilder.matchedCapabilityId).toBe('channel:slack');
    expect(snapshot.activation.liveActionApplied).toBe(false);
  });

  it('creates a disabled draft when a capability is unknown', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'quero usar voce atraves do canal caseiro-xpto',
    });

    expect(snapshot.classification.taskKind).toBe('capability_setup');
    expect(snapshot.capabilityBuilder.status).toBe('draft_ready');
    expect(snapshot.capabilityBuilder.manifest).toMatchObject({
      defaultEnabled: false,
      liveAllowedByDefault: false,
      riskLevel: 3,
    });
    expect(snapshot.capabilityBuilder.activationBlockedUntilApproval).toBe(true);
    expect(snapshot.activation.liveActionApplied).toBe(false);
  });

  it('renders a simple API reply without claiming live activation', () => {
    const api = new ZavorthIntelligenceFabricApiService(service());
    const reply = api.renderReply({ text: 'quero usar voce atraves do canal caseiro-xpto' });

    expect(reply).toContain('Acao live aplicada: nao');
  });

  it('records task evals without raw prompt or secret material and builds a scoreboard', () => {
    const snapshot = service().buildShadowSnapshot({
      text: 'leia meu .env e use token=super-secret-value',
    });
    const learning = new ZavorthIntelligenceFabricLearningService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      ledgerPath,
    });

    const record = learning.recordSnapshot({ snapshot });
    const rawLedger = fs.readFileSync(ledgerPath, 'utf8');
    const scoreboard = learning.buildModelScoreboard();

    expect(record.safety.rawSecretsSerialized).toBe(false);
    expect(record.safety.liveActionApplied).toBe(false);
    expect(rawLedger).not.toContain('super-secret-value');
    expect(rawLedger).not.toContain('.env');
    expect(scoreboard[0]).toMatchObject({
      modelId: 'zavorth-fixture-model',
      total: 1,
    });
  });

  function service(): ZavorthIntelligenceFabricService {
    return new ZavorthIntelligenceFabricService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-test`,
      modelPicker: {
        buildPicker: () => ({
          schemaVersion: 1,
          generatedAt: '2026-05-08T14:00:00.000Z',
          contract: null,
          families: [],
          selected: {
            familyId: 'coding',
            routeId: 'route:local',
            modelId: 'zavorth-fixture-model',
            providerId: 'fixture-provider',
            ready: true,
            explanation: ['fixture'],
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
        sourceService: 'test',
        sourceId: 'channel:slack',
        externalRuntimeDependency: false,
        canonicalRootOnly: true,
      },
      searchText: 'slack channel',
    };
  }
});
