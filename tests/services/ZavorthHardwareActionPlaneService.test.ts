import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthHardwareActionPlaneService } from '@zavorth/hardware/ZavorthHardwareActionPlaneService.js';

function mutationPlaneMock() {
  const plans: any[] = [];
  return {
    plans,
    createPlan: jest.fn((input: any) => {
      const plan = {
        id: `hardware-plan-${plans.length + 1}`,
        domain: input.domain,
        actionId: input.actionId,
        title: input.title,
        summary: input.summary,
        status: input.approvalRequired ? 'waiting_approval' : 'draft',
        riskLevel: input.riskLevel,
        approval: {
          required: input.approvalRequired,
          status: input.approvalRequired ? 'pending' : 'not_required',
          permissionId: null,
          reason: input.approvalReason,
          defaultScope: 'once',
          availableScopes: ['once', 'session', 'host'],
        },
        resourceImpact: input.resourceImpact,
        readinessGates: input.readinessGates,
        validationPlan: input.validationPlan,
        rollbackPlan: input.rollbackPlan,
        payload: input.payload,
      };
      plans.unshift(plan);
      return plan;
    }),
    listPlans: jest.fn(() => plans),
    readPlan: jest.fn((planId: string) => plans.find((entry) => entry.id === planId) || null),
    approvePlan: jest.fn((planId: string, approval: any) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) {
        throw new Error('missing plan');
      }
      plan.status = 'approved';
      plan.approval = {
        ...plan.approval,
        status: 'approved',
        approvedBy: approval.approvedBy,
      };
      return plan;
    }),
    attachApproval: jest.fn((planId: string, approval: any) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) {
        throw new Error('missing plan');
      }
      plan.approval = {
        ...plan.approval,
        permissionId: approval.permissionId,
        status: approval.status,
        reason: approval.reason,
      };
      return plan;
    }),
    markApplied: jest.fn((planId: string, summary: string, appliedActions: string[]) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) {
        throw new Error('missing plan');
      }
      plan.status = 'applied';
      plan.audit = [{ event: 'plan.applied', summary, appliedActions }];
      return plan;
    }),
    markBlocked: jest.fn((planId: string, reason: string) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) {
        throw new Error('missing plan');
      }
      plan.status = 'blocked';
      plan.audit = [{ event: 'plan.blocked', reason }];
      return plan;
    }),
  };
}

function buildService(root: string, overrides: Record<string, any> = {}) {
  const mutationPlane = overrides.mutationPlane || mutationPlaneMock();
  const trustDecision = overrides.trustDecision || {
    evaluate: jest.fn(async () => ({
      generatedAt: '2026-04-24T12:00:00.000Z',
      decision: 'requires_approval',
      ok: false,
      reason: 'Physical action requires canonical approval.',
      permission: { permission_id: 'perm-hardware-1', status: 'pending' },
      profile: 'ops',
      capabilityId: 'hardware.home-assistant',
      recommendedScope: 'once',
    })),
  };
  const policyLedger = overrides.policyLedger || {
    append: jest.fn((entry: any) => entry),
    summarize: jest.fn(() => ({ total: 0 })),
  };
  const service = new ZavorthHardwareActionPlaneService({
    now: () => new Date('2026-04-24T12:00:00.000Z'),
    workspaceRoot: root,
    stateFile: path.join(root, 'hardware.json'),
    env: overrides.env || {
      HOME_ASSISTANT_URL: 'http://homeassistant.local:8123',
      HOME_ASSISTANT_TOKEN: 'token-test',
    },
    mutationPlaneService: mutationPlane as any,
    trustDecisionService: trustDecision as any,
    policyLedgerService: policyLedger as any,
    providerAdapters: overrides.providerAdapters || {},
  });
  return { service, mutationPlane, trustDecision, policyLedger };
}

