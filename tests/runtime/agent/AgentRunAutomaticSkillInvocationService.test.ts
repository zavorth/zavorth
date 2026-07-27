import { AgentRunService } from '../../../src/runtime/agent/AgentRunService.js';
import { AgentRunAutomaticSkillInvocationService } from '../../../src/runtime/agent/AgentRunAutomaticSkillInvocationService.js';
import type { SkillMetadata } from '../../../src/skills/SkillLoader.js';

function skill(name: string): SkillMetadata {
  return {
    name,
    description: `${name} skill`,
    dirPath: `C:/skills/${name}`,
    skillFilePath: `C:/skills/${name}/SKILL.md`,
    supportFilePaths: [],
  };
}

describe('AgentRunAutomaticSkillInvocationService', () => {
  it('auto-selects a relevant native skill and prepares a governed bridge prompt', async () => {
    const skillBridge = {
      invoke: jest.fn(async () => ({
        status: 'ready',
        skillName: 'debugging',
        mode: 'dry-run',
        promptEnvelope: {
          text: 'Governed debugging skill prompt',
        },
        receipts: [
          { id: 'skill-receipt-1' },
        ],
        summary: {
          imported: false,
          approvalRequired: false,
          bridgePrepared: true,
        },
      })),
    };
    const service = new AgentRunAutomaticSkillInvocationService({
      now: () => new Date('2026-06-10T15:00:00.000Z'),
      skillLoader: {
        loadAll: jest.fn(() => [skill('debugging'), skill('system-design')]),
      },
      skillRouter: {
        routeSelection: jest.fn(async () => ({
          primarySkillName: 'debugging',
          supportSkillName: null,
        })),
      },
      skillBridge,
    });
    const runFactory = new AgentRunService({
      now: () => new Date('2026-06-10T15:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-auto-skill`,
    });
    const request = {
      userId: 'operator',
      channel: 'cli' as const,
      sessionId: 'session-auto-skill',
      text: 'tem um bug erro failure crash nesse fluxo',
      requestedTools: [],
    };
    const run = runFactory.createRun(request);

    const snapshot = await service.apply({ run, request });

    expect(snapshot).toMatchObject({
      status: 'selected',
      selectedSkillName: 'debugging',
      mode: 'dry-run',
      receiptIds: ['skill-receipt-1'],
    });
    expect(skillBridge.invoke).toHaveBeenCalledWith(expect.objectContaining({
      skillName: 'debugging',
      intent: request.text,
      mode: 'dry-run',
      channel: 'cli',
      sessionId: 'session-auto-skill',
      actorId: 'operator',
    }));
    expect(run.metadata.autoSkillInvocation).toMatchObject({
      status: 'selected',
      selectedSkillName: 'debugging',
      promptEnvelopeText: 'Governed debugging skill prompt',
      rawSecretsSerialized: false,
    });
    expect(run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'planning',
        title: 'Skill auto-selected',
        metadata: expect.objectContaining({
          selectedSkillName: 'debugging',
        }),
      }),
    ]));
  });

  it('marks auto-selected skills blocked when the governed bridge denies invocation', async () => {
    const service = new AgentRunAutomaticSkillInvocationService({
      now: () => new Date('2026-06-10T15:00:00.000Z'),
      skillLoader: {
        loadAll: jest.fn(() => [skill('write-file')]),
      },
      skillRouter: {
        routeSelection: jest.fn(async () => ({
          primarySkillName: 'write-file',
          supportSkillName: null,
        })),
      },
      skillBridge: {
        invoke: jest.fn(async () => ({
          status: 'approval-required',
          promptEnvelope: { text: 'should not be exposed' },
          receipts: [{ id: 'skill-blocked-receipt-1' }],
        })),
      },
    });
    const runFactory = new AgentRunService({
      now: () => new Date('2026-06-10T15:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-blocked-skill`,
    });
    const request = {
      userId: 'operator',
      channel: 'cli' as const,
      sessionId: 'session-blocked-skill',
      text: 'edite esse file',
      requestedTools: [],
    };
    const run = runFactory.createRun(request);

    const snapshot = await service.apply({ run, request });

    expect(snapshot).toMatchObject({
      status: 'blocked',
      selectedSkillName: 'write-file',
      bridgeStatus: 'approval-required',
      promptEnvelopeText: null,
      receiptIds: ['skill-blocked-receipt-1'],
    });
  });
});
