import os from 'os';
import path from 'path';
import { TemporaryDirectoryTrustService } from '../../src/services/TemporaryDirectoryTrustService.js';
import { WorkspaceTaskMandateService } from '../../src/services/WorkspaceTaskMandateService.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

const osTemp = os.tmpdir();
const validTempPath = path.join(osTemp, 'zavorth-test-tmp-trust');
const validSubPath = path.join(validTempPath, 'subdir', 'file.txt');
const WORKSPACE_ROOT = '/fake/workspace/root';
const WORKSPACE_ID = 'root';

function makeMockAuditLogger() {
  return {
    logWorkspaceEvent: jest.fn(),
  } as any;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  TemporaryDirectoryTrustService.resetInstance();
  WorkspaceTaskMandateService.resetInstance();
  jest.clearAllMocks();
});

// Mock WorkspaceResolver
jest.mock('../../src/security/WorkspaceResolver.js', () => ({
  WorkspaceResolver: {
    resolve: jest.fn((workspaceId) => {
      if (workspaceId === 'root' || !workspaceId) return WORKSPACE_ROOT;
      return workspaceId; // simple echo for resolving external mock folders
    }),
    ensurePathInsideWorkspace: jest.fn((root: string, p: string) => path.resolve(root, p)),
    isWorkspaceAllowed: jest.fn(() => true),
    getAllowedRoots: jest.fn(() => [WORKSPACE_ROOT]),
  },
}));

// Mock fs to avoid real filesystem checks in isValidTempPath / resolveAndValidatePath
jest.mock('fs', () => {
  const real = jest.requireActual('fs');
  return {
    ...real,
    realpathSync: jest.fn((p: string) => path.resolve(p)),
    existsSync: jest.fn(() => true),
    statSync: jest.fn(() => ({ isDirectory: () => true, isFile: () => false })),
  };
});

// ── isValidTempPath ────────────────────────────────────────────────────────────

describe('TemporaryDirectoryTrustService.isValidTempPath', () => {
  it('returns true for a path inside os.tmpdir()', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(svc.isValidTempPath(validTempPath)).toBe(true);
  });

  it('returns true for os.tmpdir() itself', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(svc.isValidTempPath(osTemp)).toBe(true);
  });

  it('returns false for a workspace path', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(svc.isValidTempPath('/fake/workspace/root/src')).toBe(false);
  });
});

// ── isInsideActiveWorkspace ────────────────────────────────────────────────────

describe('TemporaryDirectoryTrustService.isInsideActiveWorkspace', () => {
  it('returns true for path inside workspace', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(svc.isInsideActiveWorkspace('/fake/workspace/root/src', '/fake/workspace/root')).toBe(true);
  });

  it('returns false for path outside workspace', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(svc.isInsideActiveWorkspace(validTempPath, '/fake/workspace/root')).toBe(false);
  });

  it('returns true for workspace root itself', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(svc.isInsideActiveWorkspace('/fake/workspace/root', '/fake/workspace/root')).toBe(true);
  });
});

// ── proposeTrust ──────────────────────────────────────────────────────────────

describe('TemporaryDirectoryTrustService.proposeTrust', () => {
  it('creates a proposed trust for a valid temp path', () => {
    const audit = makeMockAuditLogger();
    const svc = new TemporaryDirectoryTrustService(audit);

    const trust = svc.proposeTrust(WORKSPACE_ID, validTempPath, ['filesystem.read']);
    expect(trust.trustId).toMatch(/^tmp-trust-/);
    expect(trust.allowedOperations).toEqual(['filesystem.read']);
    expect(trust.expiresAt).toBe(''); // not set until resolved
    expect(trust.kind).toBe('system-temp');
    expect(trust.displayName).toContain('System Temp');
    expect(audit.logWorkspaceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tmp_dir_trust_requested' })
    );
  });

  it('creates a proposed trust for user-selected-external folder (Downloads)', () => {
    const audit = makeMockAuditLogger();
    const svc = new TemporaryDirectoryTrustService(audit);

    const downloads = path.join(os.homedir(), 'Downloads');
    const trust = svc.proposeTrust(WORKSPACE_ID, downloads, ['filesystem.read'], 'user-selected-external');
    expect(trust.kind).toBe('user-selected-external');
    expect(trust.displayName).toContain('Downloads');
  });

  it('throws if command.run is requested', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(() =>
      svc.proposeTrust(WORKSPACE_ID, validTempPath, ['command.run' as any])
    ).toThrow(/command.run/i);
  });

  it('throws if allowedOperations is empty', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(() => svc.proposeTrust(WORKSPACE_ID, validTempPath, [])).toThrow(/At least one operation/);
  });
});