describe('ZavorthHardwareActionPlaneService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hardware-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists dormant/configured providers without starting heavy runtimes', async () => {
    const { service } = buildService(root);

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.heavyRuntimesStarted).toBe(false);
    expect(snapshot.summary.providers).toBeGreaterThanOrEqual(6);
    expect(snapshot.providers.find((entry) => entry.id === 'home-assistant')).toEqual(
      expect.objectContaining({
        configured: true,
        startsOnRead: false,
      }),
    );
    expect(snapshot.policy.actionFlow).toEqual(['preview', 'approval', 'apply', 'verify', 'audit']);
  });

  it('keeps non-allowlisted devices read-only and blocks physical mutation previews', async () => {
    const { service, mutationPlane } = buildService(root);
    service.registerDevice({
      id: 'light.sala',
      providerId: 'home-assistant',
      type: 'light',
      allowedActions: ['turn_on'],
      allowlisted: false,
    });

    const snapshot = await service.buildSnapshot();
    const planned = await service.planAction({
      deviceId: 'light.sala',
      action: 'turn_on',
      requestedBy: 'tester',
    });

    expect(snapshot.devices.find((entry) => entry.id === 'light.sala')).toEqual(
      expect.objectContaining({
        mutationMode: 'read_only',
        visibility: 'read-only',
      }),
    );
    expect(planned.status).toBe('blocked');
    expect(planned.blockers.join(' ')).toContain('not allowlisted');
    expect(mutationPlane.createPlan).not.toHaveBeenCalled();
  });

  it('creates hardware MutationPlans and links Trust Plane approvals for allowlisted actions', async () => {
    const { service, mutationPlane, trustDecision, policyLedger } = buildService(root);
    service.registerDevice({
      id: 'light.sala',
      label: 'Luz da sala',
      providerId: 'home-assistant',
      externalId: 'light.sala',
      type: 'light',
      location: 'sala',
      allowedActions: ['turn_on', 'turn_off'],
      allowlisted: true,
    });

    const planned = await service.planAction({
      deviceId: 'light.sala',
      action: 'turn_on',
      payload: { brightness: 70 },
      requestedBy: 'tester',
      sourceSurface: 'jest',
    });

    expect(planned.status).toBe('waiting_approval');
    expect(planned.mutationPlan).toEqual(expect.objectContaining({
      id: 'hardware-plan-1',
      domain: 'hardware',
      actionId: 'physical-device-action',
      status: 'waiting_approval',
      payload: expect.objectContaining({
        providerId: 'home-assistant',
        deviceId: 'light.sala',
        action: 'turn_on',
      }),
      approval: expect.objectContaining({
        permissionId: 'perm-hardware-1',
      }),
    }));
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'hardware',
      approvalRequired: true,
      readinessGates: expect.arrayContaining([
        expect.objectContaining({ id: 'hardware-device-allowlisted', canProceed: true }),
        expect.objectContaining({ id: 'hardware-emergency-stop', canProceed: true }),
      ]),
    }));
    expect(trustDecision.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'hardware',
      actionId: 'physical-device-action',
      capabilityId: 'hardware.home-assistant',
    }));
    expect(policyLedger.append).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'hardware',
      status: 'previewed',
      planId: 'hardware-plan-1',
    }));
  });

  it('applies approved plans through provider adapters and records verified audit', async () => {
    const execute = jest.fn(async () => ({
      ok: true,
      status: 'applied',
      summary: 'Provider recebeu comando.',
      data: { providerRunId: 'run-1' },
    }));
    const verify = jest.fn(async () => ({
      ok: true,
      status: 'verified',
      verified: true,
      summary: 'Estado fisico verificado.',
      data: { state: 'on' },
    }));
    const { service, mutationPlane } = buildService(root, {
      providerAdapters: {
        'home-assistant': { execute, verify },
      },
    });
    service.registerDevice({
      id: 'light.sala',
      providerId: 'home-assistant',
      externalId: 'light.sala',
      type: 'light',
      allowedActions: ['turn_on'],
      allowlisted: true,
    });
    const planned = await service.planAction({
      deviceId: 'light.sala',
      action: 'turn_on',
      requestedBy: 'tester',
    });
    await service.approvePlan({
      planId: planned.mutationPlan!.id,
      approvedBy: 'tester',
    });

    const applied = await service.applyPlan({
      planId: planned.mutationPlan!.id,
      requestedBy: 'tester',
    });

    expect(applied.status).toBe('verified');
    expect(applied.ok).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      action: 'turn_on',
      device: expect.objectContaining({ id: 'light.sala' }),
    }));
    expect(verify).toHaveBeenCalled();
    expect(mutationPlane.markApplied).toHaveBeenCalledWith('hardware-plan-1', 'Estado fisico verificado.', ['turn_on']);
    expect(applied.snapshot.audit[0]).toEqual(expect.objectContaining({
      event: 'hardware.action.applied',
      status: 'verified',
      planId: 'hardware-plan-1',
    }));
  });

  it('blocks actions under emergency stop and keeps an audit trail', async () => {
    const { service, mutationPlane } = buildService(root);
    service.registerDevice({
      id: 'switch.bancada',
      providerId: 'home-assistant',
      type: 'switch',
      allowedActions: ['turn_on'],
      allowlisted: true,
    });
    service.activateEmergencyStop({
      reason: 'electrical maintenance',
      requestedBy: 'tester',
    });

    const planned = await service.planAction({
      deviceId: 'switch.bancada',
      action: 'turn_on',
      requestedBy: 'tester',
    });
    const snapshot = await service.buildSnapshot();

    expect(planned.status).toBe('blocked');
    expect(planned.blockers.join(' ')).toContain('Emergency stop active');
    expect(snapshot.summary.emergencyStopActive).toBe(true);
    expect(snapshot.audit[0]).toEqual(expect.objectContaining({
      event: 'hardware.action.blocked',
      status: 'blocked',
    }));
    expect(snapshot.audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'hardware.emergency-stop.activated',
        status: 'emergency_stop',
      }),
    ]));
    expect(mutationPlane.createPlan).not.toHaveBeenCalled();
  });

  it('auto-pauses physical automations after repeated failures', async () => {
    const { service } = buildService(root);

    service.recordAutomationFailure({ automationId: 'deploy-light', deviceId: 'light.sala', reason: 'timeout' });
    service.recordAutomationFailure({ automationId: 'deploy-light', deviceId: 'light.sala', reason: 'timeout' });
    const guard = service.recordAutomationFailure({ automationId: 'deploy-light', deviceId: 'light.sala', reason: 'timeout' });
    const snapshot = await service.buildSnapshot();

    expect(guard).toEqual(expect.objectContaining({
      failures: 3,
      threshold: 3,
      autoPaused: true,
    }));
    expect(snapshot.summary.autoPausedAutomations).toBe(1);
    expect(snapshot.automationGuards[0]).toEqual(expect.objectContaining({
      automationId: 'deploy-light',
      autoPaused: true,
    }));
    expect(snapshot.audit[0]).toEqual(expect.objectContaining({
      event: 'hardware.automation.auto-paused',
      status: 'auto_paused',
    }));
  });
});
