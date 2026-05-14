import {
  AgentRunService,
  UNIVERSAL_INTENT_TRUST_ENFORCEMENT_CONTRACT_VERSION,
  UniversalIntentTrustEnforcementService,
} from '../../../src/runtime/agent/index.js';

describe('UniversalIntentTrustEnforcementService Wave 44', () => {
  it('consolidates Universal Intent, permission narrative and Trust Slider without executing tools', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:44:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-uni-trust',
      text: 'aplique um patch em src/app.ts',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['write_file'],
      metadata: {
        trustMode: 'collaborator',
        workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
        targetPath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\app.ts',
      },
    });

    const snapshot = new UniversalIntentTrustEnforcementService({
      now: () => new Date('2026-05-04T00:44:00.000Z'),
    }).buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: UNIVERSAL_INTENT_TRUST_ENFORCEMENT_CONTRACT_VERSION,
      source: 'UniversalIntentTrustEnforcementService',
      status: 'requires-permission',
      summary: expect.objectContaining({
        intent: 'workspace_mutation',
        risk: 'attention',
        trustLevel: 'collaborator',
        trustDecision: 'requires_permission',
        requiresPermission: true,
        previewRequired: true,
        blocked: false,
      }),
      permission: expect.objectContaining({
        required: true,
        kind: 'workspace_mutation',
        previewRequired: true,
        approvalRequired: true,
      }),
      policy: expect.objectContaining({
        universalIntentIsSourceOfTruth: true,
        trustSliderEnforcedBeforeExecutor: true,
        naturalLanguageDoesNotBypassPolicy: true,
        hostScopeRequiresOverlord: true,
        workspaceBoundaryEnforced: true,
        noToolExecutedBySnapshot: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.gates.some((gate) => gate.source === 'TrustSliderPolicyService')).toBe(true);
    expect(snapshot.receipts.some((receipt) => receipt.kind === 'permission')).toBe(true);
  });

  it('blocks protected host scope through the same UNI / Trust snapshot', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:44:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-uni-trust-block',
      text: 'rode comando no host inteiro',
      requestedTools: ['shell.exec'],
      metadata: {
        trustMode: 'protected',
        hostScopeRequested: true,
      },
    });

    const snapshot = new UniversalIntentTrustEnforcementService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      status: 'blocked',
      summary: expect.objectContaining({
        trustLevel: 'protected',
        trustDecision: 'block',
        blocked: true,
      }),
      trustSlider: expect.objectContaining({
        blocked: true,
        permissionBoundary: 'container-first',
      }),
    }));
    expect(snapshot.nextSafeAction).toContain('protected');
  });
});
