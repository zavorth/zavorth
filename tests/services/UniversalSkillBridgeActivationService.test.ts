import { UniversalSkillBridgeActivationService } from '../../src/services/UniversalSkillBridgeActivationService.js';

function buildRegistrySnapshot(overrides: Record<string, any> = {}) {
  const selected = overrides.selected === undefined
    ? {
        id: 'skill:research-pack',
        skillName: 'research-pack',
        description: 'Research local documents.',
        status: 'approval-required',
        imported: true,
        runtimeEligible: true,
        dryRunReady: true,
        liveRequiresApproval: true,
        sourceId: 'workspace-imported-library',
        sourceLabel: 'Workspace imported skill library',
        sourceTrust: 'review',
        license: 'MIT',
        riskLevel: 'low',
        reviewRequired: true,
        blockers: [],
        actions: [
          {
            id: 'bridge-dry-run:research-pack',
            kind: 'dry-run',
            label: 'Dry-run pelo bridge',
            command: 'npm run zavorth:universal-skill-bridge -- --skill "research-pack"',
            apiPath: '/api/skills/bridge?id=research-pack&invoke=1',
            requiresApproval: false,
            safeDefault: true,
            reason: 'Dry-run.',
          },
        ],
        catalogEntry: {},
      }
    : overrides.selected;
  return {
    generatedAt: '2026-05-10T17:00:00.000Z',
    contractVersion: '2026-05-10.checkpoint-4',
    query: 'research-pack',
    selectedId: selected?.skillName || null,
    mode: overrides.mode || 'dry-run',
    channel: overrides.channel || 'telegram',
    summary: {
      total: 1,
      imported: 1,
      localOnly: 0,
      ready: 0,
      approvalRequired: 1,
      blocked: 0,
      visible: 1,
      actions: 1,
      invocationPrepared: Boolean(overrides.invocation?.promptEnvelope),
    },
    entries: selected ? [selected] : [],
    selected,
    invocation: overrides.invocation ?? null,
    actions: selected?.actions || [],
    narrative: {
      headline: 'Universal Skill Bridge Registry',
      operatorSummary: '1/1 skill(s) visiveis, 0 pronta(s), 1 exigem approval live e 0 bloqueada(s).',
      nextAction: '/skills run research-pack',
    },
    policy: {
      registryDoesNotExecuteSkills: true,
      bridgeRuntimeIsAuthority: true,
      importedSkillsOnlyByDefault: true,
      dryRunSafeDefault: true,
      liveRequiresOwnerApproval: true,
      catalogActionsUseBridgeOnly: true,
    },
    commands: {
      inspect: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name>',
      invokeDryRun: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name> --invoke',
      invokeLive: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name> --invoke --live --approval-id <approval-id>',
      check: 'npm run zavorth:universal-skill-bridge-registry:check --silent',
      nextStage: 'Credential vault - Activation UX and Channel Command Packs',
    },
    ...overrides,
  };
}

describe('UniversalSkillBridgeActivationService Credential vault', () => {
  it('turns /skills bridge into a registry inspection without invoking the bridge', async () => {
    const buildSnapshot = jest.fn(async () => buildRegistrySnapshot());
    const service = new UniversalSkillBridgeActivationService({
      now: () => new Date('2026-05-10T17:00:00.000Z'),
      registryService: {
        buildSnapshot,
        renderReport: jest.fn(() => 'Registry report'),
      },
    });

    const snapshot = await service.executeCommand({
      args: 'bridge research-pack',
      channel: 'telegram',
      actorId: 'user-1',
    });

    expect(buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      selectedId: 'research-pack',
      invoke: false,
      channel: 'telegram',
    }));
    expect(snapshot.status).toBe('ready');
    expect(snapshot.policy.activationUsesRegistryAndBridgeOnly).toBe(true);
    expect(snapshot.report).toContain('/skills run <skill>');
  });

  it('turns /skills run into a dry-run bridge invocation with receipts enabled', async () => {
    const buildSnapshot = jest.fn(async () => buildRegistrySnapshot({
      invocation: {
        status: 'dry-run',
        promptEnvelope: { text: '<untrusted_skill_content>safe</untrusted_skill_content>' },
        receipts: [{ id: 'receipt-1' }],
        summary: { executionPerformed: false },
      },
    }));
    const service = new UniversalSkillBridgeActivationService({
      registryService: {
        buildSnapshot,
        renderReport: jest.fn(() => 'Registry report'),
      },
    });

    const snapshot = await service.executeCommand({ args: 'run research-pack', channel: 'discord' });

    expect(buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      selectedId: 'research-pack',
      invoke: true,
      mode: 'dry-run',
      persistReceipt: true,
    }));
    expect(snapshot.status).toBe('dry-run');
    expect(snapshot.surfaceActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: '/skills live research-pack --approval-id <approval-id>' }),
    ]));
    expect(snapshot.report).toContain('Bridge: dry-run');
  });

  it('keeps live activation behind owner approval', async () => {
    const buildSnapshot = jest.fn(async () => buildRegistrySnapshot({
      mode: 'live',
      invocation: {
        status: 'approval-required',
        promptEnvelope: null,
        receipts: [{ id: 'approval-receipt' }],
        summary: { executionPerformed: false },
      },
    }));
    const service = new UniversalSkillBridgeActivationService({
      registryService: {
        buildSnapshot,
        renderReport: jest.fn(() => 'Registry report'),
      },
    });

    const snapshot = await service.executeCommand({ args: 'live research-pack', channel: 'whatsapp' });

    expect(buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      invoke: true,
      mode: 'live',
      ownerApprovalId: null,
    }));
    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.report).toContain('Upstream execution: not performed.');
  });
});
