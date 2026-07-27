import { ZavorthControlCoreRouteService } from '../../src/services/ZavorthControlCoreRouteService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';
import { WorkspaceResolver } from '../../src/security/WorkspaceResolver';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger';
import { WorkspaceTaskMandateService } from '../../src/services/WorkspaceTaskMandateService';
import { TemporaryDirectoryTrustService } from '../../src/services/TemporaryDirectoryTrustService';
import { PtySessionApprovalService } from '../../src/services/PtySessionApprovalService';
import { PtyInputApprovalService } from '../../src/services/PtyInputApprovalService';
import { PtySessionService } from '../../src/services/PtySessionService';
import { WorkspaceWriteApprovalService } from '../../src/services/WorkspaceWriteApprovalService';
import { WorkspaceSessionGrantCache } from '../../src/services/WorkspaceSessionGrantCache';
import { TrustedWorkspaceService } from '../../src/services/TrustedWorkspaceService';
import { Database } from '../../src/storage/Database';
import { HostCommandApprovalService } from '../../src/services/HostCommandApprovalService';
import { HostPowerModeService } from '../../src/services/HostPowerModeService';
import { HostCommandPayloadCache } from '../../src/services/HostCommandPayloadCache';
import { HostCommandRunnerService } from '../../src/services/HostCommandRunnerService';

jest.mock('../../src/services/ProviderConfigService');
jest.mock('../../src/services/ProviderSecretStore');
jest.mock('../../src/security/WorkspaceResolver');
jest.mock('../../src/services/SecurityAuditLogger');
jest.mock('../../src/services/WorkspaceTaskMandateService');
jest.mock('../../src/services/TemporaryDirectoryTrustService');
jest.mock('../../src/services/PtySessionApprovalService');
jest.mock('../../src/services/PtyInputApprovalService');
jest.mock('../../src/services/PtySessionService');
jest.mock('../../src/services/WorkspaceWriteApprovalService');
jest.mock('../../src/services/WorkspaceSessionGrantCache');
jest.mock('../../src/services/TrustedWorkspaceService');
jest.mock('../../src/storage/Database');
jest.mock('../../src/services/HostCommandApprovalService');
jest.mock('../../src/services/HostPowerModeService');
jest.mock('../../src/services/HostCommandPayloadCache');
jest.mock('../../src/services/HostCommandRunnerService');

