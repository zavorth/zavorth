import { asErrorLike } from '../utils/errorLike';

import * as http from 'http';
import path from 'path';
import { Database } from '../storage/Database.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';

import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { LocalEncryptedProviderSecretStore } from './ProviderSecretStore.js';
import { ProviderConnectionTestService } from './ProviderConnectionTestService.js';
import * as schemas from '../domain/validation/controlSchemas.js';

import type { ZavorthControlCoreRouteDeps } from './ZavorthControlCoreRouteService.js';
import { handleControlHostPowerRoutes } from './ZavorthControlHostPowerRoutes.js';

export type ZavorthControlRouteInput = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  pathname: string;
  deps: ZavorthControlCoreRouteDeps;
};

export async function handleControlProviderHostRoutes(
  input: ZavorthControlRouteInput,
): Promise<boolean | null> {
  const { req, res, url, pathname, deps } = input;
  if (pathname === '/api/v2/providers' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const providers = await ProviderConfigService.getInstance().getProviders();
      const safeProviders = providers.map(p => {
        const { secretRef, ...rest } = p as unknown as Record<string, unknown>;
        return { ...rest, configured: !!secretRef };
      });
      deps.writeJson(res, { ok: true, data: safeProviders });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/providers' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.providerConfigSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const validatedBody = parsed.data;
      const srv = ProviderConfigService.getInstance();

      let providerId = validatedBody.providerId;
      let config;

      if (providerId) {
        config = await srv.updateProvider(providerId, validatedBody);
      } else {
        config = await srv.createProvider(validatedBody);
        providerId = config.providerId;
      }

      if (validatedBody.apiKey) {
        const store = LocalEncryptedProviderSecretStore.getInstance();
        const saveResult = await store.saveSecret(providerId, validatedBody.apiKey);
        await srv.setSecretRef(providerId, saveResult.secretRef);
        config.secretRef = saveResult.secretRef;
      }

      const { secretRef, ...safeConfig } = config as unknown as Record<string, unknown>;
      const finalConfig = { ...safeConfig, configured: !!secretRef };

      deps.writeJson(res, { ok: true, data: finalConfig });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 400);
    }
    return true;
  }

  if (pathname === '/api/v2/providers/test-connection' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.testConnectionSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { providerId } = parsed.data;
      const result = await ProviderConnectionTestService.getInstance().testConnection(providerId);
      deps.writeJson(res, { ok: true, data: result });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const normalized = ErrorNormalizationService.getInstance().normalize(err);
      deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/providers' && req.method === 'DELETE') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const providerId = url.searchParams.get('providerId');
      if (!providerId) {
        deps.writeJson(res, { ok: false, error: 'providerId is required' }, 400);
        return true;
      }
      await ProviderConfigService.getInstance().deleteProvider(providerId);

      const db = await Database.getInstance();
      await db.run('DELETE FROM provider_secret_refs WHERE provider_id = ?', [providerId]);

      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  const deleteSecretMatch = pathname.match(/^\/api\/v2\/providers\/([^/]+)\/secret$/);
  if (deleteSecretMatch && req.method === 'DELETE') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const providerId = deleteSecretMatch[1];
      await ProviderConfigService.getInstance().setSecretRef(providerId, null);
      const db = await Database.getInstance();
      await db.run('DELETE FROM provider_secret_refs WHERE provider_id = ?', [providerId]);
      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const normalized = ErrorNormalizationService.getInstance().normalize(err);
      deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
    }
    return true;
  }

  // GET /api/v2/workspace/agent-config
  if (pathname === '/api/v2/workspace/agent-config' && req.method === 'GET') {
    const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
    if (!identity) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
        return true;
      }

      if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
        });
        deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
        return true;
      }

      if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
        });
        deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
        return true;
      }

      const config = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
      deps.writeJson(res, { ok: true, data: config });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const normalized = ErrorNormalizationService.getInstance().normalize(err);
      deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
    }
    return true;
  }

  // PATCH /api/v2/workspace/agent-config
  if (pathname === '/api/v2/workspace/agent-config' && (req.method === 'PATCH' || req.method === 'POST')) {
    const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
    if (!identity) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.agentConfigSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const validated = parsed.data;
      const workspaceId = validated.workspaceId || url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
        return true;
      }

      if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
        });
        deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
        return true;
      }

      if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
        });
        deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
        return true;
      }

      const currentConfig = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
      const updatedConfig = { ...(currentConfig as unknown as Record<string, unknown>), ...(body.config as Record<string, unknown> || {}) };
      await AgentWorkspaceConfigService.getInstance().updateConfig(workspaceId, updatedConfig);

      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const normalized = ErrorNormalizationService.getInstance().normalize(err);
      deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
    }
    return true;
  }

  // GET /api/v2/workspace/agent-config/readiness
  if (pathname === '/api/v2/workspace/agent-config/readiness' && req.method === 'GET') {
    const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
    if (!identity) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
        return true;
      }

      if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
        });
        deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
        return true;
      }

      if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
        });
        deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
        return true;
      }

      const readiness = await WorkspaceRuntimeReadinessService.getInstance().checkReadiness(workspaceId);
      deps.writeJson(res, { ok: true, data: readiness });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const normalized = ErrorNormalizationService.getInstance().normalize(err);
      deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
    }
    return true;
  }

  // POST /api/v2/workspace/agent-config/preview
  if (pathname === '/api/v2/workspace/agent-config/preview' && req.method === 'POST') {
    const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
    if (!identity) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.agentConfigPreviewSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const validated = parsed.data;
      const workspaceId = validated.workspaceId || url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
        return true;
      }

      if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
        });
        deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
        return true;
      }

      if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
        });
        deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
        return true;
      }

      const previewData = await WorkspacePolicyPreviewService.getInstance().previewPolicy(workspaceId, body.config || {});
      deps.writeJson(res, { ok: true, data: previewData });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const normalized = ErrorNormalizationService.getInstance().normalize(err);
      deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
    }
    return true;
  }

  // GET /api/v2/workspace/agent-config/diagnostics
  if (pathname === '/api/v2/workspace/agent-config/diagnostics' && req.method === 'GET') {
    const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
    if (!identity) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
        return true;
      }

      if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
        });
        deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
        return true;
      }

      if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
        });
        deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
        return true;
      }

      const diagnostics = await InternalBetaDiagnosticsService.getInstance().runDiagnostics(workspaceId);
      deps.writeJson(res, { ok: true, data: diagnostics });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  // GET /api/v2/workspace/agent-config/checklist
  if (pathname === '/api/v2/workspace/agent-config/checklist' && req.method === 'GET') {
    const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
    if (!identity) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
        return true;
      }

      if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
        });
        deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
        return true;
      }

      if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
        const auditLogger = new SecurityAuditLogger();
        auditLogger.logWorkspaceEvent({
          event: 'blocked_cross_workspace_config_access',
          workspaceId: workspaceId,
          metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
        });
        deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
        return true;
      }

      const checklist = await InternalBetaChecklistService.getInstance().getChecklist(workspaceId);
      deps.writeJson(res, { ok: true, data: checklist });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  return handleControlHostPowerRoutes(input);
}
