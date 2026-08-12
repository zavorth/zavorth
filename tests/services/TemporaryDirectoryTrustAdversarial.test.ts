import { TemporaryDirectoryTrustService } from '../../src/services/TemporaryDirectoryTrustService';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger';
import { WorkspaceResolver } from '../../src/security/WorkspaceResolver';
import os from 'os';
import path from 'path';
import fs from 'fs';

jest.mock('../../src/services/SecurityAuditLogger');
jest.mock('../../src/security/WorkspaceResolver');

describe('TemporaryDirectoryTrustAdversarial', () => {
  let service: TemporaryDirectoryTrustService;
  let mockAuditLogger: jest.Mocked<SecurityAuditLogger>;
  const tempRootsCreated: string[] = [];

  beforeEach(() => {
    mockAuditLogger = new SecurityAuditLogger({} as any) as jest.Mocked<SecurityAuditLogger>;
    service = new TemporaryDirectoryTrustService(mockAuditLogger);
  });

  afterEach(() => {
    tempRootsCreated.forEach((dir) => {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (error: unknown) {}
    });
    tempRootsCreated.length = 0;
  });

  it('deve permitir acesso normal se o caminho canonical resolvido continuar dentro do root aprovado', () => {
    const workspaceId = 'test-workspace';
    const workspaceRoot = path.resolve(os.tmpdir(), 'zavorth-ws-root-mock-ok');
    const tempRoot = path.resolve(os.tmpdir(), 'zavorth-temp-ok');
    
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });
    tempRootsCreated.push(tempRoot, workspaceRoot);

    (WorkspaceResolver.resolve as jest.Mock).mockReturnValue(workspaceRoot);

    const trust = service.proposeTrust(
      workspaceId,
      tempRoot,
      ['filesystem.read', 'filesystem.write'],
      'system-temp',
      60
    );

    service.resolveTrust(workspaceId, trust.trustId, true);

    const targetFile = path.join(tempRoot, 'file.txt');
    const check = service.checkPathAccess(workspaceId, workspaceRoot, targetFile, 'filesystem.read');
    expect(check.allowed).toBe(true);
  });

  it('deve negar acesso (TOCTOU) se o caminho canonical mudou (escapou do root aprovado) antes do uso', () => {
    const workspaceId = 'test-workspace';
    const workspaceRoot = path.resolve(os.tmpdir(), 'zavorth-ws-root-mock-toctou');
    const tempRoot = path.resolve(os.tmpdir(), 'zavorth-temp-toctou');
    
    fs.mkdirSync(tempRoot, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });
    tempRootsCreated.push(tempRoot, workspaceRoot);

    (WorkspaceResolver.resolve as jest.Mock).mockReturnValue(workspaceRoot);

    const trust = service.proposeTrust(
      workspaceId,
      tempRoot,
      ['filesystem.read', 'filesystem.write'],
      'system-temp',
      60
    );

    service.resolveTrust(workspaceId, trust.trustId, true);

    const targetFile = path.join(tempRoot, 'escaped-link');
    const dangerousPath = process.platform === 'win32' ? 'c:/windows/system32/cmd.exe' : '/etc/passwd';
    
    // Sobrescrever resolveRealpath para simular a mudanca de symlink / TOCTOU
    jest.spyOn(service, 'resolveRealpath').mockImplementation((p) => {
      if (p === targetFile) {
        return dangerousPath;
      }
      return fs.realpathSync(p);
    });

    const check = service.checkPathAccess(workspaceId, workspaceRoot, targetFile, 'filesystem.read');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('TOCTOU bypass attempt detected');

    expect(mockAuditLogger.logWorkspaceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'tmp_dir_trust_toctou_denial',
        workspaceId,
      })
    );
  });
});
