import { asErrorLike } from '../utils/errorLike';

import * as http from 'http';
import path from 'path';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { WorkspaceCommandApprovalService } from './WorkspaceCommandApprovalService.js';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService.js';
import { TemporaryDirectoryTrustService } from './TemporaryDirectoryTrustService.js';
import { PtySessionService } from './PtySessionService.js';
import { PtySessionApprovalService } from './PtySessionApprovalService.js';
import { PtyInputApprovalService } from './PtyInputApprovalService.js';
import { Database } from '../storage/Database.js';

import * as schemas from '../domain/validation/controlSchemas.js';

import type { ZavorthControlCoreRouteDeps } from './ZavorthControlCoreRouteService.js';

export type ZavorthControlRouteInput = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  pathname: string;
  deps: ZavorthControlCoreRouteDeps;
};

type WorkspaceRouteContext = {
  validateWorkspaceSession: (workspaceId: string) => boolean;
};

export async function handleControlWorkspaceTrustRoutes(
  input: ZavorthControlRouteInput,
  context: WorkspaceRouteContext,
): Promise<boolean | null> {
  const { req, res, url, pathname, deps } = input;
  if (pathname === '/api/v2/workspace/task-mandates/pending' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
        return true;
      }

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
        return true;
      }
      const activeWorkspace = WorkspaceResolver.resolve(null);

      const mandateService = WorkspaceTaskMandateService.getInstance();
      const proposed = mandateService.getProposedMandate(workspaceId);

      if (!proposed) {
        deps.writeJson(res, { ok: true, proposed: null });
        return true;
      }

      // Relativize targetDirectories
      const relativeTargets = proposed.targetDirectories.map(dir => {
        const relative = path.relative(activeWorkspace, dir);
        return relative.replace(/\\/g, '/');
      });

      deps.writeJson(res, {
        ok: true,
        proposed: {
          ...proposed,
          targetDirectories: relativeTargets
        }
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/task-mandates/active' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
        return true;
      }

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
        return true;
      }
      const activeWorkspace = WorkspaceResolver.resolve(null);

      const mandateService = WorkspaceTaskMandateService.getInstance();
      const active = mandateService.getActiveMandate(workspaceId);

      if (!active) {
        deps.writeJson(res, { ok: true, active: null });
        return true;
      }

      // Relativize targetDirectories
      const relativeTargets = active.targetDirectories.map(dir => {
        const relative = path.relative(activeWorkspace, dir);
        return relative.replace(/\\/g, '/');
      });

      deps.writeJson(res, {
        ok: true,
        active: {
          ...active,
          targetDirectories: relativeTargets
        }
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/task-mandates/resolve' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.resolveTaskMandateSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, approved } = parsed.data;

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
        return true;
      }

      const mandateService = WorkspaceTaskMandateService.getInstance();
      const resolved = mandateService.resolveMandate(workspaceId, !!approved);

      deps.writeJson(res, { ok: true, resolved: resolved ? { mandateId: resolved.mandateId, expiresAt: resolved.expiresAt } : null });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/task-mandates/revoke' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.revokeTaskMandateSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId } = parsed.data;

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
        return true;
      }

      const mandateService = WorkspaceTaskMandateService.getInstance();
      mandateService.revokeMandate(workspaceId);

      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  // ── Temporary Directory Trust routes ─────────────────────────────
  // GET /api/v2/workspace/temporary-directory-trusts/pendingisworkspaceId=X
  if (pathname === '/api/v2/workspace/temporary-directory-trusts/pending' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
        return true;
      }

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
        return true;
      }

      const trustService = TemporaryDirectoryTrustService.getInstance();
      const proposed = trustService.getProposedTrust(workspaceId);

      deps.writeJson(res, {
        ok: true,
        proposed: proposed
          ? {
              trustId: proposed.trustId,
              workspaceId: proposed.workspaceId,
              rootSuffix: proposed.rootSuffix,
              rootHash: proposed.rootHash,
              kind: proposed.kind,
              displayName: proposed.displayName,
              allowedOperations: proposed.allowedOperations,
              createdAt: proposed.createdAt,
            }
          : null,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  // GET /api/v2/workspace/temporary-directory-trusts/activeisworkspaceId=X
  if (pathname === '/api/v2/workspace/temporary-directory-trusts/active' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
        return true;
      }

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
        return true;
      }

      const trustService = TemporaryDirectoryTrustService.getInstance();
      const trusts = trustService.getActiveTrusts(workspaceId);

      deps.writeJson(res, {
        ok: true,
        trusts: trusts.map(t => ({
          trustId: t.trustId,
          workspaceId: t.workspaceId,
          rootSuffix: t.rootSuffix,
          rootHash: t.rootHash,
          kind: t.kind,
          displayName: t.displayName,
          allowedOperations: t.allowedOperations,
          expiresAt: t.expiresAt,
          createdAt: t.createdAt,
        })),
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  // POST /api/v2/workspace/temporary-directory-trusts/resolve  { workspaceId, trustId, approved }
  if (pathname === '/api/v2/workspace/temporary-directory-trusts/resolve' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.resolveTempDirTrustSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, trustId, approved } = parsed.data;

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
        return true;
      }

      const trustService = TemporaryDirectoryTrustService.getInstance();
      const resolved = trustService.resolveTrust(workspaceId, trustId, !!approved);

      deps.writeJson(res, {
        ok: true,
        resolved: resolved
          ? {
              trustId: resolved.trustId,
              expiresAt: resolved.expiresAt,
              rootSuffix: resolved.rootSuffix,
              rootHash: resolved.rootHash,
              kind: resolved.kind,
              displayName: resolved.displayName,
            }
          : null,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  // POST /api/v2/workspace/temporary-directory-trusts/revoke  { workspaceId, trustId }
  if (pathname === '/api/v2/workspace/temporary-directory-trusts/revoke' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.revokeTempDirTrustSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, trustId } = parsed.data;

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
        return true;
      }

      const trustService = TemporaryDirectoryTrustService.getInstance();
      trustService.revokeTrust(workspaceId, trustId);

      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/command-approvals/pending' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      const db = await Database.getInstance();
      const now = new Date().toISOString();

      let rows: CommandApprovalRow[];
      if (workspaceId) {
        rows = db.all<CommandApprovalRow>(
          'SELECT operation_id, workspace_id, command, created_at, expires_at FROM workspace_command_approvals WHERE approved = 0 AND expires_at > ? AND workspace_id = ?',
          [now, workspaceId]
        );
      } else {
        rows = db.all<CommandApprovalRow>(
          'SELECT operation_id, workspace_id, command, created_at, expires_at FROM workspace_command_approvals WHERE approved = 0 AND expires_at > ?',
          [now]
        );
      }

      const data = rows.map(row => ({
        operationId: row.operation_id,
        workspaceId: row.workspace_id,
        command: row.command,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }));

      deps.writeJson(res, { ok: true, data });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/command-approvals/payload' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const operationId = url.searchParams.get('operationId');
      if (!operationId) {
        deps.writeJson(res, { ok: false, error: 'operationId parameter is required' }, 400);
        return true;
      }

      const db = await Database.getInstance();
      const entry = db.get<{ operation_id: string; workspace_id: string; command: string; approved: number; expires_at: string; created_at: string }>(
        'SELECT operation_id, workspace_id, command, approved, expires_at, created_at FROM workspace_command_approvals WHERE operation_id = ?',
        [operationId]
      );

      if (!entry) {
        deps.writeJson(res, { ok: false, error: 'Operation not found' }, 404);
        return true;
      }

      if (new Date(entry.expires_at) <= new Date()) {
        deps.writeJson(res, { ok: false, error: 'Operation expired' }, 410);
        return true;
      }

      deps.writeJson(res, {
        ok: true,
        data: {
          operationId: entry.operation_id,
          workspaceId: entry.workspace_id,
          command: entry.command,
          approved: entry.approved === 1,
          createdAt: entry.created_at,
          expiresAt: entry.expires_at
        }
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/command-approvals/resolve' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.resolveCommandApprovalSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { operationId, decision } = parsed.data;

      const approvalService = new WorkspaceCommandApprovalService();
      if (decision === 'approve') {
        await approvalService.approveOperation(operationId);
      } else if (decision === 'deny') {
        await approvalService.denyOperation(operationId);
      } else {
        deps.writeJson(res, { ok: false, error: 'Invalid decision' }, 400);
        return true;
      }

      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/pty/pending-sessions' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = new URL(req.url || '/', 'http://localhost').searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId required' }, 400);
        return true;
      }
      const srv = new PtySessionApprovalService();
      const pending = await srv.getPendingProposals(workspaceId);
      deps.writeJson(res, { ok: true, data: pending });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/pty/resolve-session' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.resolvePtySessionSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, sessionId, approve } = parsed.data;

      const srv = new PtySessionApprovalService();
      await srv.resolveProposal(workspaceId, sessionId, approve);
      // Residual: surface attach token so clients can reattach after approve.
      const attachToken = approve
        ? PtySessionService.getInstance().getAttachToken(sessionId)
        : null;
      const registry = approve
        ? PtySessionService.getInstance().getRegistryEntry(sessionId)
        : null;
      deps.writeJson(res, {
        ok: true,
        data: {
          sessionId,
          approved: Boolean(approve),
          attachToken,
          registry,
        },
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/pty/pending-inputs' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = new URL(req.url || '/', 'http://localhost').searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId required' }, 400);
        return true;
      }
      const srv = new PtyInputApprovalService();
      const pending = await srv.getPendingProposals(workspaceId);
      deps.writeJson(res, { ok: true, data: pending });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/pty/resolve-input' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.resolvePtyInputSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, operationId, approve, strongConfirmationInput } = parsed.data;

      const inputSrv = new PtyInputApprovalService();
      await inputSrv.resolveProposal(workspaceId, operationId, approve, strongConfirmationInput);

      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/pty/output' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = new URL(req.url || '/', 'http://localhost').searchParams.get('workspaceId');
      const sessionId = new URL(req.url || '/', 'http://localhost').searchParams.get('sessionId');
      const afterSeqStr = new URL(req.url || '/', 'http://localhost').searchParams.get('afterSeq');
      if (!workspaceId || !sessionId) {
        deps.writeJson(res, { ok: false, error: 'Missing parameters' }, 400);
        return true;
      }
      const afterSeq = safeParseInt(afterSeqStr, 0);

      const chunks = PtySessionService.getInstance().getOutput(sessionId, afterSeq);
      deps.writeJson(res, { ok: true, data: chunks });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  // Reconnect terminal via opaque token
  if (pathname === '/api/v2/workspace/pty/reattach' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const attachToken = String(body?.attachToken || body?.token || '').trim();
      const afterSeq = safeParseInt(
        body?.afterSeq == null ? undefined : String(body.afterSeq),
        0,
      );
      if (!attachToken) {
        deps.writeJson(res, { ok: false, error: 'attachToken required' }, 400);
        return true;
      }
      const result = PtySessionService.getInstance().reattach(attachToken, afterSeq);
      deps.writeJson(res, { ok: result.ok, data: result }, result.ok ? 200 : 404);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  // Residual: fetch attach token for a known session (auth-gated)
  if (pathname === '/api/v2/workspace/pty/attach-token' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const sessionId = String(url.searchParams.get('sessionId') || '').trim();
      if (!sessionId) {
        deps.writeJson(res, { ok: false, error: 'sessionId required' }, 400);
        return true;
      }
      const pty = PtySessionService.getInstance();
      const attachToken = pty.getAttachToken(sessionId);
      const registry = pty.getRegistryEntry(sessionId);
      if (!attachToken || !registry) {
        deps.writeJson(res, { ok: false, error: 'Session not found or attach token expired' }, 404);
        return true;
      }
      deps.writeJson(res, {
        ok: true,
        data: {
          sessionId,
          attachToken,
          status: registry.status,
          processAlive: registry.processAlive,
          lastSeq: registry.lastSeq,
          reattachPath: '/api/v2/workspace/pty/reattach',
        },
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/pty/registry' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = new URL(req.url || '/', 'http://localhost').searchParams.get('workspaceId') || undefined;
      const entries = PtySessionService.getInstance().listRegistry(workspaceId || undefined);
      deps.writeJson(res, { ok: true, data: entries });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/pty/terminate' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.terminatePtySessionSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, sessionId } = parsed.data;

      await PtySessionService.getInstance().terminateSession(sessionId, workspaceId);
      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }


  return null;
}