// ── resolveTrust ──────────────────────────────────────────────────────────────

describe('TemporaryDirectoryTrustService.resolveTrust', () => {
  it('approves and activates a trust with default TTL (4h)', () => {
    const audit = makeMockAuditLogger();
    const svc = new TemporaryDirectoryTrustService(audit);
    const trust = svc.proposeTrust(WORKSPACE_ID, validTempPath, ['filesystem.read']);

    const active = svc.resolveTrust(WORKSPACE_ID, trust.trustId, true);
    expect(active).not.toBeNull();
    expect(active!.expiresAt).toBeTruthy();
    const diff = Date.parse(active!.expiresAt) - Date.now();
    // Default TTL is 4h
    expect(diff).toBeGreaterThan(3.9 * 60 * 60 * 1000);
    expect(audit.logWorkspaceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tmp_dir_trust_approved' })
    );
  });

  it('supports custom TTL durationMinutes up to 240', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    const trust = svc.proposeTrust(WORKSPACE_ID, validTempPath, ['filesystem.read'], 'system-temp', 60);

    const active = svc.resolveTrust(WORKSPACE_ID, trust.trustId, true)!;
    const diff = Date.parse(active.expiresAt) - Date.now();
    // Capped around 60 minutes
    expect(diff).toBeLessThanOrEqual(61 * 60 * 1000);
    expect(diff).toBeGreaterThan(58 * 60 * 1000);
  });

  it('caps custom TTL durationMinutes at 240', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    const trust = svc.proposeTrust(WORKSPACE_ID, validTempPath, ['filesystem.read'], 'system-temp', 1000);

    const active = svc.resolveTrust(WORKSPACE_ID, trust.trustId, true)!;
    const diff = Date.parse(active.expiresAt) - Date.now();
    // Should be capped at 4h (240 minutes)
    expect(diff).toBeLessThanOrEqual(241 * 60 * 1000);
  });

  it('denies a trust and does not activate it', () => {
    const audit = makeMockAuditLogger();
    const svc = new TemporaryDirectoryTrustService(audit);
    const trust = svc.proposeTrust(WORKSPACE_ID, validTempPath, ['filesystem.read']);

    const result = svc.resolveTrust(WORKSPACE_ID, trust.trustId, false);
    expect(result).toBeNull();
    expect(svc.getActiveTrusts(WORKSPACE_ID)).toHaveLength(0);
    expect(audit.logWorkspaceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tmp_dir_trust_denied' })
    );
  });
});

// ── checkPathAccess ────────────────────────────────────────────────────────────

