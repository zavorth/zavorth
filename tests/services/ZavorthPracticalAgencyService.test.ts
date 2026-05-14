import { ZavorthPracticalAgencyService } from '../../src/services/ZavorthPracticalAgencyService.js';
import { ConversationalAgencyPresenter } from '../../src/services/ConversationalAgencyPresenter.js';
import { ZavorthPolicyCompilerService } from '../../src/services/ZavorthPolicyCompilerService.js';
import { SkillMiningService } from '../../src/services/SkillMiningService.js';
import { ProjectConstitutionLoader } from '../../src/services/ProjectConstitutionLoader.js';

describe('ZavorthPracticalAgencyService', () => {
  it('keeps simple conversation natural and hides internal jargon', () => {
    const service = new ZavorthPracticalAgencyService({
      now: () => new Date('2026-05-08T16:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      text: 'oi, o que voce consegue fazer?',
      surface: 'web',
      userRole: 'owner',
    });

    expect(snapshot.conversation.detailsHiddenByDefault).toBe(true);
    expect(snapshot.conversation.commandCenterDetailsAvailable).toBe(true);
    expect(snapshot.conversation.body).not.toMatch(/Risk Gate|Mutation Plane|Capability Hub ticket/i);
    expect(snapshot.toolIntent.liveActionApplied).toBe(false);
    expect(snapshot.safety.thinkingBlocked).toBe(false);
  });

  it('turns unknown capability requests into disabled drafts and lab simulation', () => {
    const service = new ZavorthPracticalAgencyService({
      now: () => new Date('2026-05-08T16:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      text: 'zavorth quero usar voce atraves do canal radio caseiro',
      surface: 'web',
      userRole: 'owner',
      workspaceRoot: 'C:/repo',
    });

    expect(snapshot.capabilityBuilder.status).toBe('draft_ready');
    expect(snapshot.capabilityBuilder.activation).toEqual({
      defaultEnabled: false,
      liveAllowed: false,
      requiresOwnerApproval: true,
    });
    expect(snapshot.capabilityBuilder.scaffold?.filesWritten).toBe(false);
    expect(snapshot.capabilityLab.simulated).toBe(true);
    expect(snapshot.capabilityLab.activationAllowed).toBe(false);
    expect(snapshot.capabilityLab.status).toBe('passed');
  });

  it('routes dangerous operations to gated intent and red team findings', () => {
    const service = new ZavorthPracticalAgencyService({
      now: () => new Date('2026-05-08T16:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      text: 'rode npm install e depois leia meu .env',
      surface: 'web',
      userRole: 'owner',
      workspaceRoot: 'C:/repo',
    });

    expect(snapshot.fabric.riskLevel).toBe(5);
    expect(snapshot.toolIntent.nextStep).toBe('block');
    expect(snapshot.toolIntent.blockedToolIntents.length).toBeGreaterThan(0);
    expect(snapshot.redTeam.status).toBe('blocked');
    expect(snapshot.redTeam.blocksUnsafeImpact).toBe(true);
  });

  it('learns operator preferences without serializing secrets', () => {
    const service = new ZavorthPracticalAgencyService({
      now: () => new Date('2026-05-08T16:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      text: 'prefiro AI-first, em portugues, sem jargao e com proposta antes de aplicar',
      surface: 'cli',
      userRole: 'owner',
    });

    expect(snapshot.operationalPreferences.rawSecretsSerialized).toBe(false);
    expect(snapshot.operationalPreferences.preferences).toEqual(expect.objectContaining({
      aiFirst: true,
      hideInternalJargon: true,
      portugueseReplies: true,
      proposalBeforeImpact: true,
    }));
  });

  it('compiles local policy while preserving hard blocks', () => {
    const compiler = new ZavorthPolicyCompilerService();
    const snapshot = compiler.compile({
      source: [
        'rules:',
        '  - id: shell_requires_approval',
        '    action: exec',
        '    target: *',
        '    decision: require_approval',
      ].join('\n'),
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.hardBlocksPreserved).toBe(true);
    expect(snapshot.rules).toEqual([
      expect.objectContaining({
        id: 'shell_requires_approval',
        action: 'exec',
        decision: 'require_approval',
      }),
    ]);
  });

  it('redacts secrets from policy, constitution and mined skill suggestions', () => {
    const compiler = new ZavorthPolicyCompilerService();
    const policy = compiler.compile({
      source: {
        rules: [
          {
            id: 'secret_rule',
            action: 'read',
            target: 'token=sk-super-secret-value',
            decision: 'deny',
          },
        ],
      },
    });
    expect(JSON.stringify(policy)).not.toContain('sk-super-secret-value');
    expect(JSON.stringify(policy)).toContain('[redacted-secret]');

    const constitution = new ProjectConstitutionLoader().load({
      content: '## Preferencias\n- Sempre responder em portugues com token=sk-constitution-secret-value',
    });
    expect(JSON.stringify(constitution)).not.toContain('sk-constitution-secret-value');
    expect(JSON.stringify(constitution)).toContain('[redacted-secret]');

    const mining = new SkillMiningService().mine({
      candidates: [
        {
          id: 'candidate secret/id',
          platformEntryId: 'entry',
          title: 'Fluxo com token=sk-title-secret-value',
          kind: 'skill',
          summary: 'Resumo ghp_secretValueShouldDisappear',
          score: 0.95,
          reviewState: 'pending',
          lifecycle: 'learned_draft',
          createdAt: '2026-05-08T16:00:00.000Z',
          updatedAt: '2026-05-08T16:00:00.000Z',
          lastValidatedAt: '2026-05-08T16:00:00.000Z',
          source: {
            workflowRunId: 'workflow',
            workflow: 'workflow',
            workspace: 'workspace',
            objective: 'objective',
            artifactCount: 0,
            completedStages: 1,
            totalStages: 1,
            originTaskId: null,
            sourceSurface: null,
          },
          steps: [],
          details: [],
        },
      ],
    });
    expect(JSON.stringify(mining)).not.toContain('sk-title-secret-value');
    expect(JSON.stringify(mining)).not.toContain('ghp_secretValueShouldDisappear');
    expect(mining.suggestions[0]?.id).toBe('skill-mining.candidate-secret-id');
  });
});

describe('ConversationalAgencyPresenter', () => {
  it('humanizes known internal terms', () => {
    const presenter = new ConversationalAgencyPresenter();
    expect(presenter.humanize('Risk 3 via Mutation Plane; approval required.')).toContain('previa de alteracao');
    expect(presenter.humanize('Risk 3 via Mutation Plane; approval required.')).toContain('rascunho reversivel');
    expect(presenter.humanize('Risk 3 via Mutation Plane; approval required.')).toContain('preciso da sua confirmacao');
  });
});
