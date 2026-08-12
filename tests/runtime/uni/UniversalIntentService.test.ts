import { UniversalIntentService } from '../../../src/runtime/uni/index.js';

describe('UniversalIntentService', () => {
  const service = new UniversalIntentService({
    now: () => new Date('2026-05-02T12:00:00.000Z'),
  });

  it('keeps common conversation as a direct answer without permission', () => {
    const decision = service.decide({
      surface: 'cli',
      text: 'explique o runtime Zavorth em uma frase',
    });

    expect(decision).toMatchObject({
      schemaVersion: 1,
      generatedAt: '2026-05-02T12:00:00.000Z',
      intent: 'conversation',
      risk: 'safe',
      requiresClarification: false,
      requiresPermission: false,
      nextSafeAction: 'answer',
      trustPosture: {
        posture: 'direct-answer',
        approvalRequired: false,
        previewRequired: false,
      },
      trustSlider: {
        level: 'collaborator',
        decision: 'allow',
        sandboxTier: 'workspace-scoped',
      },
    });
    expect(decision.permissionRequest).toBeNull();
  });

  it('asks a natural clarification before assuming an ambiguous mutation target', () => {
    const decision = service.decide({
      surface: 'web',
      text: 'corrija isso',
    });

    expect(decision.intent).toBe('clarification');
    expect(decision.requiresClarification).toBe(true);
    expect(decision.requiresPermission).toBe(false);
    expect(decision.nextSafeAction).toBe('ask_clarification');
    expect(decision.clarification).toMatchObject({
      askBeforeAssumption: true,
      missing: ['target'],
    });
    expect(decision.clarification.question).toContain('exatamente');
    expect(decision.trustPosture.posture).toBe('clarify-first');
  });

  it('requires preview and permission for workspace mutation', () => {
    const decision = service.decide({
      surface: 'cli',
      text: 'aplique um patch em src/app.ts',
      contextHints: {
        workspacePath: 'C:/repo/Zavorth',
      },
    });

    expect(decision.intent).toBe('workspace_mutation');
    expect(decision.risk).toBe('attention');
    expect(decision.requiresClarification).toBe(false);
    expect(decision.requiresPermission).toBe(true);
    expect(decision.nextSafeAction).toBe('preview_then_request_permission');
    expect(decision.permissionRequest).toMatchObject({
      kind: 'workspace_mutation',
      risk: 'attention',
      previewRequired: true,
      approvalRequired: true,
      sideEffect: 'local_workspace',
      requestedTools: ['agent.runtime'],
    });
    expect(decision.trustPosture.posture).toBe('preview-first');
    expect(decision.trustSlider).toEqual(
      expect.objectContaining({
        level: 'collaborator',
        decision: 'requires_permission',
        permissionScope: 'once',
        sandboxTier: 'workspace-scoped',
      }),
    );
  });

  it('treats external messages as approval-required side effects', () => {
    const decision = service.decide({
      surface: 'telegram',
      text: 'envie o relatorio para o Slack',
      contextHints: {
        activeArtifactId: 'artifact-1',
      },
    });

    expect(decision.intent).toBe('external_side_effect');
    expect(decision.risk).toBe('danger');
    expect(decision.requiresPermission).toBe(true);
    expect(decision.permissionRequest).toMatchObject({
      kind: 'external_side_effect',
      sideEffect: 'external',
      previewRequired: true,
      approvalRequired: true,
    });
    expect(decision.trustPosture).toMatchObject({
      posture: 'approval-required',
      approvalRequired: true,
      rollbackExpected: false,
    });
  });

  it('classifies destructive command execution as a dangerous operation', () => {
    const decision = service.decide({
      surface: 'cli',
      text: 'rode git reset --hard',
      contextHints: {
        workspacePath: 'C:/repo/Zavorth',
      },
    });

    expect(decision.intent).toBe('command_execution');
    expect(decision.risk).toBe('danger');
    expect(decision.requiresPermission).toBe(true);
    expect(decision.permissionRequest).toMatchObject({
      kind: 'dangerous_operation',
      sideEffect: 'destructive',
      previewRequired: true,
      approvalRequired: true,
    });
    expect(decision.capabilityRequired).toEqual([]);
    expect(decision.trustPosture.posture).toBe('approval-required');
  });

  it('turns a common request to organize files into a plain permission narrative', () => {
    const decision = service.decide({
      surface: 'web',
      text: 'organize minha pasta Downloads',
      contextHints: {
        workspaceRoot: 'C:/Users/me/Downloads',
        targetPath: 'C:/Users/me/Downloads',
      },
    });

    expect(decision.intent).toBe('workspace_mutation');
    expect(decision.userAbstraction).toMatchObject({
      role: 'common',
      detailLevel: 'plain',
      hideImplementationJargon: true,
    });
    expect(decision.requiresPermission).toBe(true);
    expect(decision.permissionRequest).toMatchObject({
      kind: 'workspace_mutation',
      scope: 'once',
      requestedTools: ['agent.runtime'],
    });
    expect(decision.permissionNarrative.summary).toContain('permissao');
    expect(decision.permissionNarrative.where).toBe('C:/Users/me/Downloads');
  });

  it('asks before moving or deleting an ambiguous target', () => {
    const decision = service.decide({
      surface: 'telegram',
      text: 'apague isso e mova o resto',
    });

    expect(decision.intent).toBe('clarification');
    expect(decision.requiresClarification).toBe(true);
    expect(decision.nextSafeAction).toBe('ask_clarification');
    expect(decision.permissionRequest).toBeNull();
    expect(decision.permissionNarrative.permission).toContain('Nenhuma permissao');
  });

  it('treats technical build and test requests as governed command execution', () => {
    const decision = service.decide({
      surface: 'cli',
      text: 'rode npm run build e npm test',
      userRole: 'builder',
      contextHints: {
        workspaceRoot: 'C:/repo/Zavorth',
      },
    });

    expect(decision.intent).toBe('command_execution');
    expect(decision.userAbstraction.detailLevel).toBe('balanced');
    expect(decision.requiresPermission).toBe(true);
    expect(decision.permissionRequest).toMatchObject({
      kind: 'dangerous_operation',
      sideEffect: 'system',
      scopeBoundary: {
        workspaceRoot: 'C:/repo/Zavorth',
        hostAllowed: false,
      },
    });
    expect(decision.nextSafeAction).toBe('preview_then_request_permission');
  });

  it('keeps governed selfmod behind preview and requires kill switch for Overlord', () => {
    const collaborator = service.decide({
      surface: 'web',
      text: 'ative selfmod supervisionado',
      trustMode: 'collaborator',
      userRole: 'operator',
    });
    const blockedOverlord = service.decide({
      surface: 'web',
      text: 'ative selfmod supervisionado',
      trustMode: 'overlord',
      userRole: 'operator',
    });
    const allowed = service.decide({
      surface: 'web',
      text: 'ative selfmod supervisionado',
      trustMode: 'overlord',
      userRole: 'operator',
      killSwitchActive: true,
    });

    expect(collaborator.intent).toBe('operator_control');
    expect(collaborator.nextSafeAction).toBe('block');
    expect(collaborator.requiresPermission).toBe(false);
    expect(collaborator.trustSlider).toMatchObject({
      decision: 'block',
      blocked: true,
    });

    expect(blockedOverlord.nextSafeAction).toBe('block');
    expect(blockedOverlord.trustPosture.blockReason).toContain('kill switch');

    expect(allowed.nextSafeAction).toBe('preview_then_request_permission');
    expect(allowed.permissionRequest).toMatchObject({
      kind: 'operator_control',
    });
    expect(allowed.trustSlider).toEqual(
      expect.objectContaining({
        level: 'overlord',
        decision: 'requires_permission',
        auditTrailRequired: true,
        killSwitchRequired: true,
      }),
    );
  });

  it('blocks dangerous execution in protected mode', () => {
    const decision = service.decide({
      surface: 'cli',
      text: 'rode git reset --hard',
      trustMode: 'protected',
      contextHints: {
        workspaceRoot: 'C:/repo/Zavorth',
      },
    });

    expect(decision.intent).toBe('command_execution');
    expect(decision.nextSafeAction).toBe('block');
    expect(decision.requiresPermission).toBe(false);
    expect(decision.permissionRequest).toBeNull();
    expect(decision.trustPosture.blockReason).toContain('protected');
  });
});
