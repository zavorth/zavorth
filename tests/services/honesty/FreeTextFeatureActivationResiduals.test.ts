/**
 * Honesty: free-text chat must not activate product features via keyword/regex packs.
 * Explicit slash tokens, structured decision fields, and callback_data remain deterministic.
 * Matrix: docs/product/free-text-purity-matrix.md (Package C).
 */
import { UniversalApprovalIntentResolver } from '../../../src/runtime/agent/UniversalApprovalIntentResolver.js';
import { TelegramZavorthBridgeControlService } from '../../../src/gateways/channels/telegram/controllers/TelegramZavorthBridgeControlService.js';
import { SharedSurfacePresentationCommandPack } from '../../../src/domain/surface/presentation/shared-surface/SharedSurfacePresentationCommandPack.js';
import { SurfaceOperationalIntentService } from '../../../src/services/SurfaceOperationalIntentService.js';
import { UserExperienceIntentRouter } from '../../../src/services/UserExperienceIntentRouter.js';
import {
  equalPillarWeights,
  scoreLearnedKnowledgeIntent,
  LearnedKnowledgePlaneService,
} from '../../../src/services/learned-knowledge/index.js';
import {
  AGENT_TEAM_COMPILER_CONTRACT_VERSION,
  AgentRunService,
  AgentTeamCompilerService,
} from '../../../src/runtime/agent/index.js';

describe('Free-text → product feature residuals (agent-first honesty)', () => {
  it('does not approve from free-text phrases', () => {
    const resolver = new UniversalApprovalIntentResolver();
    const result = resolver.resolve({
      text: 'approved flag, continue flag, authorization flag',
      source: 'text',
      channel: 'telegram',
      userId: 'u1',
      sessionId: 's1',
      runs: [],
    });
    expect(result.status).toBe('not_approval_intent');
  });

  it('still resolves explicit slash approve tokens', () => {
    const resolver = new UniversalApprovalIntentResolver();
    const result = resolver.resolve({
      text: '/approve approval-xyz',
      decision: null,
      ref: null,
      source: 'slash-command',
      channel: 'telegram',
      userId: 'u1',
      sessionId: 's1',
      runs: [
        {
          id: 'run-1',
          traceId: 't',
          requestId: 'r',
          sessionId: 's1',
          userId: 'u1',
          channel: 'telegram',
          title: 'x',
          input: 'y',
          status: 'waiting_approval',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          summary: '',
          events: [],
          toolExposure: { mode: 'confirm', summary: '', tools: [] },
          replyPorts: [],
          modelProfile: { providerLabel: 't', modelLabel: 't', routingPolicy: 'direct' },
          approvals: [
            {
              id: 'approval-xyz',
              runId: 'run-1',
              title: 'ok',
              reason: 'r',
              risk: 'attention',
              status: 'pending',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          artifacts: [],
          memorySignals: [],
          metadata: {},
        },
      ],
    });
    expect(result.status).toBe('resolved');
    expect(result.decision).toBe('approved');
  });

  it('does not map free-text bridge phrases to control actions', () => {
    const service = new TelegramZavorthBridgeControlService({
      zavorthBridgeControlService: {
        open: jest.fn(),
        restart: jest.fn(),
        status: jest.fn(),
        setModel: jest.fn(),
      },
      zavorthBridgePreferenceStore: {
        getPreferredModel: jest.fn(),
        setPreferredModel: jest.fn(),
        forUser: jest.fn(),
      },
    });
    expect(service.parseControlCommand('abrir zavorth bridge')).toBeNull();
    expect(service.parseControlCommand('status do zavorthbridge')).toBeNull();
    expect(service.parseControlCommand('/ag_open')).toEqual({ action: 'open' });
  });

  it('keeps parseRuntimeMaintenanceIntent as a free-text no-op', () => {
    const pack = new SharedSurfacePresentationCommandPack({} as any);
    expect(pack.parseRuntimeMaintenanceIntent('se autorepare agora')).toBeNull();
    expect(pack.parseRuntimeMaintenanceIntent('recarregue o zavorth')).toBeNull();
  });

  it('does not keyword-route free-text inspection phrases into local-inspector', async () => {
    const service = new SurfaceOperationalIntentService({ semanticClassifier: null });
    const decision = await service.decideResponse({
      surface: 'web',
      text: 'list files from the downloads folder and analyze the images',
    });
    expect(decision.responsePath).not.toBe('local-inspector');
    expect(decision.mode).not.toBe('file-inspection');
  });

  it('UX router keeps free-text low-confidence answer (model-owned)', () => {
    const router = new UserExperienceIntentRouter();
    for (const text of [
      'resuma o estado atual e o link do PR',
      'compile uma equipe de agentes swarm',
      'se autorepare e recarregue o zavorth',
    ]) {
      const d = router.decide({ text });
      expect(d.kind).toBe('answer');
      expect(d.confidence).toBe('low');
      expect(d.explicitAction).toBe(false);
      expect(d.signals).toContain('free-text-model-owned');
    }
  });

  it('learned knowledge intent scorer never keyword-skews pillars', () => {
    const equal = equalPillarWeights();
    expect(scoreLearnedKnowledgeIntent('what did we discuss about providers-')).toEqual(equal);
    expect(scoreLearnedKnowledgeIntent('run the release checklist step by step')).toEqual(equal);
    expect(scoreLearnedKnowledgeIntent('I prefer short answers')).toEqual(equal);
    const pack = new LearnedKnowledgePlaneService().buildPack({
      userId: 'purity-user',
      userMessage: 'arbitrary free text with no special words',
      tokenBudget: 400,
    });
    expect(pack.safety.noKeywordIntentRouting).toBe(true);
    expect(pack.pillarsQueried.sort()).toEqual(['about-you', 'conversation', 'knowledge', 'workflows'].sort());
  });

  it('agent team compiler ignores free-text team phrases without structured metadata', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'purity',
      channel: 'cli',
      sessionId: 'session-purity-team',
      text: 'compile uma equipe de agentes swarm multi-agent team of subagents',
      requestedTools: ['workspace.read'],
    });
    const snapshot = new AgentTeamCompilerService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });
    expect(snapshot.contractVersion).toBe(AGENT_TEAM_COMPILER_CONTRACT_VERSION);
    expect(snapshot.status).toBe('not-needed');
    expect(snapshot.summary.requestedSwarm).toBe(false);
    expect(snapshot.summary.roleCount).toBe(0);
  });
});