describe('TemporaryDirectoryTrustService.checkPathAccess', () => {
  it('allows read/write inside active trust', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    const trust = svc.proposeTrust(WORKSPACE_ID, validTempPath, ['filesystem.read', 'filesystem.write']);
    svc.resolveTrust(WORKSPACE_ID, trust.trustId, true);

    const resultRead = svc.checkPathAccess(WORKSPACE_ID, WORKSPACE_ROOT, validSubPath, 'filesystem.read');
    expect(resultRead.allowed).toBe(true);

    const resultWrite = svc.checkPathAccess(WORKSPACE_ID, WORKSPACE_ROOT, validSubPath, 'filesystem.write');
    expect(resultWrite.allowed).toBe(true);
  });

  // ── Task Mandate integration (Narrowing Restritivo) ───────────────────────

  it('blocks and sets mandateViolation=true when active mandate excludes the path (Downloads vs src/components)', () => {
    const audit = makeMockAuditLogger();
    const svc = new TemporaryDirectoryTrustService(audit);

    // Propose and approve Downloads trust
    const downloads = path.join(os.homedir(), 'Downloads');
    const trust = svc.proposeTrust(WORKSPACE_ID, downloads, ['filesystem.write'], 'user-selected-external');
    svc.resolveTrust(WORKSPACE_ID, trust.trustId, true);

    const targetFileInDownloads = path.join(downloads, 'report.txt');

    // Mandate active ONLY covering src/components
    const mandateSvc = WorkspaceTaskMandateService.getInstance();
    jest.spyOn(mandateSvc, 'getActiveMandate').mockReturnValue({
      mandateId: 'test-mandate-id',
      workspaceId: WORKSPACE_ID,
      description: 'Test mandate',
      targetDirectories: [WORKSPACE_ROOT + '/src/components'],
      allowedOperations: ['filesystem.write'],
      allowedBinaries: [],
      maxRiskLevel: 'LOW',
      allowPackageInstall: false,
      allowNetwork: false,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    jest.spyOn(mandateSvc, 'checkWriteApproval').mockReturnValue({
      allowed: false,
      reason: 'Path is outside mandate target directories',
      blockFallback: true,
    });

    const result = svc.checkPathAccess(WORKSPACE_ID, WORKSPACE_ROOT, targetFileInDownloads, 'filesystem.write');
    expect(result.allowed).toBe(false);
    expect(result.mandateViolation).toBe(true);
    expect(audit.logWorkspaceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tmp_dir_trust_scope_block' })
    );
  });

  it('allows access when active mandate covers the path AND temp trust also covers it', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    const downloads = path.join(os.homedir(), 'Downloads');
    const trust = svc.proposeTrust(WORKSPACE_ID, downloads, ['filesystem.write'], 'user-selected-external');
    svc.resolveTrust(WORKSPACE_ID, trust.trustId, true);

    const targetFileInDownloads = path.join(downloads, 'report.txt');

    const mandateSvc = WorkspaceTaskMandateService.getInstance();
    jest.spyOn(mandateSvc, 'getActiveMandate').mockReturnValue({
      mandateId: 'test-mandate-id',
      workspaceId: WORKSPACE_ID,
      description: 'Test mandate covering Downloads',
      targetDirectories: [downloads],
      allowedOperations: ['filesystem.write'],
      allowedBinaries: [],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: false,
      allowNetwork: false,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    jest.spyOn(mandateSvc, 'checkWriteApproval').mockReturnValue({
      allowed: true,
      reason: 'Approved by mandate',
      blockFallback: true,
    });

    const result = svc.checkPathAccess(WORKSPACE_ID, WORKSPACE_ROOT, targetFileInDownloads, 'filesystem.write');
    expect(result.allowed).toBe(true);
  });
});

// ── Security: rejections of dangerous roots and homedir ──────────────────────

describe('TemporaryDirectoryTrustService security rejections', () => {
  it('rejects drive roots (C:, D:, /)', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(() => svc.resolveAndValidatePath('C:\\', WORKSPACE_ROOT, 'user-selected-external')).toThrow(/Drive roots/);
    expect(() => svc.resolveAndValidatePath('/', WORKSPACE_ROOT, 'user-selected-external')).toThrow(/Drive roots/);
  });

  it('rejects critical OS folders (C:\\Windows, /etc, etc.)', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(() => svc.resolveAndValidatePath('c:\\windows', WORKSPACE_ROOT, 'user-selected-external')).toThrow(/Dangerous system/);
    expect(() => svc.resolveAndValidatePath('/etc', WORKSPACE_ROOT, 'user-selected-external')).toThrow(/Dangerous system/);
    expect(() => svc.resolveAndValidatePath('c:\\program files', WORKSPACE_ROOT, 'user-selected-external')).toThrow(/Dangerous system/);
  });

  it('rejects entire user home directory (os.homedir())', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(() => svc.resolveAndValidatePath(os.homedir(), WORKSPACE_ROOT, 'user-selected-external')).toThrow(/entire user home/);
  });

  it('rejects any path containing .git or resolving to .git', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    const downloads = path.join(os.homedir(), 'Downloads');
    expect(() => svc.resolveAndValidatePath(path.join(downloads, '.git'), WORKSPACE_ROOT, 'user-selected-external')).toThrow(/\.git/);
    expect(() => svc.resolveAndValidatePath(path.join(downloads, '.git', 'config'), WORKSPACE_ROOT, 'user-selected-external')).toThrow(/\.git/);
  });

  it('rejects active workspace or any path inside it', () => {
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(() => svc.resolveAndValidatePath(WORKSPACE_ROOT, WORKSPACE_ROOT, 'user-selected-external')).toThrow(/active workspace/);
    expect(() => svc.resolveAndValidatePath(path.join(WORKSPACE_ROOT, 'src'), WORKSPACE_ROOT, 'user-selected-external')).toThrow(/active workspace/);
  });
});

// ── Negative execution checks ────────────────────────────────────────────────

describe('TemporaryDirectoryTrustService negative execution checks', () => {
  it('does not authorize command.run, shell:true, PTY, or Host Power Mode', () => {
    // Assert that the allowedOperations union never permits execution
    const svc = new TemporaryDirectoryTrustService(makeMockAuditLogger());
    expect(() =>
      svc.proposeTrust(WORKSPACE_ID, validTempPath, ['command.run' as any])
    ).toThrow();

    expect(() =>
      svc.proposeTrust(WORKSPACE_ID, validTempPath, ['shell:true' as any])
    ).toThrow();

    expect(() =>
      svc.proposeTrust(WORKSPACE_ID, validTempPath, ['PTY' as any])
    ).toThrow();

    expect(() =>
      svc.proposeTrust(WORKSPACE_ID, validTempPath, ['Host Power Mode' as any])
    ).toThrow();
  });
});
