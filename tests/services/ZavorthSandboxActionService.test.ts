import { ZavorthSandboxActionService } from '../../src/services/ZavorthSandboxActionService';
import { ZavorthSandboxControlPlaneService } from '../../src/services/ZavorthSandboxControlPlaneService';

const dockerMissing = {
  enabled: true,
  language: 'javascript',
  image: 'node:22-bullseye',
  dockerReachable: false,
  daemonReachable: false,
  imagePresent: false,
  autoPullEnabled: false,
  sandboxRuntime: 'runc',
  canRun: false,
  detail: 'Docker CLI nao encontrado.',
};

const firecrackerDisabled = {
  enabled: false,
  transport: 'wsl',
  firecrackerReachable: false,
  kvmAvailable: false,
  kernelPresent: false,
  rootfsPresent: false,
  canRun: false,
  detail: 'Firecracker desabilitado.',
};

const wasmDisabled = {
  enabled: false,
  available: true,
  canRun: false,
  detail: 'Wasm desabilitado.',
  runtime: 'node-webassembly',
  supportedLanguages: ['wasm'],
  recommendedAction: 'npm run sandbox:wasm:smoke',
};

function buildMutationPlaneMock() {
  let plan: any = null;
  return {
    createPlan: jest.fn((input: any) => {
      plan = {
        id: 'sandbox-plan-1',
        domain: input.domain,
        actionId: input.actionId,
        status: input.approvalRequired ? 'waiting_approval' : 'draft',
        approval: {
          required: input.approvalRequired,
          status: input.approvalRequired ? 'pending' : 'not_required',
          permissionId: null,
          defaultScope: 'once',
          availableScopes: ['once', 'session', 'host'],
          requestedBy: input.requestedBy || null,
          reason: input.approvalReason || '',
        },
        resourceImpact: input.resourceImpact,
        readinessGates: input.readinessGates,
        payload: input.payload,
        riskLevel: input.riskLevel,
      };
      return plan;
    }),
    readPlan: jest.fn(() => plan),
    attachApproval: jest.fn((_planId: string, approval: any) => {
      plan = {
        ...plan,
        approval: {
          ...plan.approval,
          permissionId: approval.permissionId,
          status: approval.status,
          reason: approval.reason,
        },
      };
      return plan;
    }),
    approvePlan: jest.fn(() => ({ ...plan, status: 'approved', approval: { ...plan.approval, status: 'approved' } })),
    markApplied: jest.fn(() => ({ ...plan, status: 'applied' })),
    markBlocked: jest.fn((_planId: string, reason: string) => {
      plan = {
        ...plan,
        status: 'blocked',
        audit: [{ event: 'plan.blocked', message: reason }],
      };
      return plan;
    }),
  };
}

describe('ZavorthSandboxActionService', () => {
  it('creates mutation/trust preview for dangerous code without persisting raw executable', async () => {
    const controlPlane = new ZavorthSandboxControlPlaneService({
      dockerRuntime: { getStatus: jest.fn(() => dockerMissing) } as any,
      firecrackerRuntime: { getStatus: jest.fn(() => firecrackerDisabled) } as any,
      wasmCapabilityService: { getStatus: jest.fn(() => wasmDisabled) } as any,
      env: {},
      platform: 'win32',
    });
    const mutationPlane = buildMutationPlaneMock();
    const trustDecision = {
      evaluate: jest.fn(async () => ({
        generatedAt: '2026-04-18T10:00:00.000Z',
        decision: 'requires_approval',
        ok: false,
        reason: 'Sandbox forte exige approval.',
        permission: { permission_id: 'perm-sandbox-1', status: 'pending' },
        profile: 'ops',
        capabilityId: 'sandbox-execution',
        recommendedScope: 'once',
      })),
    };
    const service = new ZavorthSandboxActionService({
      controlPlaneService: controlPlane,
      mutationPlaneService: mutationPlane as any,
      trustDecisionService: trustDecision as any,
      now: () => new Date('2026-04-18T10:00:00.000Z'),
    });

    const execution = await service.preview({
      code: "const secret = 'super-secret'; require('fs').writeFileSync('C:/tmp/escape.txt', secret);",
      language: 'javascript',
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });

    expect(execution.status).toBe('blocked');
    expect(execution.ok).toBe(false);
    expect(execution.mutationPlan?.status).toBe('blocked');
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'sandbox',
      actionId: 'execute-untrusted',
      payload: expect.objectContaining({
        envelope: expect.objectContaining({
          sandboxProfile: 'firecracker',
          riskLevel: 'high',
        }),
        executableRef: expect.stringMatching(/^sha256:/),
        redaction: expect.objectContaining({
          rawExecutablePersisted: false,
        }),
      }),
      validationPlan: expect.arrayContaining([
        expect.stringContaining('executeEnvelope'),
      ]),
    }));
    const payloadText = JSON.stringify(mutationPlane.createPlan.mock.calls[0][0].payload);
    expect(payloadText).not.toContain('super-secret');
    expect(trustDecision.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'sandbox',
      actionId: 'execute-untrusted',
      capabilityId: 'sandbox-execution',
      approvalRequired: true,
    }));
  });

  it('keeps low-risk dynamic code in dry-run when no strong sandbox is ready', async () => {
    const controlPlane = new ZavorthSandboxControlPlaneService({
      dockerRuntime: { getStatus: jest.fn(() => dockerMissing) } as any,
      firecrackerRuntime: { getStatus: jest.fn(() => firecrackerDisabled) } as any,
      wasmCapabilityService: { getStatus: jest.fn(() => wasmDisabled) } as any,
      env: {},
      platform: 'win32',
    });
    const mutationPlane = buildMutationPlaneMock();
    const trustDecision = {
      evaluate: jest.fn(async () => ({
        generatedAt: '2026-04-18T10:00:00.000Z',
        decision: 'allowed',
        ok: true,
        reason: 'Baixo risco liberado.',
        permission: null,
        profile: 'core',
        capabilityId: 'sandbox-execution',
        recommendedScope: 'once',
      })),
    };
    const service = new ZavorthSandboxActionService({
      controlPlaneService: controlPlane,
      mutationPlaneService: mutationPlane as any,
      trustDecisionService: trustDecision as any,
    });

    const execution = await service.preview({
      code: 'console.log("ok")',
      language: 'javascript',
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });

    expect(execution.status).toBe('blocked');
    expect(execution.ok).toBe(false);
    expect(execution.envelope?.sandboxProfile).toBe('container');
    expect(execution.mutationPlan?.status).toBe('blocked');
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      readinessGates: expect.arrayContaining([
        expect.objectContaining({
          id: 'sandbox-runtime-readiness',
          status: 'blocked',
          canProceed: false,
        }),
      ]),
    }));
    expect(trustDecision.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      approvalRequired: true,
      riskLevel: 'medium',
    }));
  });
});
