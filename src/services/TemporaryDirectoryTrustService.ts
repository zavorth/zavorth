import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService.js';
import { logger } from '../logger.js';

export interface TemporaryDirectoryTrust {
  trustId: string;
  workspaceId: string;
  resolvedPath: string;
  rootSuffix: string;
  rootHash: string;
  allowedOperations: Array<'filesystem.read' | 'filesystem.write' | 'filesystem.mkdir'>;
  expiresAt: string;
  createdAt: string;
  kind: 'system-temp' | 'user-selected-external';
  displayName: string;
  requestedDurationMinutes?: number;
}

export interface TemporaryDirectoryTrustCheckResult {
  allowed: boolean;
  reason: string;
  /** true when a Task Mandate scope violation was the cause of the block */
  mandateViolation: boolean;
}

/**
 * Fase 21E-A — Temporary System Directory Trust
 *
 * Grants scoped filesystem access (read/write/mkdir) to OS temporary directories
 * (/tmp, os.tmpdir(), %TEMP%, %TMP%) on a per-session in-memory basis.
 *
 * NEVER authorizes:
 *   - command.run
 *   - shell:true
 *   - PTY
 *   - Host Power Mode
 *
 * Scope of this subfase: OS temp dirs only.
 * Downloads, Desktop, home directory, and arbitrary external directories
 * are NOT covered by this subfase — they remain in the roadmap for 21E-B / 21F.
 *
 * TTL: 4 hours maximum per trust entry. In-memory only, not persisted to DB.
 */
export class TemporaryDirectoryTrustService {
  private static instance: TemporaryDirectoryTrustService | null = null;

  /** Per-workspace proposed trusts (pending user approval) */
  private readonly proposedByWorkspace: Map<string, TemporaryDirectoryTrust> = new Map();

  /** Per-workspace active trusts (approved, indexed by trustId) */
  private readonly activeByWorkspace: Map<string, Map<string, TemporaryDirectoryTrust>> = new Map();

  private readonly auditLogger: SecurityAuditLogger;

  private static readonly MAX_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

  /** Dangerous system root paths that are always rejected */
  private static readonly DANGEROUS_ROOTS = new Set([
    'c:/',
    'c:\\',
    '/',
    '/etc',
    '/bin',
    '/usr',
    '/var',
    '/home',
    '/root',
    'c:/windows',
    'c:/windows/system32',
    'c:/program files',
    'c:/program files (x86)',
    'c:/users',
    '/users',
  ]);

  constructor(auditLogger?: SecurityAuditLogger) {
    this.auditLogger = auditLogger || new SecurityAuditLogger(new LogRepository());
    this.loadFromEnv();
  }

