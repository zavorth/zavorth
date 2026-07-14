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

const RUNTIME_STATE_ACTION_TYPES = new Set<ZavorthRuntimeStateActionType>([
  'sync-command', 'set-effort', 'set-model', 'set-workspace', 'surface-event',
  'skill-lifecycle', 'domain-state', 'operate-domain', 'set-permission',
  'select-model-spec', 'route-model', 'set-provider-connection',
  'set-workspace-knowledge', 'register-personal-connector', 'set-mcp-trust',
  'recover-scheduled-jobs', 'resume-stream', 'workboard-sync',
]);

type PermissionRouteContext = {
  readResolverContext: (body: Record<string, unknown>) => Record<string, unknown> | null;
};

export async function handleControlPermissionRoutes(
  input: ZavorthControlRouteInput,
  context: PermissionRouteContext,
): Promise<boolean | null> {
  const { req, res, url, pathname, deps } = input;
  if (pathname === '/api/v2/permissions/pending' && req.method === 'GET') {
    const data = deps.echo
      ? deps.echo.getPendingPermissions()
      : deps.proactivePermissions.listPending?.() || [];
    deps.writeJson(res, {
      ok: true,
      deprecated: true,
      canonical: '/api/v2/echo/permissions',
      data,
    });
    return true;
  }

  if (pathname === '/api/v2/permissions/resolve' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    const parsed = schemas.resolvePermissionSchema.safeParse(body);
    if (!parsed.success) {
      deps.writeJson(res, {
        ok: false,
        deprecated: true,
        canonical: '/api/v2/echo/permissions/resolve',
        error: 'Validation failed',
        details: parsed.error.format()
      }, 400);
      return true;
    }
    const { id, approved } = parsed.data;

    if (deps.echo) {
      const resolverContext = context.readResolverContext(parsed.data);
      const result = resolverContext
        ? await deps.echo.resolvePermission(id, approved, resolverContext)
        : await deps.echo.resolvePermission(id, approved);
      deps.writeJson(res, {
        deprecated: true,
        canonical: '/api/v2/echo/permissions/resolve',
        ...((result || {}) as Record<string, unknown>),
      }, (result as { ok?: boolean })?.ok ? 200 : 404);
      return true;
    }

    const success = deps.proactivePermissions.resolve(id, approved);
    deps.writeJson(res, {
      ok: success,
      deprecated: true,
      canonical: '/api/v2/echo/permissions/resolve',
    });
    return true;
  }


  return null;
}
