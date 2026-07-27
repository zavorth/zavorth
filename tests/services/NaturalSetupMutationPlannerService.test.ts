import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthMutationPlaneService } from '../../src/services/ZavorthMutationPlaneService.js';
import { NaturalSetupMutationPlannerService } from '../../src/services/NaturalSetupMutationPlannerService.js';

function naturalSetupSnapshot(overrides: Record<string, any> = {}) {
  return {
    selectedChannelId: 'slack',
    summary: {
      missingEnvKeys: 0,
      selectedReady: false,
    },
    turn: {
      mode: 'native',
    },
    planPreview: {
      resourceImpact: {
        ramMb: 28,
        diskMb: 8,
        processCount: 0,
        externalExposure: 'none',
        recurring: false,
        notes: ['Preview sem mutaction.'],
      },
      manualFallback: ['Preencher .env manualmente.'],
      capability: {
        capabilityId: 'slack',
        state: 'dormant',
      },
    },
    ...overrides,
  };
}

describe('NaturalSetupMutationPlannerService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createMutationPlane() {
    const plansDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-natural-setup-plan-'));
    tempDirs.push(plansDir);
    return new ZavorthMutationPlaneService({
      plansDir,
      now: () => new Date('2026-04-13T12:00:00.000Z'),
    });
  }

  it('creates a preview-first NaturalSetupPlan with redacted intent, capability and trust metadata', async () => {
    const mutationPlane = createMutationPlane();
    const trustDecisionService = {
      evaluate: jest.fn(async () => ({
        generatedAt: '2026-04-13T12:00:01.000Z',
        decision: 'requires_approval',
        ok: false,
        reason: 'Natural Setup exige approval.',
        permission: {
          permission_id: 'perm-natural-1',
          status: 'pending',
        },
        profile: 'core',
        capabilityId: 'slack',
        recommendedScope: 'once',
      })),
    };
    const planner = new NaturalSetupMutationPlannerService({
      controlPlaneService: {
        buildSnapshot: jest.fn(async () => naturalSetupSnapshot()),
      },
      mutationPlaneService: mutationPlane,
      trustDecisionService: trustDecisionService as any,
    });

    const preview = await planner.preview({
      intentText: 'Configure Slack native com SLACK_BOT_TOKEN=xoxb-secret e SLACK_SIGNING_SECRET=shh-secret.',
      apply: true,
      doctor: true,
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });

    expect(preview.mutationPlan.domain).toBe('setup');
    expect(preview.mutationPlan.actionId).toBe('natural-setup');
    expect(preview.mutationPlan.status).toBe('waiting_approval');
    expect(preview.mutationPlan.approval.permissionId).toBe('perm-natural-1');
    expect(preview.mutationPlan.payload.channelId).toBe('slack');
    expect(preview.mutationPlan.payload.capabilityId).toBe('slack');
    expect(preview.mutationPlan.payload.intentText).toContain('SLACK_BOT_TOKEN=***');
    expect(JSON.stringify(preview.mutationPlan)).not.toContain('xoxb-secret');
    expect(JSON.stringify(preview.mutationPlan)).not.toContain('shh-secret');
    expect(preview.mutationPlan.readinessGates[0]).toEqual(expect.objectContaining({
      scope: 'preview',
      canProceed: true,
    }));
    expect(trustDecisionService.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'setup',
      actionId: 'natural-setup',
      capabilityId: 'slack',
      approvalRequired: true,
      sourceSurface: 'cli',
    }));
  });

  it('keeps blocked trust decisions from applying any channel mutation', async () => {
    const mutationPlane = createMutationPlane();
    const channelSetupAssistant = {
      apply: jest.fn(),
      runDoctor: jest.fn(),
    };
    const planner = new NaturalSetupMutationPlannerService({
      controlPlaneService: {
        buildSnapshot: jest.fn(async () => naturalSetupSnapshot()),
      },
      mutationPlaneService: mutationPlane,
      trustDecisionService: {
        evaluate: jest.fn(async () => ({
          generatedAt: '2026-04-13T12:00:01.000Z',
          decision: 'blocked',
          ok: false,
          reason: 'Capability bloqueada pelo Trust Plane.',
          permission: null,
          profile: 'core',
          capabilityId: 'slack',
          recommendedScope: 'once',
        })),
      } as any,
      channelSetupAssistant: channelSetupAssistant as any,
    });

    const preview = await planner.preview({
      intentText: 'Configure Slack.',
      apply: true,
      requestedBy: 'tester',
    });
    const applied = await planner.apply({
      planId: preview.mutationPlan.id,
      requestedBy: 'tester',
    });

    expect(preview.mutationPlan.status).toBe('blocked');
    expect(applied.ok).toBe(false);
    expect(applied.status).toBe('blocked');
    expect(channelSetupAssistant.apply).not.toHaveBeenCalled();
    expect(channelSetupAssistant.runDoctor).not.toHaveBeenCalled();
  });
});
