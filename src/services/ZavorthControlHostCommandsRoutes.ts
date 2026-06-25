import * as http from 'http';
import path from 'path';
import { Database } from '../storage/Database.js';
import { HostCommandApprovalService } from './HostCommandApprovalService.js';
import { HostCommandPayloadCache } from './HostCommandPayloadCache.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { HostPowerModeService } from './HostPowerModeService.js';
import { HostCommandRunnerService } from './HostCommandRunnerService.js';
import * as schemas from '../domain/validation/controlSchemas.js';
import type { ZavorthControlCoreRouteDeps } from './ZavorthControlCoreRouteService.js';

export async function handleHostCommandsRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  url: URL,
  deps: ZavorthControlCoreRouteDeps,
): Promise<boolean> {
  if (pathname === '/api/v2/workspace/host-commands/pending' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      const db = await Database.getInstance();
      const now = new Date().toISOString();

      let rows;
      if (workspaceId) {
        rows = db.all<any>(
          `SELECT operation_id, workspace_id, command_preview_redacted, args_preview_redacted,
                  cwd_suffix, shell, risk_level, reason_redacted, created_at, expires_at,
                  requires_strong_confirmation, strong_confirmation_phrase
           FROM workspace_host_command_proposals
           WHERE approved = 0 AND expires_at > ? AND workspace_id = ?`,
          [now, workspaceId]
        );
      } else {
        rows = db.all<any>(
          `SELECT operation_id, workspace_id, command_preview_redacted, args_preview_redacted,
                  cwd_suffix, shell, risk_level, reason_redacted, created_at, expires_at,
                  requires_strong_confirmation, strong_confirmation_phrase
           FROM workspace_host_command_proposals
           WHERE approved = 0 AND expires_at > ?`,
          [now]
        );
      }

      const data = rows.map(row => ({
        operationId: row.operation_id,
        workspaceId: row.workspace_id,
        commandPreview: row.command_preview_redacted,
        argsPreview: row.args_preview_redacted,
        cwdSuffix: row.cwd_suffix,
        shell: row.shell === 1,
        riskLevel: row.risk_level,
        reasonRedacted: row.reason_redacted,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        requiresStrongConfirmation: row.requires_strong_confirmation === 1,
        strongConfirmationPhrase: row.strong_confirmation_phrase
      }));

      deps.writeJson(res, { ok: true, data });
    } catch (err: any) {
      deps.writeJson(res, { ok: false, error: err.message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/host-commands/resolve' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.resolveHostCommandSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { operationId, decision, strongConfirmationInput } = parsed.data;

      const approvalService = new HostCommandApprovalService();
      if (decision === 'approve') {
        await approvalService.resolve(operationId, true, strongConfirmationInput);
      } else if (decision === 'deny') {
        await approvalService.resolve(operationId, false);
      } else {
        deps.writeJson(res, { ok: false, error: 'Invalid decision' }, 400);
        return true;
      }

      deps.writeJson(res, { ok: true });
    } catch (err: any) {
      deps.writeJson(res, { ok: false, error: err.message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/host-commands/execute' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.executeHostCommandSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { operationId } = parsed.data;

      const db = await Database.getInstance();
      const proposal = db.get<any>(
        'SELECT workspace_id, risk_level, shell FROM workspace_host_command_proposals WHERE operation_id = ? AND approved = 1',
        [operationId]
      );

      if (!proposal) {
        deps.writeJson(res, { ok: false, error: 'Host command proposal not found or already executed' }, 404);
        return true;
      }

      const payloadCache = HostCommandPayloadCache.getInstance();
      const cached = payloadCache.get(operationId);
      if (!cached) {
        deps.writeJson(res, { ok: false, error: 'Transit raw payload cache is missing or expired' }, 410);
        return true;
      }

      const workspaceRoot = WorkspaceResolver.resolve(proposal.workspace_id);
      const shell = proposal.shell === 1;

      // Path validation inside or outside workspace
      const resolvedRoot = path.resolve(workspaceRoot);
      const resolvedCwd = path.isAbsolute(cached.cwd)
        ? path.resolve(cached.cwd)
        : path.resolve(workspaceRoot, cached.cwd);

      const isPathOutside = (target: string, root: string): boolean => {
        const relative = path.relative(root, target);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          return true;
        }
        const normalizedTarget = target.replace(/\\/g, '/').toLowerCase();
        const normalizedRoot = root.replace(/\\/g, '/').toLowerCase();
        return !normalizedTarget.startsWith(normalizedRoot + '/') && normalizedTarget !== normalizedRoot;
      };

      const isOutside = isPathOutside(resolvedCwd, resolvedRoot);
      const requiresHpm = shell || isOutside;

      if (requiresHpm) {
        const hpmState = HostPowerModeService.getInstance().getState(proposal.workspace_id);
        if (!hpmState.enabled) {
          deps.writeJson(res, {
            ok: false,
            error: 'Host Power Mode is disabled. shell:true or out-of-workspace commands require Host Power Mode to be active.'
          }, 403);
          return true;
        }
      }

      // Atomically consume approval
      const approvalService = new HostCommandApprovalService();
      const consumed = await approvalService.consumeApproval(
        proposal.workspace_id,
        operationId,
        cached.command,
        cached.args,
        cached.cwd,
        shell,
        proposal.risk_level
      );

      if (!consumed) {
        deps.writeJson(res, { ok: false, error: 'Approval validation or consumption failed.' }, 400);
        return true;
      }

      // Run command
      const runner = new HostCommandRunnerService();
      const runResult = await runner.executeCommand(
        proposal.workspace_id,
        cached.command,
        cached.args,
        cached.cwd,
        shell,
        30000,
        proposal.risk_level
      );

      // Delete from payload cache
      payloadCache.delete(operationId);

      deps.writeJson(res, {
        ok: true,
        data: runResult
      });
    } catch (err: any) {
      deps.writeJson(res, { ok: false, error: err.message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/host-commands/revoke' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.revokeHostCommandSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { operationId } = parsed.data;
      const db = await Database.getInstance();
      db.run('DELETE FROM workspace_host_command_proposals WHERE operation_id = ?', [operationId]);
      HostCommandPayloadCache.getInstance().delete(operationId);
      deps.writeJson(res, { ok: true });
    } catch (err: any) {
      deps.writeJson(res, { ok: false, error: err.message }, 500);
    }
    return true;
  }

  return false;
}
