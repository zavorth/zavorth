import { ZavorthControlCoreRouteService } from '../../src/services/ZavorthControlCoreRouteService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';

jest.mock('../../src/services/ProviderConfigService');
jest.mock('../../src/security/WorkspaceResolver');

describe('ProviderSecretMetadataLeak', () => {
  let service: ZavorthControlCoreRouteService;

  beforeEach(() => {
    service = new ZavorthControlCoreRouteService();
    
    (ProviderConfigService.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockResolvedValue([{
        providerId: 'openai-1',
        type: 'openai',
        secretRef: 'secret-uuid-xyz-123',
        keyFingerprint: 'fingerprint-abc',
        keySuffix: '9999', // suffix
        enabled: true,
      }]),
    });
  });

  const runRoute = async (method: string, path: string) => {
    let responseBody = '';
    let responseStatus = 200;
    
    const req = {
      method,
      url: path,
      headers: {},
      on: (event: string, cb: Function) => {
        if (event === 'end') cb();
      }
    };
    
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      end: (data: string) => { responseBody = data; }
    };
    
    const deps = {
      readJsonBody: async () => ({}),
      writeJson: (resObj: any, data: any, status = 200) => {
        responseStatus = status;
        responseBody = JSON.stringify(data);
      },
      authService: {
        resolveAuthenticatedIdentity: () => ({ authenticated: true, userId: 'test' })
      }
    };

    const urlObj = new URL(path, 'http://localhost');
    await service.handleRequest(req as any, res as any, urlObj, urlObj.pathname, deps as any);
    return { responseStatus, responseBody };
  };

  it('GET /api/v2/providers nao deve conter suffix ou secretRef nas respostas publicas/de servico', async () => {
    const result = await runRoute('GET', '/api/v2/providers');
    expect(result.responseStatus).toBe(200);
    
    const parsed = JSON.parse(result.responseBody);
    const provider = parsed.data[0];

    // Nao deve expor secretRef ou suffix nas rotas comuns de listagem
    expect(provider.secretRef).toBeUndefined();
    expect(provider.keySuffix).toBeUndefined();
    expect(provider.apiKey).toBeUndefined();
    expect(provider.rawKey).toBeUndefined();
    expect(provider.ciphertext).toBeUndefined();
    expect(provider.authTag).toBeUndefined();
  });
});