  private loadFromEnv(): void {
    const raw = process.env.ZAVORTH_ACTIVE_TEMP_TRUSTS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const trust of parsed) {
            const wsId = trust.workspaceId;
            if (!this.activeByWorkspace.has(wsId)) {
              this.activeByWorkspace.set(wsId, new Map());
            }
            this.activeByWorkspace.get(wsId)!.set(trust.trustId, trust);
          }
        }
      } catch (error) { // ignore logger.warn('[Temporary Directory Trust] JSON parse failed', error); }
    }
  }

  public static getInstance(): TemporaryDirectoryTrustService {
    if (!TemporaryDirectoryTrustService.instance) {
      TemporaryDirectoryTrustService.instance = new TemporaryDirectoryTrustService();
    }
    return TemporaryDirectoryTrustService.instance;
  }

  public static resetInstance(): void {
    TemporaryDirectoryTrustService.instance = null;
  }

  // ── Hashing ──────────────────────────────────────────────────────────────

  private hashValue(val: string): string {
    const key = process.env.ZAVORTH_AUDIT_HASH_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ZAVORTH_AUDIT_HASH_KEY environment variable is required in production.');
      }
      return crypto
        .createHmac('sha256', 'default-zavorth-tmp-trust-key-please-change-in-production')
        .update(val)
        .digest('hex');
    }
    return crypto.createHmac('sha256', key).update(val).digest('hex');
  }

  // ── OS Temp Path Validation ───────────────────────────────────────────────

  /**
   * Returns the canonical set of accepted OS temporary directory prefixes.
   * Case-insensitive (normalized to lowercase).
   */
  private getTempPrefixes(): string[] {
    const candidates = [
      os.tmpdir(),
      '/tmp',
      process.env['TEMP'],
      process.env['TMP'],
    ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0);

    const unique = new Set<string>();
    for (const candidate of candidates) {
      try {
        unique.add(path.resolve(candidate).toLowerCase());
      } catch (error) { // ignore invalid entries logger.warn('[Temporary Directory Trust] operation failed', error); }
    }
    return [...unique];
  }

  /**
   * Returns true if resolvedPath is inside an OS temp directory.
   * Performs case-insensitive comparison (Windows-safe).
   */
  public isValidTempPath(resolvedPath: string): boolean {
    const norm = path.normalize(resolvedPath).toLowerCase();
    const prefixes = this.getTempPrefixes();
    return prefixes.some(prefix => {
      const normPrefix = path.normalize(prefix).toLowerCase();
      return norm === normPrefix || norm.startsWith(normPrefix + path.sep.toLowerCase());
    });
  }

  /**
   * Validates that resolvedPath is NOT inside (or equal to) the active workspace root.
   */
  public isInsideActiveWorkspace(resolvedPath: string, workspaceRoot: string): boolean {
    let realPath: string;
    try {
      realPath = fs.realpathSync(resolvedPath);
    } catch (error) {
    logger.warn('[Temporary Directory Trust] lifecycle operation failed', error);
    realPath = path.resolve(resolvedPath);
  }

    let realWs: string;
    try {
      realWs = fs.realpathSync(workspaceRoot);
    } catch (error) {
    logger.warn('[Temporary Directory Trust] path resolution failed', error);
    realWs = path.resolve(workspaceRoot);
  }

    const normPath = path.normalize(realPath).toLowerCase();
    const normWs = path.normalize(realWs).toLowerCase();
    return normPath === normWs || normPath.startsWith(normWs + path.sep.toLowerCase());
  }

  /**
   * Validates that resolvedPath is not a dangerous system root.
   */
  public isDangerousRoot(resolvedPath: string): boolean {
    const norm = path.normalize(resolvedPath).toLowerCase().replace(/\\/g, '/');
    const withoutDrive = norm.replace(/^[a-z]:/i, '');

    const dangerousSet = new Set([
      '/',
      '/etc',
      '/bin',
      '/usr',
      '/var',
      '/home',
      '/root',
      '/users',
      '/windows',
      '/windows/system32',
      '/program files',
      '/program files (x86)',
    ]);

    if (dangerousSet.has(withoutDrive)) {
      return true;
    }

    if (
      withoutDrive.startsWith('/etc/') ||
      withoutDrive.startsWith('/bin/') ||
      withoutDrive.startsWith('/usr/') ||
      withoutDrive.startsWith('/var/') ||
      withoutDrive.startsWith('/root/') ||
      withoutDrive.startsWith('/windows/') ||
      withoutDrive.startsWith('/program files/') ||
      withoutDrive.startsWith('/program files (x86)/')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Returns true if the path is a drive root (e.g. C:\ or /).
   */
  public isDriveRoot(resolvedPath: string): boolean {
    const norm = path.normalize(resolvedPath).replace(/\\/g, '/');
    return /^[a-z]:\/?$/i.test(norm) || norm === '/';
  }

  /**
   * Resolves and validates a path candidate.
   * Throws a descriptive error if the path is invalid.
   * Returns the resolved real path on success.
   */
  public resolveAndValidatePath(
    rawPath: string,
    workspaceRoot: string,
    kind: 'system-temp' | 'user-selected-external'
  ): string {
    if (!rawPath || typeof rawPath !== 'string') {
      throw new Error('Path is required.');
    }

    const normalized = path.resolve(rawPath);

    let resolved: string;
    try {
      resolved = fs.realpathSync(normalized);
    } catch (error) {
    logger.warn('[Temporary Directory Trust] validation failed', error);
    resolved = normalized;
  }

    const parts = resolved.replace(/\\/g, '/').toLowerCase().split('/');
    if (parts.includes('.git')) {
      throw new Error('Paths containing .git are blocked.');
    }

    if (kind === 'system-temp') {
      if (!this.isValidTempPath(resolved)) {
        throw new Error(
          `Path is not an OS temporary directory. Only paths under ${os.tmpdir()} (or system TEMP/TMP) are accepted.`
        );
      }
    } else if (kind === 'user-selected-external') {
      if (this.isDriveRoot(resolved)) {
        throw new Error('Drive roots are dangerous and not allowed.');
      }

      if (this.isDangerousRoot(resolved)) {
        throw new Error('Dangerous system directories are not allowed.');
      }

      const normHome = path.normalize(os.homedir()).toLowerCase().replace(/\\/g, '/');
      const normResolved = path.normalize(resolved).toLowerCase().replace(/\\/g, '/');
      if (normResolved === normHome) {
        throw new Error('The entire user home directory cannot be trusted. Please select a specific folder.');
      }
    } else {
      throw new Error(`Invalid trust kind: ${kind}`);
    }

    if (this.isInsideActiveWorkspace(resolved, workspaceRoot)) {
      throw new Error(
        'Path is inside the active workspace. Use Trusted Workspace or Task Mandate for workspace paths.'
      );
    }

    return resolved;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Proposes a new Temporary Directory Trust for a workspace.
   * Only one proposed trust can be pending per workspace at a time.
   */
  public proposeTrust(
    workspaceId: string,
    rawPath: string,
    allowedOperations: Array<'filesystem.read' | 'filesystem.write' | 'filesystem.mkdir'>,
    kind: 'system-temp' | 'user-selected-external' = 'system-temp',
    durationMinutes?: number
  ): TemporaryDirectoryTrust {
    const workspaceRoot = WorkspaceResolver.resolve(workspaceId);
    const resolvedPath = this.resolveAndValidatePath(rawPath, workspaceRoot, kind);

    // Validate operations — command.run is explicitly forbidden
    const allowed = ['filesystem.read', 'filesystem.write', 'filesystem.mkdir'];
    for (const op of allowedOperations) {
      if (!allowed.includes(op)) {
        throw new Error(
          `Operation '${op}' is not allowed in Temporary Directory Trust (21E-B). Only filesystem.read, filesystem.write, and filesystem.mkdir are allowed.`
        );
      }
    }
    if (allowedOperations.length === 0) {
      throw new Error('At least one operation must be specified.');
    }

    const trustId = `tmp-trust-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const rootHash = this.hashValue(resolvedPath);
    const rootSuffix = path.basename(resolvedPath) || 'tmp';
    const displayName =
      kind === 'system-temp' ? `System Temp (${rootSuffix})` : `External Folder (${rootSuffix})`;

    const trust: TemporaryDirectoryTrust = {
      trustId,
      workspaceId,
      resolvedPath,
      rootSuffix,
      rootHash,
      allowedOperations,
      expiresAt: '', // set when approved
      createdAt,
      kind,
      displayName,
      requestedDurationMinutes: durationMinutes,
    };

    this.proposedByWorkspace.set(workspaceId, trust);

    this.auditLogger.logWorkspaceEvent({
      event: 'tmp_dir_trust_requested',
      workspaceId,
      toolName: 'workspace.temp_dir_trust.propose',
      operation: 'propose',
      metadata: {
        trustId,
        kind,
        rootHash,
        rootSuffix,
        displayName,
        allowedOperations,
      },
    });

    return trust;
  }

  /**
   * Resolves (approves or denies) the pending proposed trust for a workspace.
   */
  public resolveTrust(workspaceId: string, trustId: string, approved: boolean): TemporaryDirectoryTrust | null {
    const proposed = this.proposedByWorkspace.get(workspaceId);
    if (!proposed || proposed.trustId !== trustId) {
      return null;
    }

    this.proposedByWorkspace.delete(workspaceId);

    if (!approved) {
      this.auditLogger.logWorkspaceEvent({
        event: 'tmp_dir_trust_denied',
        workspaceId,
        toolName: 'workspace.temp_dir_trust',
        operation: 'resolve',
        metadata: {
          trustId,
          kind: proposed.kind,
          rootHash: proposed.rootHash,
          rootSuffix: proposed.rootSuffix,
          displayName: proposed.displayName,
        },
      });
      return null;
    }

    const durationMs = proposed.requestedDurationMinutes
      ? Math.min(proposed.requestedDurationMinutes, 240) * 60 * 1000
      : TemporaryDirectoryTrustService.MAX_TTL_MS;

    const expiresAt = new Date(Date.now() + durationMs).toISOString();
    const active: TemporaryDirectoryTrust = { ...proposed, expiresAt };

    if (!this.activeByWorkspace.has(workspaceId)) {
      this.activeByWorkspace.set(workspaceId, new Map());
    }
    this.activeByWorkspace.get(workspaceId)!.set(trustId, active);

    this.auditLogger.logWorkspaceEvent({
      event: 'tmp_dir_trust_approved',
      workspaceId,
      toolName: 'workspace.temp_dir_trust',
      operation: 'resolve',
      metadata: {
        trustId,
        kind: active.kind,
        rootHash: active.rootHash,
        rootSuffix: active.rootSuffix,
        displayName: active.displayName,
        expiresAt,
      },
    });

    return active;
  }

  /**
   * Revokes a specific active Temporary Directory Trust.
   */
  public revokeTrust(workspaceId: string, trustId: string): void {
    const map = this.activeByWorkspace.get(workspaceId);
    const trust = map?.get(trustId);
    if (trust) {
      map!.delete(trustId);
      this.auditLogger.logWorkspaceEvent({
        event: 'tmp_dir_trust_revoked',
        workspaceId,
        toolName: 'workspace.temp_dir_trust',
        operation: 'revoke',
        metadata: {
          trustId,
          kind: trust.kind,
          rootHash: trust.rootHash,
          rootSuffix: trust.rootSuffix,
          displayName: trust.displayName,
        },
      });
    }
    // Also clear proposed if it matches
    const pending = this.proposedByWorkspace.get(workspaceId);
    if (pending && pending.trustId === trustId) {
      this.proposedByWorkspace.delete(workspaceId);
    }
  }

  /**
   * Revokes ALL active trusts for a workspace (e.g., when workspace is closed/revoked).
   */
  public revokeAllForWorkspace(workspaceId: string): void {
    const map = this.activeByWorkspace.get(workspaceId);
    if (map) {
      for (const [trustId, trust] of map.entries()) {
        this.auditLogger.logWorkspaceEvent({
          event: 'tmp_dir_trust_revoked',
          workspaceId,
          toolName: 'workspace.temp_dir_trust',
          operation: 'revoke-all',
          metadata: {
            trustId,
            kind: trust.kind,
            rootHash: trust.rootHash,
            rootSuffix: trust.rootSuffix,
            displayName: trust.displayName,
          },
        });
      }
      map.clear();
    }
    this.proposedByWorkspace.delete(workspaceId);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  public getProposedTrust(workspaceId: string): TemporaryDirectoryTrust | null {
    return this.proposedByWorkspace.get(workspaceId) || null;
  }

  /**
   * Returns all active, non-expired trusts for a workspace.
   * Expired trusts are purged and their expiry is audited.
   */
  public getActiveTrusts(workspaceId: string): TemporaryDirectoryTrust[] {
    const map = this.activeByWorkspace.get(workspaceId);
    if (!map) return [];

    const now = Date.now();
    const valid: TemporaryDirectoryTrust[] = [];

    for (const [trustId, trust] of map.entries()) {
      if (now > Date.parse(trust.expiresAt)) {
        map.delete(trustId);
        this.auditLogger.logWorkspaceEvent({
          event: 'tmp_dir_trust_expired',
          workspaceId,
          toolName: 'workspace.temp_dir_trust',
          operation: 'check-expiry',
          metadata: {
            trustId,
            kind: trust.kind,
            rootHash: trust.rootHash,
            rootSuffix: trust.rootSuffix,
            displayName: trust.displayName,
          },
        });
      } else {
        valid.push(trust);
      }
    }

    return valid;
  }

  public resolveRealpath(filePath: string): string {
    return fs.realpathSync(filePath);
  }

  // ── Access Decision ────────────────────────────────────────────────────────

  /**
   * Checks if a given absolute path and operation is covered by an active Temporary Directory Trust.
   *
   * Mandate-first logic:
   *   - If a Task Mandate is active and the operation+path VIOLATES the mandate,
   *     we return { allowed: false, mandateViolation: true } WITHOUT falling back to temp trust.
   *   - If a Task Mandate is active and covers the operation+path (or there is no mandate),
   *     we proceed to check the Temporary Directory Trust.
   *
   * command.run is never authorized here.
   */
  public checkPathAccess(
    workspaceId: string,
    workspaceRoot: string,
    absolutePath: string,
    operation: 'filesystem.read' | 'filesystem.write' | 'filesystem.mkdir'
  ): TemporaryDirectoryTrustCheckResult {
    // ── Task Mandate restrictive check ────────────────────────────────────
    const mandateService = WorkspaceTaskMandateService.getInstance();
    const activeMandate = mandateService.getActiveMandate(workspaceId);

    if (activeMandate) {
      // Check if the operation+path falls within the mandate's scope
      const mandateCheck = mandateService.checkWriteApproval(
        workspaceId,
        workspaceRoot,
        absolutePath,
        operation as 'filesystem.write' | 'filesystem.mkdir' | 'filesystem.move'
      );

      if (mandateCheck.blockFallback && !mandateCheck.allowed) {
        // The mandate scope covers this path but denies it — block without fallback
        this.auditLogger.logWorkspaceEvent({
          event: 'tmp_dir_trust_scope_block',
          workspaceId,
          toolName: 'workspace.temp_dir_trust',
          operation,
          reason: `Task Mandate active — operation blocked by mandate scope violation, no fallback to temp trust`,
          metadata: {
            rootHash: this.hashValue(absolutePath),
            rootSuffix: path.basename(absolutePath),
            mandateViolation: true,
          },
        });
        return {
          allowed: false,
          reason: 'Task Mandate scope violation — fallback to Temporary Directory Trust is blocked',
          mandateViolation: true,
        };
      }
    }

    // ── Temporary Directory Trust check ────────────────────────────────────
    const trusts = this.getActiveTrusts(workspaceId);
    
    let realTarget: string;
    try {
      realTarget = this.resolveRealpath(absolutePath);
    } catch {
      try {
        const parent = path.dirname(absolutePath);
        const resolvedParent = this.resolveRealpath(parent);
        realTarget = path.join(resolvedParent, path.basename(absolutePath));
      } catch (error) {
    logger.warn('[Temporary Directory Trust] path resolution failed', error);
    realTarget = path.resolve(absolutePath);
  }
    }

    const normTarget = path.normalize(realTarget).toLowerCase();
    const normTargetSyntactic = path.normalize(absolutePath).toLowerCase();

    for (const trust of trusts) {
      const normTrust = path.normalize(trust.resolvedPath).toLowerCase();
      
      const isSyntacticallyContained =
        normTargetSyntactic === normTrust ||
        normTargetSyntactic.startsWith(normTrust + path.sep.toLowerCase());

      const isCanonicallyContained =
        normTarget === normTrust ||
        normTarget.startsWith(normTrust + path.sep.toLowerCase());

      if (isSyntacticallyContained && !isCanonicallyContained) {
        this.auditLogger.logWorkspaceEvent({
          event: 'tmp_dir_trust_toctou_denial',
          workspaceId,
          toolName: 'workspace.temp_dir_trust',
          operation,
          reason: 'TOCTOU bypass attempt detected: canonical path escaped trusted directory root',
          metadata: {
            requestedPath: absolutePath,
            resolvedPath: realTarget,
            trustedRoot: trust.resolvedPath,
          },
        });
        return {
          allowed: false,
          reason: 'TOCTOU bypass attempt detected: canonical path escaped trusted directory root',
          mandateViolation: false,
        };
      }

      if (isCanonicallyContained && trust.allowedOperations.includes(operation)) {
        this.auditLogger.logWorkspaceEvent({
          event: 'tmp_dir_trust_auto_approved',
          workspaceId,
          toolName: 'workspace.temp_dir_trust',
          operation,
          metadata: {
            trustId: trust.trustId,
            kind: trust.kind,
            rootHash: this.hashValue(absolutePath),
            rootSuffix: path.basename(absolutePath),
            displayName: trust.displayName,
          },
        });
        return {
          allowed: true,
          reason: `Auto-approved by Temporary Directory Trust (${trust.trustId})`,
          mandateViolation: false,
        };
      }
    }

    return {
      allowed: false,
      reason: 'No active Temporary Directory Trust covers this path and operation',
      mandateViolation: false,
    };
  }
}