describe('ZavorthControlCoreRouteService Schema Validation Tests', () => {
  let service: ZavorthControlCoreRouteService;

  beforeEach(() => {
    service = new ZavorthControlCoreRouteService();

    // Setup basic mock implementations to bypass router errors
    (WorkspaceResolver.isWorkspaceAllowed as jest.Mock).mockReturnValue(true);
    (WorkspaceResolver.resolve as jest.Mock).mockReturnValue('C:/workspaces/zavorth');

    // Mock the validateWorkspaceSession helper internally by making resolve return the workspace
    // wait, we can also mock validation of sessions
    (service as any).validateWorkspaceSession = () => true;

    (WorkspaceTaskMandateService.getInstance as jest.Mock).mockReturnValue({
      resolveMandate: jest.fn().mockReturnValue({ mandateId: '123', expiresAt: '2026' }),
      revokeMandate: jest.fn()
    });

    (TemporaryDirectoryTrustService.getInstance as jest.Mock).mockReturnValue({
      resolveTrust: jest.fn().mockReturnValue({ trustId: 't123' }),
      revokeTrust: jest.fn()
    });

    (PtySessionApprovalService as jest.Mock).mockImplementation(() => ({
      resolveProposal: jest.fn()
    }));

    (PtyInputApprovalService as jest.Mock).mockImplementation(() => ({
      resolveProposal: jest.fn()
    }));

    (PtySessionService.getInstance as jest.Mock).mockReturnValue({
      terminateSession: jest.fn()
    });

    (WorkspaceWriteApprovalService as jest.Mock).mockImplementation(() => ({
      approveOperation: jest.fn(),
      denyOperation: jest.fn()
    }));

    (WorkspaceSessionGrantCache.getInstance as jest.Mock).mockReturnValue({
      setDeveloperMode: jest.fn(),
      setGrant: jest.fn()
    });

    (TrustedWorkspaceService.getInstance as jest.Mock).mockResolvedValue({
      resolveTrust: jest.fn()
    });

    (HostCommandApprovalService as jest.Mock).mockImplementation(() => ({
      resolve: jest.fn(),
      consumeApproval: jest.fn().mockResolvedValue(true)
    }));

    (HostPowerModeService.getInstance as jest.Mock).mockReturnValue({
      enable: jest.fn(),
      disable: jest.fn(),
      getState: jest.fn().mockReturnValue({ enabled: true })
    });

    const mockDb = {
      get: jest.fn().mockReturnValue({ workspace_id: 'ws-1', risk_level: 'LOW', shell: 0 }),
      all: jest.fn().mockReturnValue([]),
      run: jest.fn().mockResolvedValue({ changes: 1 })
    };
    (Database.getInstance as jest.Mock).mockResolvedValue(mockDb);

    (HostCommandPayloadCache.getInstance as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue({ command: 'echo', args: ['hello'], cwd: '.' }),
      delete: jest.fn()
    });

    (HostCommandRunnerService as jest.Mock).mockImplementation(() => ({
      executeCommand: jest.fn().mockResolvedValue({ stdout: 'hello\n', stderr: '', exitCode: 0 })
    }));
  });

  const runRoute = async (method: string, path: string, body-: any) => {
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
        resolveAuthenticatedIdentity: () => ({ authenticated: true, userId: 'test-user' })
      },
      proactivePermissions: {
        resolve: jest.fn().mockReturnValue(true)
      },
      echo: {
        resolvePermission: jest.fn().mockResolvedValue({ ok: true })
      }
    };

    const urlObj = new URL(path, 'http://localhost');
    const handled = await service.handleRequest(req as any, res as any, urlObj, urlObj.pathname, deps as any);
    return { handled, responseStatus, responseBody };
  };

  describe('Task Mandates Validation', () => {
    it('POST /api/v2/workspace/task-mandates/resolve - success on valid body', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/task-mandates/resolve', {
        workspaceId: 'my-workspace',
        approved: true
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
      expect(JSON.parse(result.responseBody).ok).toBe(true);
    });

    it('POST /api/v2/workspace/task-mandates/resolve - fail on invalid schema', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/task-mandates/resolve', {
        workspaceId: '',
        approved: 'not-a-boolean'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
      expect(JSON.parse(result.responseBody).error).toBe('Validation failed');
    });

    it('POST /api/v2/workspace/task-mandates/revoke - success on valid body', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/task-mandates/revoke', {
        workspaceId: 'my-workspace'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/task-mandates/revoke - fail on missing workspaceId', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/task-mandates/revoke', {});
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });
  });

  describe('Temporary Directory Trusts Validation', () => {
    it('POST /api/v2/workspace/temporary-directory-trusts/resolve - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/temporary-directory-trusts/resolve', {
        workspaceId: 'ws-1',
        trustId: 't-1',
        approved: false
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/temporary-directory-trusts/resolve - failure', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/temporary-directory-trusts/resolve', {
        workspaceId: 'ws-1',
        approved: true
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });
  });

  describe('PTY Validation', () => {
    it('POST /api/v2/workspace/pty/resolve-session - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/pty/resolve-session', {
        workspaceId: 'ws',
        sessionId: 'session-id',
        approve: true
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/pty/resolve-session - failure', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/pty/resolve-session', {
        workspaceId: 'ws',
        sessionId: 'session-id'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });

    it('POST /api/v2/workspace/pty/resolve-input - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/pty/resolve-input', {
        workspaceId: 'ws',
        operationId: 'op-1',
        sessionId: 'sess-1',
        approve: false
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/pty/terminate - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/pty/terminate', {
        workspaceId: 'ws',
        sessionId: 'sess-1'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });
  });

  describe('Write Approvals & Session Grant Validation', () => {
    it('POST /api/v2/workspace/approvals/resolve - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/approvals/resolve', {
        operationId: 'op-1',
        decision: 'approve'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/approvals/resolve - invalid decision fails', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/approvals/resolve', {
        operationId: 'op-1',
        decision: 'other-thing'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });

    it('POST /api/v2/workspace/command-approvals/session-grant - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/command-approvals/session-grant', {
        workspaceId: 'ws-1',
        active: true,
        durationMinutes: 45
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });
  });

  describe('Host Power Validation', () => {
    it('POST /api/v2/workspace/host-power/enable - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/host-power/enable', {
        workspaceId: 'ws-1',
        durationMinutes: 10
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/host-power/enable - fail on bad duration type', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/host-power/enable', {
        workspaceId: 'ws-1',
        durationMinutes: '10' // Schema requires number
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });
  });

  describe('Host Commands Validation', () => {
    it('POST /api/v2/workspace/host-commands/resolve - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/host-commands/resolve', {
        operationId: 'op-1',
        decision: 'approve',
        strongConfirmationInput: 'yes'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/host-commands/resolve - invalid decision fails', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/host-commands/resolve', {
        operationId: 'op-1',
        decision: 'invalid-decision'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });

    it('POST /api/v2/workspace/host-commands/execute - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/host-commands/execute', {
        operationId: 'op-1'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/host-commands/execute - missing operationId fails', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/host-commands/execute', {});
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });

    it('POST /api/v2/workspace/host-commands/revoke - success', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/host-commands/revoke', {
        operationId: 'op-1'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/workspace/host-commands/revoke - missing operationId fails', async () => {
      const result = await runRoute('POST', '/api/v2/workspace/host-commands/revoke', {});
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });
  });

  describe('Permissions Validation', () => {
    it('POST /api/v2/permissions/resolve - success', async () => {
      const result = await runRoute('POST', '/api/v2/permissions/resolve', {
        id: 'perm-1',
        approved: true,
        surface: 'web',
        userId: 'user-123'
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(200);
    });

    it('POST /api/v2/permissions/resolve - invalid approved type fails', async () => {
      const result = await runRoute('POST', '/api/v2/permissions/resolve', {
        id: 'perm-1',
        approved: 'true' // should be boolean
      });
      expect(result.handled).toBe(true);
      expect(result.responseStatus).toBe(400);
    });
  });
});
