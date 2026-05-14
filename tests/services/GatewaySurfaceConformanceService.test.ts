import {
  buildDefaultGatewaySurfaceDescriptors,
  GatewaySurfaceConformanceService,
} from '../../src/services/GatewaySurfaceConformanceService.js';
import { createGatewaySurfaceTemplate } from '../../src/gateways/GatewaySurfaceTemplate.js';

describe('GatewaySurfaceConformanceService', () => {
  it('passes Telegram, web, CLI and API through the gateway surface contract', () => {
    const service = new GatewaySurfaceConformanceService({
      now: () => new Date('2026-04-24T12:00:00.000Z'),
    });

    const reports = service.evaluateAll(buildDefaultGatewaySurfaceDescriptors());

    expect(reports).toHaveLength(4);
    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          descriptorId: 'telegram',
          ok: true,
          status: 'passed',
        }),
        expect.objectContaining({
          descriptorId: 'web-control',
          ok: true,
          status: 'passed',
        }),
        expect.objectContaining({
          descriptorId: 'cli',
          ok: true,
          status: 'passed',
        }),
        expect.objectContaining({
          descriptorId: 'api',
          ok: true,
          status: 'passed',
        }),
      ]),
    );
    expect(buildDefaultGatewaySurfaceDescriptors()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'telegram',
        naturalFirstIngress: expect.objectContaining({
          freeTextEntrypoint: 'zavorth-agent-gateway',
          gatewayRequiredForFreeText: true,
          llmDirectEntryAllowed: false,
        }),
      }),
      expect.objectContaining({
        id: 'web-control',
        naturalFirstIngress: expect.objectContaining({
          freeTextEntrypoint: 'zavorth-agent-gateway',
          gatewayRequiredForFreeText: true,
          llmDirectEntryAllowed: false,
        }),
      }),
      expect.objectContaining({
        id: 'cli',
        naturalFirstIngress: expect.objectContaining({
          freeTextEntrypoint: 'zavorth-agent-gateway',
          gatewayRequiredForFreeText: true,
          llmDirectEntryAllowed: false,
        }),
      }),
      expect.objectContaining({
        id: 'api',
        naturalFirstIngress: expect.objectContaining({
          freeTextEntrypoint: 'zavorth-agent-gateway',
          gatewayRequiredForFreeText: true,
          llmDirectEntryAllowed: false,
          sourceFiles: expect.arrayContaining([
            'src/services/DashboardEchoRouteService.ts',
            'src/services/NexusFacadeService.ts',
          ]),
        }),
      }),
    ]));
    expect(service.buildCapabilityMatrix(buildDefaultGatewaySurfaceDescriptors())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'telegram',
          channel: 'telegram',
          capabilities: expect.objectContaining({
            approvals: true,
            groupPolicy: true,
          }),
        }),
        expect.objectContaining({
          id: 'web-control',
          channel: 'web',
          capabilities: expect.objectContaining({
            realtime: true,
            sessionSend: true,
          }),
        }),
        expect.objectContaining({
          id: 'cli',
          channel: 'cli',
          capabilities: expect.objectContaining({
            approvals: true,
            sessionSend: true,
          }),
        }),
        expect.objectContaining({
          id: 'api',
          channel: 'api',
          capabilities: expect.objectContaining({
            inbound: true,
            sessionSend: true,
          }),
        }),
      ]),
    );
  });

  it('lets a new gateway fixture pass without network access', () => {
    const service = new GatewaySurfaceConformanceService();
    const descriptor = createGatewaySurfaceTemplate({
      id: 'fixture-gateway',
      label: 'Fixture Gateway',
      channel: 'slack',
      transport: 'stub',
    });

    const report = service.evaluate(descriptor);

    expect(report.ok).toBe(true);
    expect(report.status).toBe('passed');
    expect(report.findings).toEqual([]);
    expect(descriptor.trust.failOpen).toBe(false);
    expect(descriptor.securityBoundary.credentialAbsentBehavior).toBe('disabled');
  });

  it('fails unsafe fail-open gateways and callbacks without permission boundaries', () => {
    const service = new GatewaySurfaceConformanceService();
    const descriptor = createGatewaySurfaceTemplate({
      id: 'unsafe-gateway',
      label: 'Unsafe Gateway',
      channel: 'email',
      transport: 'webhook',
    });
    descriptor.trust.failOpen = true;
    descriptor.callbacks[0].permissionBoundary = 'none';
    descriptor.securityBoundary.mutations[0].enforcement = 'none';

    const report = service.evaluate(descriptor);

    expect(report.ok).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirementId: 'trust-fail-open' }),
        expect.objectContaining({ requirementId: 'callback-boundary' }),
        expect.objectContaining({ requirementId: 'mutation-policy-boundary' }),
      ]),
    );
  });

  it('fails surfaces that let free text bypass ZavorthAgentGateway', () => {
    const service = new GatewaySurfaceConformanceService();
    const descriptor = createGatewaySurfaceTemplate({
      id: 'unsafe-natural-first',
      label: 'Unsafe Natural First',
      channel: 'web',
      transport: 'local',
    });
    descriptor.naturalFirstIngress.freeTextEntrypoint = 'command-router-shortcut';
    descriptor.naturalFirstIngress.gatewayRequiredForFreeText = false;

    const report = service.evaluate(descriptor);

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ requirementId: 'natural-first-free-text-gateway' }),
    ]));
  });
});
