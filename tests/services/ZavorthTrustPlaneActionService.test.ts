import { ZavorthTrustPlaneActionService } from '../../src/services/ZavorthTrustPlaneActionService.js';

function buildSnapshot() {
  return {
    summary: {
      posture: 'attention',
      mcpProfile: 'safe',
      skillDefaultPolicy: 'deny',
      trustedPlugins: 1,
      installedPlugins: 2,
    },
  };
}

function buildLedgerMock() {
  let sequence = 0;
  return {
    append: jest.fn((entry: any) => ({
      id: `ledger-${++sequence}`,
      at: '2026-04-12T11:00:00.000Z',
      ...entry,
    })),
    list: jest.fn(() => []),
    summarize: jest.fn(() => ({
      total: 0,
      lastMutationAt: null,
      rollbackableEntries: 0,
      byStatus: { previewed: 0, applied: 0, blocked: 0, rolled_back: 0, noop: 0 },
      byDomain: {},
      recent: [],
    })),
  };
}

describe('ZavorthTrustPlaneActionService', () => {
  it('creates a diff preview and ledger entry before expanding the MCP profile', async () => {
    const mcpToolPolicyFileService = {
      readPolicy: jest.fn(() => ({
        version: 1,
        updatedAt: null,
        profile: 'safe',
        allowlist: [],
      })),
      savePolicy: jest.fn(),
      setProfile: jest.fn(() => ({
        version: 1,
        updatedAt: '2026-04-12T11:00:00.000Z',
        profile: 'trusted',
        allowlist: [],
      })),
      allowTool: jest.fn(),
      removeTool: jest.fn(),
    };
    const policyLedgerService = buildLedgerMock();
    const createPlan = jest.fn((input: any) => ({
      id: 'plan-trust-1',
      status: 'waiting_approval',
      approval: { permissionId: null, required: true, status: 'pending', defaultScope: 'once' },
      resourceImpact: { ramMb: 0, diskMb: 1, processCount: 0, externalExposure: 'none', recurring: false, notes: [] },
      riskLevel: input.riskLevel,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || null,
      payload: input.payload,
    }));
    const attachApproval = jest.fn((planId: string, approval: any) => ({
      id: planId,
      status: 'waiting_approval',
      approval: {
        permissionId: approval.permissionId,
        required: true,
        status: 'pending',
        defaultScope: 'once',
      },
      resourceImpact: { ramMb: 0, diskMb: 1, processCount: 0, externalExposure: 'none', recurring: false, notes: [] },
      riskLevel: 'high',
      payload: createPlan.mock.results[0].value.payload,
    }));
    const trustDecisionService = {
      evaluate: jest.fn(async () => ({
        generatedAt: '2026-04-12T11:00:00.000Z',
        decision: 'requires_approval',
        ok: false,
        reason: 'Action expands Trust Plane privileges and requires canonical approval.',
        permission: { permission_id: 'perm-trust-1', status: 'pending' },
        profile: 'core',
        capabilityId: null,
        recommendedScope: 'once',
      })),
    };
    const service = new ZavorthTrustPlaneActionService({
      mcpToolPolicyFileService: mcpToolPolicyFileService as any,
      skillTrustPolicyService: {
        readPolicy: jest.fn(() => ({
          version: 1,
          updatedAt: null,
          defaultPolicy: 'deny',
          allowedSourceIds: ['workspace-agents'],
          rules: [],
        })),
        savePolicy: jest.fn(),
        setDefaultPolicy: jest.fn(),
        setSourceRule: jest.fn(),
      } as any,
      trustPlaneService: { buildSnapshot: jest.fn(() => buildSnapshot()) } as any,
      mutationPlaneService: {
        createPlan,
        readPlan: jest.fn(),
        attachApproval,
        approvePlan: jest.fn(),
        markApplied: jest.fn(),
        markBlocked: jest.fn(),
      } as any,
      trustDecisionService: trustDecisionService as any,
      policyLedgerService: policyLedgerService as any,
    });

    const result = await service.execute({
      actionId: 'set-mcp-profile',
      profile: 'trusted',
      requestedBy: 'operator',
      sourceSurface: 'cli',
    });

    expect(mcpToolPolicyFileService.setProfile).not.toHaveBeenCalled();
    expect(result.status).toBe('waiting_approval');
    expect(result.mutationPlan?.id).toBe('plan-trust-1');
    expect(result.diffPreview?.entries[0]).toEqual(expect.objectContaining({
      path: 'mcp.profile',
      before: 'safe',
      after: 'trusted',
    }));
    expect(result.rollbackPlan).toEqual(expect.objectContaining({
      available: true,
      ledgerId: 'ledger-1',
    }));
    expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        diffPreview: expect.objectContaining({ domain: 'mcp' }),
        rollbackPayload: expect.objectContaining({ domain: 'mcp' }),
      }),
    }));
    expect(trustDecisionService.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      approvalScope: 'once',
      riskLevel: 'high',
    }));
    expect(policyLedgerService.append).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'mcp',
      status: 'previewed',
      planId: 'plan-trust-1',
      permissionId: 'perm-trust-1',
    }));
  });

  it('audits direct hardening of the default skill policy', async () => {
    const skillTrustPolicyService = {
      readPolicy: jest.fn(() => ({
        version: 1,
        updatedAt: null,
        defaultPolicy: 'allow',
        allowedSourceIds: ['workspace-agents'],
        rules: [],
      })),
      savePolicy: jest.fn(),
      setDefaultPolicy: jest.fn(() => ({
        version: 1,
        updatedAt: '2026-04-12T11:10:00.000Z',
        defaultPolicy: 'deny',
        allowedSourceIds: ['workspace-agents'],
        rules: [],
      })),
      setSourceRule: jest.fn(),
    };
    const policyLedgerService = buildLedgerMock();
    const service = new ZavorthTrustPlaneActionService({
      mcpToolPolicyFileService: {
        readPolicy: jest.fn(() => ({
          version: 1,
          updatedAt: null,
          profile: 'safe',
          allowlist: [],
        })),
        savePolicy: jest.fn(),
        setProfile: jest.fn(),
        allowTool: jest.fn(),
        removeTool: jest.fn(),
      } as any,
      skillTrustPolicyService: skillTrustPolicyService as any,
      trustPlaneService: { buildSnapshot: jest.fn(() => buildSnapshot()) } as any,
      policyLedgerService: policyLedgerService as any,
    });

    const result = await service.execute({
      actionId: 'set-skill-default',
      defaultPolicy: 'deny',
      requestedBy: 'operator',
      sourceSurface: 'chat',
    });

    expect(skillTrustPolicyService.setDefaultPolicy).toHaveBeenCalledWith('deny');
    expect(result.status).toBe('applied');
    expect(result.summary).toContain('deny');
    expect(result.diffPreview?.entries[0]).toEqual(expect.objectContaining({
      path: 'skills.defaultPolicy',
      before: 'allow',
      after: 'deny',
    }));
    expect(policyLedgerService.append).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'skills',
      status: 'applied',
      sourceSurface: 'chat',
    }));
  });

  it('keeps dangerous MCP scope temporary unless host is explicit', async () => {
    const policyLedgerService = buildLedgerMock();
    const trustDecisionService = {
      evaluate: jest.fn(async () => ({
        generatedAt: '2026-04-12T11:00:00.000Z',
        decision: 'requires_approval',
        ok: false,
        reason: 'dangerous exige approval.',
        permission: { permission_id: 'perm-danger', status: 'pending' },
        profile: 'core',
        capabilityId: null,
        recommendedScope: 'once',
      })),
    };
    const service = new ZavorthTrustPlaneActionService({
      mcpToolPolicyFileService: {
        readPolicy: jest.fn(() => ({
          version: 1,
          updatedAt: null,
          profile: 'safe',
          allowlist: [],
        })),
        savePolicy: jest.fn(),
        setProfile: jest.fn(),
        allowTool: jest.fn(),
        removeTool: jest.fn(),
      } as any,
      skillTrustPolicyService: {
        readPolicy: jest.fn(() => ({
          version: 1,
          updatedAt: null,
          defaultPolicy: 'deny',
          allowedSourceIds: [],
          rules: [],
        })),
        savePolicy: jest.fn(),
        setDefaultPolicy: jest.fn(),
        setSourceRule: jest.fn(),
      } as any,
      trustPlaneService: { buildSnapshot: jest.fn(() => buildSnapshot()) } as any,
      mutationPlaneService: {
        createPlan: jest.fn((input: any) => ({
          id: 'plan-danger',
          status: 'waiting_approval',
          approval: { permissionId: null, required: true, status: 'pending', defaultScope: 'once' },
          riskLevel: input.riskLevel,
          payload: input.payload,
        })),
        readPlan: jest.fn(),
        attachApproval: jest.fn((planId: string, approval: any) => ({
          id: planId,
          status: 'waiting_approval',
          approval: { permissionId: approval.permissionId, required: true, status: 'pending', defaultScope: 'once' },
          riskLevel: 'critical',
          payload: {},
        })),
        approvePlan: jest.fn(),
        markApplied: jest.fn(),
        markBlocked: jest.fn(),
      } as any,
      trustDecisionService: trustDecisionService as any,
      policyLedgerService: policyLedgerService as any,
    });

    const result = await service.execute({
      actionId: 'set-mcp-profile',
      profile: 'dangerous',
      approvalScope: 'session',
    });

    expect(trustDecisionService.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      approvalScope: 'once',
      riskLevel: 'critical',
    }));
    expect(result.diffPreview).toEqual(expect.objectContaining({
      approvalScope: 'once',
      dangerousTemporary: true,
    }));
  });

  it('applies an approved plan and records the applied ledger entry', async () => {
    const mcpToolPolicyFileService = {
      readPolicy: jest.fn(() => ({
        version: 1,
        updatedAt: null,
        profile: 'safe',
        allowlist: [],
      })),
      savePolicy: jest.fn(),
      setProfile: jest.fn(() => ({
        version: 1,
        updatedAt: '2026-04-12T11:15:00.000Z',
        profile: 'trusted',
        allowlist: [],
      })),
      allowTool: jest.fn(),
      removeTool: jest.fn(),
    };
    const policyLedgerService = buildLedgerMock();
    const plan = {
      id: 'plan-approved',
      domain: 'trust',
      actionId: 'set-mcp-profile',
      status: 'approved',
      requestedBy: 'operator',
      sourceSurface: 'cli',
      riskLevel: 'high',
      approval: { required: true, status: 'approved', permissionId: 'perm-approved', defaultScope: 'session' },
      payload: {
        profile: 'trusted',
        diffPreview: {
          domain: 'mcp',
          actionId: 'set-mcp-profile',
          approvalScope: 'session',
          summary: 'Promover MCP.',
          dangerousTemporary: false,
          rollbackAvailable: true,
          rollbackReason: 'Policy anterior salva.',
          entries: [{ path: 'mcp.profile', before: 'safe', after: 'trusted', summary: 'Perfil MCP.', riskLevel: 'high', reversible: true }],
        },
        rollbackPayload: {
          domain: 'mcp',
          beforePolicy: { version: 1, updatedAt: null, profile: 'safe', allowlist: [] },
          afterPolicy: { version: 1, updatedAt: null, profile: 'trusted', allowlist: [] },
        },
      },
    };
    const service = new ZavorthTrustPlaneActionService({
      mcpToolPolicyFileService: mcpToolPolicyFileService as any,
      skillTrustPolicyService: {
        readPolicy: jest.fn(() => ({
          version: 1,
          updatedAt: null,
          defaultPolicy: 'deny',
          allowedSourceIds: [],
          rules: [],
        })),
        savePolicy: jest.fn(),
        setDefaultPolicy: jest.fn(),
        setSourceRule: jest.fn(),
      } as any,
      trustPlaneService: { buildSnapshot: jest.fn(() => buildSnapshot()) } as any,
      mutationPlaneService: {
        createPlan: jest.fn(),
        readPlan: jest.fn(() => plan),
        attachApproval: jest.fn(),
        approvePlan: jest.fn(),
        markApplied: jest.fn(() => ({ ...plan, status: 'applied' })),
        markBlocked: jest.fn(),
      } as any,
      permissionService: { getRequest: jest.fn() } as any,
      policyLedgerService: policyLedgerService as any,
    });

    const result = await service.apply({ planId: 'plan-approved', requestedBy: 'operator' });

    expect(mcpToolPolicyFileService.setProfile).toHaveBeenCalledWith('trusted');
    expect(result.status).toBe('applied');
    expect(result.diffPreview?.approvalScope).toBe('session');
    expect(policyLedgerService.append).toHaveBeenCalledWith(expect.objectContaining({
      status: 'applied',
      planId: 'plan-approved',
      permissionId: 'perm-approved',
    }));
  });

  it('rolls back a policy mutation from the ledger when the previous policy is available', async () => {
    const mcpToolPolicyFileService = {
      readPolicy: jest.fn(),
      savePolicy: jest.fn(() => ({
        version: 1,
        updatedAt: '2026-04-12T11:20:00.000Z',
        profile: 'safe',
        allowlist: [],
      })),
      setProfile: jest.fn(),
      allowTool: jest.fn(),
      removeTool: jest.fn(),
    };
    const policyLedgerService = buildLedgerMock();
    policyLedgerService.list.mockReturnValue([
      {
        id: 'ledger-profile',
        at: '2026-04-12T11:10:00.000Z',
        domain: 'mcp',
        actionId: 'set-mcp-profile',
        requestedBy: 'operator',
        sourceSurface: 'cli',
        status: 'applied',
        riskLevel: 'high',
        approvalScope: 'once',
        planId: 'plan-profile',
        permissionId: 'perm-profile',
        summary: 'Promover MCP.',
        diff: [{ path: 'mcp.profile', before: 'safe', after: 'trusted', summary: 'Perfil MCP.', riskLevel: 'high', reversible: true }],
        rollback: {
          available: true,
          reason: 'Policy anterior salva.',
          payload: {
            domain: 'mcp',
            beforePolicy: { version: 1, updatedAt: null, profile: 'safe', allowlist: [] },
            afterPolicy: { version: 1, updatedAt: null, profile: 'trusted', allowlist: [] },
          },
        },
        result: 'Perfil MCP alterado.',
      },
    ]);
    const service = new ZavorthTrustPlaneActionService({
      mcpToolPolicyFileService: mcpToolPolicyFileService as any,
      skillTrustPolicyService: {
        readPolicy: jest.fn(),
        savePolicy: jest.fn(),
        setDefaultPolicy: jest.fn(),
        setSourceRule: jest.fn(),
      } as any,
      trustPlaneService: { buildSnapshot: jest.fn(() => buildSnapshot()) } as any,
      policyLedgerService: policyLedgerService as any,
    });

    const result = await service.rollback({
      ledgerId: 'ledger-profile',
      requestedBy: 'operator',
      sourceSurface: 'cli',
    });

    expect(mcpToolPolicyFileService.savePolicy).toHaveBeenCalledWith({
      version: 1,
      updatedAt: null,
      profile: 'safe',
      allowlist: [],
    });
    expect(result.status).toBe('applied');
    expect(policyLedgerService.append).toHaveBeenLastCalledWith(expect.objectContaining({
      actionId: 'rollback-policy-mutation',
      status: 'rolled_back',
      planId: 'plan-profile',
    }));
  });
});
