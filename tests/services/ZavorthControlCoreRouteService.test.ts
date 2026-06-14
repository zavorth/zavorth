import { ZavorthControlCoreRouteService } from '../../src/services/ZavorthControlCoreRouteService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';

import { ZavorthControlCoreRouteService } from '../../src/services/ZavorthControlCoreRouteService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';
import { WorkspaceResolver } from '../../src/security/WorkspaceResolver';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger';

jest.mock('../../src/services/ProviderConfigService');
jest.mock('../../src/services/ProviderSecretStore');
jest.mock('../../src/security/WorkspaceResolver');
jest.mock('../../src/services/SecurityAuditLogger');

describe('ZavorthControlCoreRouteService Security Tests (Phase 21H)', () => {
  let service: ZavorthControlCoreRouteService;
  
  beforeEach(() => {
    service = new ZavorthControlCoreRouteService();
    
    (ProviderConfigService.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockResolvedValue([{
        providerId: 'test-123',
        type: 'openai',
        secretRef: 'secret-uuid-123'
      }]),
      createProvider: jest.fn().mockResolvedValue({
        providerId: 'new-123',
        type: 'openai'
      }),
      setSecretRef: jest.fn()
    });

    (LocalEncryptedProviderSecretStore.getInstance as jest.Mock).mockReturnValue({
      saveSecret: jest.fn().mockResolvedValue({
        secretRef: 'new-secret-uuid-456'
      })
    });
  });

  const runRoute = async (method: string, path: string, body?: any) => {
    let responseBody = '';
    let responseStatus = 200;
    
    const req = {
      method,
      url: path,
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
      }
    };

    const urlObj = new URL(path, 'http://localhost');
    const handled = await service.handleRequest(req as any, res as any, urlObj, urlObj.pathname, deps as any);
    return { handled, responseStatus, responseBody };
  };

  it('GET /api/v2/providers nao retorna API keys brutas', async () => {
    const result = await runRoute('GET', '/api/v2/providers');
    expect(result.handled).toBe(true);
    expect(result.responseBody).toContain('test-123');
    expect(result.responseBody).not.toContain('sk-');
    expect(result.responseBody).not.toContain('apiKey');
  });

  it('POST /api/v2/providers nao retorna raw key apos salvar', async () => {
    const result = await runRoute('POST', '/api/v2/providers', {
      type: 'openai',
      apiKey: 'sk-new-super-secret-key-123'
    });
    
    expect(result.handled).toBe(true);
    expect(result.responseBody).toContain('new-123');
    expect(result.responseBody).not.toContain('sk-new-super-secret-key-123');
  });
});

describe('ZavorthControlCoreRouteService Security Tests (Phase 21J)', () => {
  let service: ZavorthControlCoreRouteService;
  let mockLogWorkspaceEvent: jest.Mock;
  
  beforeEach(() => {
    service = new ZavorthControlCoreRouteService();
    
    (WorkspaceResolver.isWorkspaceAllowed as jest.Mock).mockImplementation((ws) => {
      return ws === 'C:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth' || ws === 'allowed-workspace';
    });
    
    mockLogWorkspaceEvent = jest.fn();
    (SecurityAuditLogger as jest.Mock).mockImplementation(() => ({
      logWorkspaceEvent: mockLogWorkspaceEvent
    }));
  });

  const runRoute = async (method: string, path: string, body?: any) => {
    let responseBody = '';
    let responseStatus = 200;
    
    const req = {
      method,
      url: path,
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
        resolveAuthenticatedIdentity: () => ({ authenticated: true, userId: 'test' })
      }
    };

    const urlObj = new URL(path, 'http://localhost');
    const handled = await service.handleRequest(req as any, res as any, urlObj, urlObj.pathname, deps as any);
    return { handled, responseStatus, responseBody };
  };

  it('GET agent-config com workspaceId diferente do ativo retorna 403 e gera audit', async () => {
    const result = await runRoute('GET', '/api/v2/workspace/agent-config?workspaceId=unauthorized-workspace');
    expect(result.handled).toBe(true);
    expect(result.responseStatus).toBe(403);
    
    expect(mockLogWorkspaceEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'blocked_cross_workspace_config_access',
      workspaceId: 'unauthorized-workspace',
      metadata: expect.objectContaining({
        status: 'blocked',
        errorCode: 'cross_workspace_access'
      })
    }));

    const callArgs = mockLogWorkspaceEvent.mock.calls[0][0];
    const stringified = JSON.stringify(callArgs);
    expect(stringified).not.toContain('API key');
    expect(stringified).not.toContain('Authorization');
    expect(stringified).not.toContain('secretRef');
  });

  it('PATCH agent-config com workspaceId diferente do ativo retorna 403', async () => {
    const result = await runRoute('PATCH', '/api/v2/workspace/agent-config', {
      workspaceId: 'unauthorized-workspace',
      config: { allowPty: true }
    });
    expect(result.handled).toBe(true);
    expect(result.responseStatus).toBe(403);

    expect(mockLogWorkspaceEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'blocked_cross_workspace_config_access',
      workspaceId: 'unauthorized-workspace'
    }));
    
    const callArgs = mockLogWorkspaceEvent.mock.calls[0][0];
    const stringified = JSON.stringify(callArgs);
    expect(stringified).not.toContain('allowPty'); // Does not contain raw body
  });

  it('workspaceId com path traversal (..) retorna 400', async () => {
    const result = await runRoute('GET', '/api/v2/workspace/agent-config?workspaceId=../other-workspace');
    expect(result.handled).toBe(true);
    expect(result.responseStatus).toBe(400);

    expect(mockLogWorkspaceEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'blocked_cross_workspace_config_access',
      metadata: expect.objectContaining({ errorCode: 'path_traversal' })
    }));
  });

  it('workspaceId absoluto arbitrario retorna 400', async () => {
    const result = await runRoute('GET', '/api/v2/workspace/agent-config?workspaceId=C:/Windows/System32');
    expect(result.handled).toBe(true);
    expect(result.responseStatus).toBe(400);

    expect(mockLogWorkspaceEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'blocked_cross_workspace_config_access',
      metadata: expect.objectContaining({ errorCode: 'path_traversal' })
    }));
  });
});
