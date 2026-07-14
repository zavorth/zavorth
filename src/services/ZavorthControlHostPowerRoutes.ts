import { asErrorLike } from '../utils/errorLike';
import { SalesPackBusinessModeService } from './SalesPackBusinessModeService.js';

import * as http from 'http';
import path from 'path';
import fs from 'fs';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { NodeMeshTransportRouteService } from './NodeMeshTransportRouteService.js';
import { WorkspaceWriteApprovalPayloadCache } from './WorkspaceWriteApprovalPayloadCache.js';
import { WorkspaceWriteApprovalService } from './WorkspaceWriteApprovalService.js';
import { WorkspaceSessionGrantCache } from './WorkspaceSessionGrantCache.js';
import { WorkspaceCommandApprovalService } from './WorkspaceCommandApprovalService.js';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService.js';
import { TemporaryDirectoryTrustService } from './TemporaryDirectoryTrustService.js';
import { WorkspacePathGuard } from '../mcp/workspace/WorkspacePathGuard.js';
import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { WorkspaceRuntimeReadinessService } from './WorkspaceRuntimeReadinessService.js';
import { WorkspacePolicyPreviewService } from './WorkspacePolicyPreviewService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { InternalBetaDiagnosticsService } from './InternalBetaDiagnosticsService.js';
import { InternalBetaChecklistService } from './InternalBetaChecklistService.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';
import { logger } from '../logger.js';

import { PtySessionService } from './PtySessionService.js';
import { PtySessionApprovalService } from './PtySessionApprovalService.js';
import { PtyInputApprovalService } from './PtyInputApprovalService.js';

import { HostCommandApprovalService } from './HostCommandApprovalService.js';
import { HostCommandRunnerService } from './HostCommandRunnerService.js';
import { HostCommandPayloadCache } from './HostCommandPayloadCache.js';
import { HostPowerModeService } from './HostPowerModeService.js';
import { Database } from '../storage/Database.js';
import { config } from '../config/index.js';
import { OperationalMaturityService } from '../domain/platform-ecosystem/application/OperationalMaturityService.js';
import {
  SalesPackMvpService,
} from '../domain/platform-ecosystem/application/sales-pack/index.js';

import { SalesPackChannelIoService } from './SalesPackChannelIoService.js';
import type {
  ZavorthControlAuthenticatedIdentity,
  ZavorthControlAuthService,
} from './ZavorthControlAuthService.js';
import type {
  SalesPackInboundMessageInput,
} from '../contracts/SalesPackContract.js';
import type { SalesPackChannelIoEnvelope } from '../contracts/SalesPackChannelIoContract.js';
import type { ExperienceCommand, ExperienceSurface } from './experience/ExperienceContracts.js';
import { ExperienceCoreService } from './experience/ExperienceCoreService.js';
import type { ZavorthRuntimeStateActionType } from '../contracts/ZavorthRuntimeStateBusContract.js';
import { globalLiveNodeRegistry } from './LiveNodeRegistryService.js';
import { TrustedDeviceAccessService } from './TrustedDeviceAccessService.js';
import { TrustedDeviceAccessRouteService } from './TrustedDeviceAccessRouteService.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { TrustedWorkspaceService } from './TrustedWorkspaceService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { LocalEncryptedProviderSecretStore } from './ProviderSecretStore.js';
import { ProviderConnectionTestService } from './ProviderConnectionTestService.js';
import * as schemas from '../domain/validation/controlSchemas.js';

import type { ZavorthControlCoreRouteDeps } from './ZavorthControlCoreRouteService.js';

export type ZavorthControlRouteInput = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  pathname: string;
  deps: ZavorthControlCoreRouteDeps;
};

type CommandApprovalRow = {
  operation_id: string;
  workspace_id: string;
  command: string;
  created_at: string;
  expires_at: string;
};

type HostCommandProposalRow = {
  operation_id: string;
  workspace_id: string;
  command_preview_redacted: string;
  args_preview_redacted: string;
  cwd_suffix: string;
  shell: number;
  risk_level: string;
  reason_redacted: string;
  created_at: string;
  expires_at: string;
  requires_strong_confirmation: number;
  strong_confirmation_phrase: string;
};


export async function handleControlHostPowerRoutes(
  input: ZavorthControlRouteInput,
): Promise<boolean | null> {
  const { req, res, url, pathname, deps } = input;
  if (pathname === '/api/v2/workspace/host-power/status' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
        return true;
      }
      const state = HostPowerModeService.getInstance().getState(workspaceId);
      deps.writeJson(res, { ok: true, data: state });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/host-power/enable' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.enableHostPowerSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, durationMinutes } = parsed.data;

      await HostPowerModeService.getInstance().enable(workspaceId, durationMinutes);
      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/host-power/disable' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.disableHostPowerSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId } = parsed.data;

      await HostPowerModeService.getInstance().disable(workspaceId);
      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/host-commands/pending' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      const db = await Database.getInstance();
      const now = new Date().toISOString();

      let rows: HostCommandProposalRow[];
      if (workspaceId) {
        rows = db.all<HostCommandProposalRow>(
          `SELECT operation_id, workspace_id, command_preview_redacted, args_preview_redacted,
                  cwd_suffix, shell, risk_level, reason_redacted, created_at, expires_at,
                  requires_strong_confirmation, strong_confirmation_phrase
           FROM workspace_host_command_proposals
           WHERE approved = 0 AND expires_at > ? AND workspace_id = ?`,
          [now, workspaceId]
        );
      } else {
        rows = db.all<HostCommandProposalRow>(
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
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
      const { operationId, decision, strongConfirmationInput } = parsed.data as {
        operationId: string;
        decision: string;
        strongConfirmationInput?: string;
        totp?: string;
        code?: string;
      };
      const totp =
        String((parsed.data as { totp?: string }).totp || (parsed.data as { code?: string }).code || '').trim() ||
        null;

      const approvalService = new HostCommandApprovalService();
      if (decision === 'approve') {
        await approvalService.resolve(operationId, true, strongConfirmationInput, totp);
      } else if (decision === 'deny') {
        await approvalService.resolve(operationId, false);
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
      const proposal = db.get<{ workspace_id: string; risk_level: string; shell: number }>(
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }


  return null;
}
