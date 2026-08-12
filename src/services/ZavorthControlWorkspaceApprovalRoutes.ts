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

type WorkspaceRouteContext = {
  validateWorkspaceSession: (workspaceId: string) => boolean;
};

export async function handleControlWorkspaceApprovalRoutes(
  input: ZavorthControlRouteInput,
  context: WorkspaceRouteContext,
): Promise<boolean | null> {
  const { req, res, url, pathname, deps } = input;
  if (pathname === '/api/v2/workspace/approvals/pending' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const db = await Database.getInstance();
      const cache = WorkspaceWriteApprovalPayloadCache.getInstance();
      await cache.clearExpired(db);

      const now = new Date().toISOString();
      const rows = db.all<{ operation_id: string; workspace_id: string; tool_name: string; path_suffix: string; created_at: string; expires_at: string }>(
        'SELECT operation_id, workspace_id, tool_name, path_suffix, created_at, expires_at FROM workspace_write_approvals WHERE approved = 0 AND expires_at > ...',
        [now]
      );

      const activeSessionId = url.searchParams.get('sessionId');
      const data = rows
        .filter(row => {
          if (activeSessionId && row.workspace_id !== activeSessionId) {
            return false;
          }
          return cache.getPayload(row.operation_id) !== undefined;
        })
        .map(row => {
          const cached = cache.getPayload(row.operation_id);
          return {
            operationId: row.operation_id,
            toolName: row.tool_name,
            pathSuffix: row.path_suffix,
            path: cached?.file || null,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
          };
        });

      deps.writeJson(res, { ok: true, data });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/approvals/payload' && req.method === 'GET') {
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
      const cache = WorkspaceWriteApprovalPayloadCache.getInstance();
      await cache.clearExpired(db);

      // 1. Operation exists in DB
      const entry = db.get<{ approved: number; expires_at: string; workspace_id: string; tool_name: string }>(
        'SELECT approved, expires_at, workspace_id, tool_name FROM workspace_write_approvals WHERE operation_id = ?',
        [operationId]
      );
      if (!entry) {
        deps.writeJson(res, { ok: false, error: 'Operation not found' }, 404);
        return true;
      }

      // 2. Operation has not expired
      if (new Date(entry.expires_at) <= new Date()) {
        deps.writeJson(res, { ok: false, error: 'Operation expired' }, 410);
        return true;
      }

      // 3. Operation belongs to the active workspace/session
      const activeSessionId = url.searchParams.get('sessionId');
      if (activeSessionId && entry.workspace_id !== activeSessionId) {
        deps.writeJson(res, { ok: false, error: 'Operation session mismatch' }, 403);
        return true;
      }

      // 4. Payload exists in the memory cache
      const cachedPayload = cache.getPayload(operationId);
      if (!cachedPayload) {
        deps.writeJson(res, { ok: false, error: 'Payload not found in transient cache' }, 404);
        return true;
      }

      // proposed content must not be binary (contains no null bytes)
      if (cachedPayload.content && cachedPayload.content.includes('\x00')) {
        deps.writeJson(res, { ok: false, error: 'Proposed content is binary' }, 400);
        return true;
      }

      // 5. Relative path is safe
      const workspacePath = url.searchParams.get('workspacePath')
        || url.searchParams.get('workspace')
        || process.env.ZAVORTH_WORKSPACE_ROOT
        || config.workspaceRoot
        || process.cwd();

      const pathGuard = new WorkspacePathGuard(workspacePath);
      const relativePath = cachedPayload.file;
      let resolvedPath: string;
      try {
        resolvedPath = pathGuard.resolveForWrite(relativePath);
      } catch (pathErr: unknown) {
        const err = asErrorLike(pathErr);
        const error = err;
        deps.writeJson(res, { ok: false, error: `Unsafe relative path: ${(pathErr as Error).message}` }, 403);
        return true;
      }

      // 6. Current content was read via WorkspacePathGuard
      let currentContent = '';
      let currentContentExists = false;
      try {
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
          const buffer = fs.readFileSync(resolvedPath);
          // Check if current content is binary
          if (buffer.includes(0)) {
            deps.writeJson(res, { ok: false, error: 'Current file is binary' }, 400);
            return true;
          }
          currentContent = buffer.toString('utf8');
          currentContentExists = true;
        }
      } catch (readErr: unknown) {
        const err = asErrorLike(readErr);
        const error = err;
        deps.writeJson(res, { ok: false, error: `Failed to read current file: ${(readErr as Error).message}` }, 403);
        return true;
      }

      // 7. Preview/diff already comes truncated from backend
      // Max 100KB and 1000 lines helper
      const truncateContent = (content: string): string => {
        if (!content) return '';
        let truncated = content;
        if (Buffer.byteLength(content, 'utf8') > 100 * 1024) {
          truncated = content.slice(0, 100 * 1024);
        }
        const lines = truncated.split(/\ris\n/);
        if (lines.length > 1000) {
          return lines.slice(0, 1000).join('\n') + '\n... [TRUNCATED]';
        }
        return truncated;
      };

      const truncatedProposed = cachedPayload.content !== undefined ? truncateContent(cachedPayload.content) : undefined;
      const truncatedCurrent = truncateContent(currentContent);

      deps.writeJson(res, {
        ok: true,
        data: {
          operationId,
          file: relativePath,
          toolName: entry.tool_name,
          currentContent: truncatedCurrent,
          proposedContent: truncatedProposed,
          currentContentExists,
        }
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/approvals/resolve' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.resolveWriteApprovalSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { operationId, decision } = parsed.data;

      const approvalService = new WorkspaceWriteApprovalService();
      const cache = WorkspaceWriteApprovalPayloadCache.getInstance();

      if (decision === 'approve') {
        await approvalService.approveOperation(operationId);
      } else if (decision === 'deny') {
        await approvalService.denyOperation(operationId);
        cache.clearPayload(operationId);
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

  if (pathname === '/api/v2/workspace/command-approvals/session-grant' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.sessionGrantSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, active, durationMinutes, allowRiskUpTo, allowPackageInstall, allowNetwork } = parsed.data;

      const cache = WorkspaceSessionGrantCache.getInstance();
      if (active === false) {
        cache.setDeveloperMode(workspaceId, false);
        deps.writeJson(res, { ok: true, developerModeActive: false });
        return true;
      }

      const mins = Number(durationMinutes || 30);
      const expiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();

      const grant = {
        workspaceId,
        expiresAt,
        allowRiskUpTo: (allowRiskUpTo === 'MEDIUM' ? 'MEDIUM' : 'LOW') as 'LOW' | 'MEDIUM',
        allowPackageInstall: allowPackageInstall !== false,
        allowNetwork: allowNetwork === true,
      };

      cache.setDeveloperMode(workspaceId, true);
      cache.setGrant(workspaceId, grant);

      deps.writeJson(res, {
        ok: true,
        developerModeActive: true,
        grant: {
          workspaceId: grant.workspaceId,
          expiresAt: grant.expiresAt,
          allowRiskUpTo: grant.allowRiskUpTo,
          allowPackageInstall: grant.allowPackageInstall,
          allowNetwork: grant.allowNetwork,
        }
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/command-approvals/session-grant' && req.method === 'GET') {
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

      const cache = WorkspaceSessionGrantCache.getInstance();
      const active = cache.isDeveloperModeActive(workspaceId);
      const grant = cache.getGrant(workspaceId);

      deps.writeJson(res, {
        ok: true,
        developerModeActive: active,
        grant
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/trust/status' && req.method === 'GET') {
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

      // Validate workspaceId matches the active session workspace to prevent spoofing
      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'workspaceId does not match the active session workspace' }, 403);
        return true;
      }

      const trustService = await TrustedWorkspaceService.getInstance();
      const entry = trustService.loadTrust(workspaceId, WorkspaceResolver.resolve(null));

      deps.writeJson(res, {
        ok: true,
        trusted: entry !== null && entry.trusted,
        entry
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/trust/resolve' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.resolveWorkspaceTrustSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, rootPath, trusted, allowRiskUpTo, allowPackageInstall, allowNetwork } = parsed.data;

      // Validate rootPath and workspaceId against active workspace to prevent path spoofing
      let resolvedPath: string;
      try {
        resolvedPath = fs.realpathSync(path.resolve(rootPath));
      } catch (error: unknown) {logger.warn('[Zavorth Control Core] parsing failed', error);
  resolvedPath = path.resolve(rootPath);
  }

      let activeWorkspace: string;
      try {
        activeWorkspace = fs.realpathSync(WorkspaceResolver.resolve(null));
      } catch (error: unknown) {logger.warn('[Zavorth Control Core] path resolution failed', error);
  activeWorkspace = path.resolve(WorkspaceResolver.resolve(null));
  }

      const normResolved = path.normalize(resolvedPath).toLowerCase();
      const normActive = path.normalize(activeWorkspace).toLowerCase();

      if (normResolved !== normActive) {
        deps.writeJson(res, { ok: false, error: 'rootPath does not match active session workspace' }, 403);
        return true;
      }

      if (!context.validateWorkspaceSession(workspaceId)) {
        deps.writeJson(res, { ok: false, error: 'rootPath does not match active session workspace' }, 403);
        return true;
      }

      const trustService = await TrustedWorkspaceService.getInstance();

      if (trusted === false) {
        await trustService.revokeTrust(workspaceId);
        deps.writeJson(res, { ok: true, trusted: false });
      } else {
        const entry = await trustService.grantTrust(workspaceId, rootPath, {
          allowRiskUpTo: allowRiskUpTo as 'LOW' | 'MEDIUM',
          allowPackageInstall: !!allowPackageInstall,
          allowNetwork: !!allowNetwork
        });
        deps.writeJson(res, { ok: true, trusted: true, entry });
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }


  return null;
}
