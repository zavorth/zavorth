import { ZavorthControlPresentationDepsBridgeService } from '../../src/domain/surface/presentation/zavorthControl/ZavorthControlPresentationDepsBridgeService.js';

describe('ZavorthControlPresentationDepsBridgeService', () => {
  it('builds classic, core, legacy, and CORS deps from a shared presentation source', () => {
    const bridge = new ZavorthControlPresentationDepsBridgeService();
    const source = {
      authService: { validate: jest.fn() },
      nodeHeartbeat: { claimPairing: jest.fn(), receiveHeartbeat: jest.fn() },
      nodeMesh: { buildSnapshot: jest.fn() },
      responseWriter: {
        writeHtml: jest.fn(),
        writeJson: jest.fn(),
        writeText: jest.fn(),
        writeRedirect: jest.fn(),
      },
      httpSupport: {
        readJsonBody: jest.fn(),
        readRawBody: jest.fn(),
      },
      slackIngressGateway: { handleWebhookEvent: jest.fn() },
      teamsIngressGateway: { handleWebhookEvent: jest.fn() },
      whatsappIngressGateway: { handleWebhookVerification: jest.fn(), handleWebhookEvent: jest.fn() },
      a2ui: { readSnapshot: jest.fn() },
      proactivePermissions: { listPending: jest.fn() },
      echoService: { getPendingPermissions: jest.fn(), resolvePermission: jest.fn() },
      getPublicBaseUrl: jest.fn(() => 'https://public.test'),
      getClassicZavorthControlHtml: jest.fn(() => '<html></html>'),
      observability: {
        getStats: jest.fn(),
        getRecentLogs: jest.fn(),
        getAuditLogs: jest.fn(),
        getAuditStats: jest.fn(),
      },
      sidecarStatus: {
        readSummary: jest.fn(),
      },
      skillCatalogApi: {
        buildSnapshot: jest.fn(),
      },
      skillMcpSidecar: {
        buildSnapshot: jest.fn(),
      },
      skillLibraryPresentation: {
        buildSnapshot: jest.fn(),
      },
      skillInstallPlanPresentation: {
        buildSnapshot: jest.fn(),
      },
    } as any;
    const input = {
      host: '127.0.0.1',
      port: 4100,
      snippetUserId: '1',
      localBaseUrl: 'http://127.0.0.1:4100',
      publicBaseUrl: 'https://public.test',
    };

    const classic = bridge.buildClassicAccessDeps(source);
    const core = bridge.buildCoreRouteDeps(source);
    const legacy = bridge.buildLegacyRouteDeps(source, input);
    const cors = bridge.buildHttpCorsDeps(input);

    expect(classic.authService).toBe(source.authService);
    expect(core.nodeMesh).toBe(source.nodeMesh);
    expect(core.echo).toBe(source.echoService);
    core.writeJson({} as any, { ok: true }, 202);
    expect(source.responseWriter.writeJson).toHaveBeenCalledWith({}, { ok: true }, 202);
    expect(legacy.host).toBe('127.0.0.1');
    expect(legacy.snippetUserId).toBe('1');
    expect(legacy.getClassicZavorthControlHtml()).toBe('<html></html>');
    expect(source.getClassicZavorthControlHtml).toHaveBeenCalled();
    legacy.getSkillInstallPlanSnapshot({ query: 'pkg' } as any);
    expect(source.skillInstallPlanPresentation.buildSnapshot).toHaveBeenCalledWith({ query: 'pkg' });
    expect(cors).toEqual({
      host: '127.0.0.1',
      port: 4100,
      localBaseUrl: 'http://127.0.0.1:4100',
      publicBaseUrl: 'https://public.test',
    });
  });
});
