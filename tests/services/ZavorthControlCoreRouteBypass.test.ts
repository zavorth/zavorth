import { ZavorthControlCoreRouteService } from '../../src/services/ZavorthControlCoreRouteService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';

jest.mock('../../src/services/ProviderConfigService');
jest.mock('../../src/services/ProviderSecretStore');
jest.mock('../../src/security/WorkspaceResolver');
jest.mock('../../src/services/SecurityAuditLogger');

describe('ZavorthControlCoreRouteBypass', () => {
  let service: ZavorthControlCoreRouteService;

  beforeEach(() => {
    service = new ZavorthControlCoreRouteService();
  });

  const runRoute = async (method: string, path: string, body-: any, authenticated = true) => {
    let responseBody = '';
    let responseStatus = 200;

    const req = {
      method,
      url: path,
      headers: {},
      on: (event: string, cb: Function) => {
        if (event === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
        if (event === 'end') cb();
      }
    };

    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      end: (data: string) => { responseBody = data; }
    };

    const deps = {
      readJsonBody: async () => body,
      writeJson: (resObj: any, data: any, status = 200) => {
        responseStatus = status;
        responseBody = JSON.stringify(data);
      },
      authService: {
        resolveAuthenticatedIdentity: () => (authenticated ? { authenticated: true, userId: 'test' } : null)
      }
    };

    const urlObj = new URL(path, 'http://localhost');
    const handled = await service.handleRequest(req as any, res as any, urlObj, urlObj.pathname, deps as any);
    return { handled, responseStatus, responseBody };
  };

  it('unknown route should return handled=false by default rejection', async () => {
    const result = await runRoute('GET', '/api/v2/nonexistent-route');
    expect(result.handled).toBe(false);
  });

  it('rota critica sem autenticaction deve retornar 401', async () => {
    const result = await runRoute('GET', '/api/v2/providers', {}, false);
    expect(result.handled).toBe(true);
    expect(result.responseStatus).toBe(401);
  });

  it('workspace config request without workspaceId must not fall into unsafe system authority and must return 400', async () => {
    const result = await runRoute('GET', '/api/v2/workspace/agent-config');
    expect(result.handled).toBe(true);
    expect(result.responseStatus).toBe(400);
    expect(result.responseBody).toContain('workspaceId parameter is required');
  });

  it('POST de provider com payload malformado deve ser rejected', async () => {
    const result = await runRoute('POST', '/api/v2/providers', {
      type: 'invalid-type-xyz'
    });
    expect(result.handled).toBe(true);
    expect(result.responseStatus).toBe(400);
  });
});
