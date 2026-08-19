import fs from 'fs';
import path from 'path';

import {
  GATEWAY_CONTROL_OPERATION_CONTRACTS,
  buildGatewayControlDelegatedOperationPayload,
  buildGatewayControlOperationPayload,
  buildGatewayControlOperationRouteOptions,
  buildGatewayControlReadPayload,
  parseGatewayControlRouteOptions,
} from '../../src/ai-gateway/app/api/gateway-control/gatewayControlRouteSupport';
import {
  GATEWAY_CONTROL_API_CONTRACT_VERSION,
  type ZavorthGatewayControlApiSnapshot,
} from '../../src/services/ZavorthGatewayRuntimeService';

describe('Gateway Control read routes', () => {
  const projectRoot = process.cwd();
  const routeRoot = path.join(projectRoot, 'src', 'ai-gateway', 'app', 'api', 'gateway-control');

  const snapshot: ZavorthGatewayControlApiSnapshot = {
    ok: true,
    contractVersion: GATEWAY_CONTROL_API_CONTRACT_VERSION,
    generatedAt: '2026-04-27T12:00:00.000Z',
    boundary: {
      stableEntry: 'ZavorthGatewayRuntimeService.buildGatewayControlApiSnapshot',
      currentCut: 'P2-006h',
      doNotBypass: ['src/zavorth-control/app/api/* internals'],
    },
    health: {
      status: 'ready',
      providerControlPlaneAttached: true,
      AIGateway: {
        enabled: true,
        ready: true,
        running: true,
        pid: 4512,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-27T12:00:00.000Z',
        message: 'Own AIGateway gateway active.',
      },
      lastHealthyProvider: 'openai',
      issues: [],
    },
    providers: {
      source: 'provider-control-plane',
      includeAdvanced: false,
      currentProvider: 'openai',
      currentModel: 'gpt-4o',
      summary: {
        total: 1,
        ready: 1,
        needsConfig: 0,
        needsProbe: 0,
      },
      entries: [
        {
          id: 'openai',
          kind: 'provider',
          label: 'OpenAI',
          effectiveProviderName: 'openai',
          aliases: [],
          visibility: 'public',
          mode: 'cloud',
          summary: 'Cloud provider.',
          currentModel: 'gpt-4o',
          requirements: ['OPENAI_API_KEY'],
          readiness: 'ready',
          ready: true,
          issue: null,
        },
      ],
    },
    models: {
      source: 'provider-control-plane',
      entries: [
        {
          providerId: 'openai',
          providerLabel: 'OpenAI',
          model: 'gpt-4o',
          ready: true,
          modality: 'chat',
        },
      ],
    },
    profiles: [],
    combos: {
      status: 'delegated',
      sourceRoutes: ['/api/combos', '/api/combos/test'],
      entries: [],
      warnings: [],
    },
    cache: {
      status: 'delegated',
      sourceRoutes: ['/api/cache/stats'],
      semanticStats: null,
      warnings: [],
    },
    rateLimits: {
      status: 'delegated',
      sourceRoutes: ['/api/rate-limits'],
      entries: [],
      warnings: [],
    },
    operations: [
      {
        id: 'providers.list',
        method: 'GET',
        path: '/api/gateway-control/providers',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'provider-control-plane',
        summary: 'Lista providers.',
      },
    ],
    warnings: [],
  };

  const gatewayControlService = {
    buildGatewayControlApiSnapshot: jest.fn(() => snapshot),
  };

  const approvedPermission = {
    permission_id: 'permission-gateway-control-provider',
    created_at: '2026-04-27T12:00:00.000Z',
    updated_at: '2026-04-27T12:00:00.000Z',
    task_id: null,
    executor: 'gateway-control',
    kind: 'operation_access',
    status: 'approved',
    scope: 'session',
    workspace: null,
    requested_value: 'conn-openai',
    resolved_value: 'conn-openai',
    reason: 'Allow provider test through Gateway Control.',
    requested_by: 'operator@test',
    decided_by: 'operator@test',
    decision_note: 'Approved.',
    metadata: {
      policy_family: 'gateway_control_operation',
      resource: 'providers.test',
      target: 'conn-openai',
      risk: 'sensitive',
    },
  } as const;

  const approvedCachePermission = {
    ...approvedPermission,
    permission_id: 'permission-gateway-control-cache',
    requested_value: 'model:gpt-4o',
    resolved_value: 'model:gpt-4o',
    reason: 'Allow cache invalidation through Gateway Control.',
    metadata: {
      policy_family: 'gateway_control_operation',
      resource: 'cache.invalidate',
      target: 'model:gpt-4o',
      risk: 'write',
    },
  } as const;

  const approvedRateLimitPermission = {
    ...approvedPermission,
    permission_id: 'permission-gateway-control-rate-limit',
    requested_value: 'connection:conn-openai:enable',
    resolved_value: 'connection:conn-openai:enable',
    reason: 'Allow rate-limit protection toggle through Gateway Control.',
    metadata: {
      policy_family: 'gateway_control_operation',
      resource: 'rate-limits.toggle',
      target: 'connection:conn-openai:enable',
      risk: 'write',
    },
  } as const;

  it('exposes official read route files without adding write handlers', () => {
    const routes = [
      'route.ts',
      path.join('providers', 'route.ts'),
      path.join('models', 'route.ts'),
      path.join('health', 'route.ts'),
      path.join('combos', 'route.ts'),
      path.join('cache', 'route.ts'),
      path.join('rate-limits', 'route.ts'),
    ];

    for (const route of routes) {
      const source = fs.readFileSync(path.join(routeRoot, route), 'utf8');
      expect(source).toContain('export async function GET');
      expect(source).not.toMatch(/export async function (POST|PUT|DELETE)/);
    }
  });

  it('keeps official operation route files aligned with the operation contract', () => {
    for (const operation of GATEWAY_CONTROL_OPERATION_CONTRACTS) {
      const relativeRoute = operation.publicPath.replace('/api/gateway-control/', '');
      const routeFile = path.join(routeRoot, ...relativeRoute.split('/'), 'route.ts');
      const source = fs.readFileSync(routeFile, 'utf8');

      expect(source).toContain(`export async function ${operation.method}`);
      expect(source).toContain(`"${operation.id}"`);
      expect(operation.requiresApproval).toBe(true);
      expect(operation.status).toBe('available');
    }
  });

  it('returns selected read payloads from the P2-006 facade contract', () => {
    const providersPayload = buildGatewayControlReadPayload('providers', { gatewayControlService });
    const healthPayload = buildGatewayControlReadPayload('health', { gatewayControlService });

    expect(providersPayload).toEqual(expect.objectContaining({
      ok: true,
      contractVersion: GATEWAY_CONTROL_API_CONTRACT_VERSION,
      resource: 'providers',
      providers: expect.objectContaining({
        summary: expect.objectContaining({ ready: 1 }),
      }),
    }));
    expect(healthPayload).toEqual(expect.objectContaining({
      resource: 'health',
      health: expect.objectContaining({
        status: 'ready',
        lastHealthyProvider: 'openai',
      }),
    }));
  });

  it('parses the advanced provider flag for route handlers', () => {
    const request = new Request('http://127.0.0.1:3000/api/gateway-control/providers?advanced=true');

    expect(parseGatewayControlRouteOptions(request)).toEqual({
      includeAdvancedProviders: true,
    });
  });

  it('blocks provider test operations without approval and redacts sensitive input', () => {
    const payload = buildGatewayControlOperationPayload(
      'providers.test',
      {
        connectionId: 'conn-openai',
        apiKey: 'sk-test-secret',
        nested: {
          accessToken: 'access-secret',
        },
      },
      { gatewayControlService },
    );
    const serialized = JSON.stringify(payload);

    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      httpStatus: 403,
      status: 'approval_required',
      resource: 'providers.test',
      operation: expect.objectContaining({
        risk: 'sensitive',
        delegatedRoute: '/api/providers/[id]/test',
      }),
      approval: expect.objectContaining({
        required: true,
        satisfied: false,
      }),
    }));
    expect(serialized).not.toContain('sk-test-secret');
    expect(serialized).not.toContain('access-secret');
    expect(serialized).toContain('[redacted]');
  });

  it('keeps operation payload descriptors aligned with the operation contract', () => {
    const validInputs: Record<string, Record<string, unknown>> = {
      'providers.test': { connectionId: 'conn-openai' },
      'combos.validate': { comboName: 'default-combo' },
      'cache.invalidate': { scope: 'all' },
      'rate-limits.toggle': { connectionId: 'conn-openai', enabled: false },
    };

    for (const operation of GATEWAY_CONTROL_OPERATION_CONTRACTS) {
      const payload = buildGatewayControlOperationPayload(
        operation.id,
        validInputs[operation.id],
        { gatewayControlService },
      );

      expect(payload).toEqual(expect.objectContaining({
        httpStatus: 403,
        status: 'approval_required',
        operation: {
          id: operation.id,
          risk: operation.risk,
          delegatedRoute: operation.delegatedRoute,
          existingEquivalent: operation.existingEquivalent,
        },
      }));
    }
  });

  it('validates combo operation input before any delegated route can run', () => {
    const payload = buildGatewayControlOperationPayload(
      'combos.validate',
      {
        apiKey: 'combo-secret',
      },
      { gatewayControlService },
    );

    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      httpStatus: 400,
      status: 'invalid',
      resource: 'combos.validate',
      errors: expect.arrayContaining(['comboName is required for combos.validate.']),
    }));
    expect(JSON.stringify(payload)).not.toContain('combo-secret');
  });

  it('validates cache invalidation scope before permission lookup or delegation', () => {
    const payload = buildGatewayControlOperationPayload(
      'cache.invalidate',
      {
        scope: 'model',
        apiKey: 'cache-secret',
      },
      { gatewayControlService },
    );

    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      httpStatus: 400,
      status: 'invalid',
      resource: 'cache.invalidate',
      errors: expect.arrayContaining(['model is required when scope=model for cache.invalidate.']),
    }));
    expect(JSON.stringify(payload)).not.toContain('cache-secret');
  });

  it('validates rate-limit toggle input before permission lookup or delegation', () => {
    const payload = buildGatewayControlOperationPayload(
      'rate-limits.toggle',
      {
        connectionId: 'conn-openai',
        apiKey: 'rate-limit-secret',
      },
      { gatewayControlService },
    );

    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      httpStatus: 400,
      status: 'invalid',
      resource: 'rate-limits.toggle',
      errors: expect.arrayContaining(['enabled boolean is required for rate-limits.toggle.']),
    }));
    expect(JSON.stringify(payload)).not.toContain('rate-limit-secret');
  });

  it('delegates approved operations through an injected policy and records an audit receipt', async () => {
    const approveOperation = jest.fn(() => ({
      approved: true,
      approvalId: 'approval-provider-1',
      approvedBy: 'operator@test',
      reason: 'Approved for smoke test.',
    }));
    const delegateOperation = jest.fn(async () => ({
      ok: true,
      apiKey: 'delegate-secret',
      provider: 'openai',
    }));

    const payload = await buildGatewayControlDelegatedOperationPayload(
      'providers.test',
      {
        connectionId: 'conn-openai',
        apiKey: 'request-secret',
      },
      {
        gatewayControlService,
        approveOperation,
        delegateOperation,
        now: () => new Date('2026-04-27T12:00:00.000Z'),
        timeoutMs: 1000,
      },
    );
    const serialized = JSON.stringify(payload);

    expect(approveOperation).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'providers.test',
      input: expect.objectContaining({
        connectionId: 'conn-openai',
        apiKey: '[redacted]',
      }),
    }));
    expect(delegateOperation).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'providers.test',
      timeoutMs: 1000,
      approval: expect.objectContaining({
        approvalId: 'approval-provider-1',
      }),
    }));
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      httpStatus: 200,
      status: 'delegated',
      approval: expect.objectContaining({
        satisfied: true,
        approvalId: 'approval-provider-1',
        approvedBy: 'operator@test',
      }),
      audit: expect.objectContaining({
        receiptId: expect.stringContaining('gateway-control:providers.test'),
        timeoutMs: 1000,
        timedOut: false,
        delegatedRoute: '/api/providers/[id]/test',
      }),
      result: expect.objectContaining({
        ok: true,
        apiKey: '[redacted]',
      }),
    }));
    expect(serialized).not.toContain('request-secret');
    expect(serialized).not.toContain('delegate-secret');
  });

  it('returns a structured timeout when an approved delegate exceeds the configured limit', async () => {
    const payload = await buildGatewayControlDelegatedOperationPayload(
      'combos.validate',
      {
        comboName: 'default-combo',
        refreshToken: 'combo-secret',
      },
      {
        gatewayControlService,
        approveOperation: () => ({
          approved: true,
          approvalId: 'approval-combo-timeout',
        }),
        delegateOperation: () => new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 50);
        }),
        timeoutMs: 5,
      },
    );

    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      httpStatus: 504,
      status: 'timeout',
      approval: expect.objectContaining({
        satisfied: true,
        approvalId: 'approval-combo-timeout',
      }),
      audit: expect.objectContaining({
        timeoutMs: 5,
        timedOut: true,
        delegatedRoute: '/api/combos/test',
      }),
      errors: expect.arrayContaining(['Delegation exceeded the 5ms timeout.']),
    }));
    expect(JSON.stringify(payload)).not.toContain('combo-secret');
  });

  it('uses PermissionService policy matching before route-level delegation can run', async () => {
    const permissionService = {
      findApprovedRequest: jest.fn(async () => undefined),
    };
    const fetchImpl = jest.fn();
    const request = new Request('http://127.0.0.1:3000/api/gateway-control/providers/test', {
      headers: {
        'x-zavorth-workspace': 'workspace-main',
      },
    });

    const payload = await buildGatewayControlDelegatedOperationPayload(
      'providers.test',
      {
        connectionId: 'conn-openai',
      },
      {
        ...buildGatewayControlOperationRouteOptions(request, {
          gatewayControlService,
          permissionService,
          fetchImpl,
        }),
      },
    );

    expect(permissionService.findApprovedRequest).toHaveBeenCalledWith(
      'gateway-control',
      'operation_access',
      'workspace-main',
      {
        policy_family: 'gateway_control_operation',
        resource: 'providers.test',
        target: 'conn-openai',
        risk: 'sensitive',
      },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      httpStatus: 403,
      status: 'approval_required',
      approval: expect.objectContaining({
        satisfied: false,
        reason: expect.stringContaining('PermissionService'),
      }),
    }));
  });

  it('delegates approved route operations to the existing provider test endpoint over HTTP', async () => {
    const permissionService = {
      findApprovedRequest: jest.fn(async () => approvedPermission),
    };
    const fetchImpl = jest.fn(async () => new Response(
      JSON.stringify({
        valid: true,
        apiKey: 'delegate-secret',
        latencyMs: 12,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    const request = new Request('http://127.0.0.1:3000/api/gateway-control/providers/test');

    const payload = await buildGatewayControlDelegatedOperationPayload(
      'providers.test',
      {
        connectionId: 'conn-openai',
        validationModelId: 'gpt-4o',
      },
      {
        ...buildGatewayControlOperationRouteOptions(request, {
          gatewayControlService,
          permissionService,
          fetchImpl,
          timeoutMs: 1500,
        }),
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/providers/conn-openai/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Zavorth-Gateway-Control': 'true',
          'X-Zavorth-Approval-Id': 'permission-gateway-control-provider',
        }),
        body: JSON.stringify({ validationModelId: 'gpt-4o' }),
      }),
    );
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      httpStatus: 200,
      status: 'delegated',
      approval: expect.objectContaining({
        satisfied: true,
        approvalId: 'permission-gateway-control-provider',
        approvedBy: 'operator@test',
      }),
      result: expect.objectContaining({
        ok: true,
        httpStatus: 200,
        equivalentPath: '/api/providers/conn-openai/test',
        data: expect.objectContaining({
          valid: true,
          apiKey: '[redacted]',
        }),
      }),
    }));
    expect(JSON.stringify(payload)).not.toContain('delegate-secret');
  });

  it('delegates approved cache invalidation to the existing cache route over HTTP', async () => {
    const permissionService = {
      findApprovedRequest: jest.fn(async () => approvedCachePermission),
    };
    const fetchImpl = jest.fn(async () => new Response(
      JSON.stringify({
        ok: true,
        invalidated: 3,
        scope: 'model',
        model: 'gpt-4o',
        apiKey: 'cache-delegate-secret',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    const request = new Request('http://127.0.0.1:3000/api/gateway-control/cache/invalidate');

    const payload = await buildGatewayControlDelegatedOperationPayload(
      'cache.invalidate',
      {
        scope: 'model',
        model: 'gpt-4o',
      },
      {
        ...buildGatewayControlOperationRouteOptions(request, {
          gatewayControlService,
          permissionService,
          fetchImpl,
          timeoutMs: 1500,
        }),
      },
    );

    expect(permissionService.findApprovedRequest).toHaveBeenCalledWith(
      'gateway-control',
      'operation_access',
      null,
      {
        policy_family: 'gateway_control_operation',
        resource: 'cache.invalidate',
        target: 'model:gpt-4o',
        risk: 'write',
      },
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/cache?model=gpt-4o',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Zavorth-Gateway-Control': 'true',
          'X-Zavorth-Approval-Id': 'permission-gateway-control-cache',
        }),
      }),
    );
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      httpStatus: 200,
      status: 'delegated',
      operation: expect.objectContaining({
        delegatedRoute: '/api/cache',
        existingEquivalent: 'DELETE /api/cache',
      }),
      approval: expect.objectContaining({
        satisfied: true,
        approvalId: 'permission-gateway-control-cache',
      }),
      result: expect.objectContaining({
        equivalentPath: '/api/cache?model=gpt-4o',
        data: expect.objectContaining({
          ok: true,
          apiKey: '[redacted]',
        }),
      }),
    }));
    expect(JSON.stringify(payload)).not.toContain('cache-delegate-secret');
  });

  it('delegates approved rate-limit toggles to the existing rate-limits route over HTTP', async () => {
    const permissionService = {
      findApprovedRequest: jest.fn(async () => approvedRateLimitPermission),
    };
    const fetchImpl = jest.fn(async () => new Response(
      JSON.stringify({
        success: true,
        connectionId: 'conn-openai',
        enabled: true,
        accessToken: 'rate-limit-delegate-secret',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    const request = new Request('http://127.0.0.1:3000/api/gateway-control/rate-limits/toggle');

    const payload = await buildGatewayControlDelegatedOperationPayload(
      'rate-limits.toggle',
      {
        connectionId: 'conn-openai',
        enabled: true,
      },
      {
        ...buildGatewayControlOperationRouteOptions(request, {
          gatewayControlService,
          permissionService,
          fetchImpl,
          timeoutMs: 1500,
        }),
      },
    );

    expect(permissionService.findApprovedRequest).toHaveBeenCalledWith(
      'gateway-control',
      'operation_access',
      null,
      {
        policy_family: 'gateway_control_operation',
        resource: 'rate-limits.toggle',
        target: 'connection:conn-openai:enable',
        risk: 'write',
      },
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/rate-limits',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Zavorth-Gateway-Control': 'true',
          'X-Zavorth-Approval-Id': 'permission-gateway-control-rate-limit',
        }),
        body: JSON.stringify({
          connectionId: 'conn-openai',
          enabled: true,
        }),
      }),
    );
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      httpStatus: 200,
      status: 'delegated',
      operation: expect.objectContaining({
        delegatedRoute: '/api/rate-limits',
        existingEquivalent: 'POST /api/rate-limits',
      }),
      approval: expect.objectContaining({
        satisfied: true,
        approvalId: 'permission-gateway-control-rate-limit',
      }),
      result: expect.objectContaining({
        equivalentPath: '/api/rate-limits',
        data: expect.objectContaining({
          success: true,
          accessToken: '[redacted]',
        }),
      }),
    }));
    expect(JSON.stringify(payload)).not.toContain('rate-limit-delegate-secret');
  });
});
