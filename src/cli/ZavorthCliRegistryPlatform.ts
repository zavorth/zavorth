import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import {
  formatAIGatewayDoctorReport,
  formatAIGatewayGatewayStatus,
  formatAIGatewaySyncReport,
  formatPlatformActionExecution,
  formatPlatformPublishResult,
} from './ZavorthCliNativeRenderers.js';
import { formatPlatformSnapshot, formatPlatformSyncResult } from './ZavorthCliSurfaceHelpers.js';

import { resolvePlatformIntent } from './ZavorthCliCommandHelpers.js';
import {
  formatCapabilityOsRouteDecision,
  formatCapabilityOsSnapshot,
} from './ZavorthCliCapabilityOsRenderer.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

export async function handleZavorthCliRegistryPlatformCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, args, writer } = params;

  if (commandName === 'capabilities' && runtime.capabilityOsService) {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').trim().toLowerCase();
    const routeMode = first === 'route' || first === 'explain' || first === 'why';
    if (routeMode) {
      const input = tokens.slice(1).join(' ').trim();
      const decision = runtime.capabilityOsService.explainRoute(input, {
        commandType: '/task',
        requestedBy: effectiveFlags.userId,
        sourceSurface: 'cli',
        writeLedger: true,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(decision, null, 2)
        : formatCapabilityOsRouteDecision(decision);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const snapshot = runtime.capabilityOsService.buildSnapshot();
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatCapabilityOsSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'platform' && runtime.platformRegistryService) {
    const platformIntent = resolvePlatformIntent(args);
    if (platformIntent.mode === 'sync' && runtime.platformCatalogSyncService) {
      const result = await runtime.platformCatalogSyncService.sync();
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatPlatformSyncResult(result);
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.error };
    }
    if (platformIntent.mode === 'publish' && runtime.platformPublisherService) {
      const result = await runtime.platformPublisherService.publishDetailed({
        packagePath: platformIntent.entryId,
        signLocal: true,
        requestedBy: effectiveFlags.userId,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatPlatformPublishResult(result);
      writer.line(body);
      return { ok: Boolean(result.ok ?? true), handled: true, output: [body], error: null };
    }
    if (platformIntent.mode === 'action' && runtime.platformActionService) {
      if (!platformIntent.entryId) {
        const error = `Uso: platform ${platformIntent.actionId || '<acao>'} <entryId>`;
        writer.error(error);
        return { ok: false, handled: true, output: [], error };
      }
      const result = await runtime.platformActionService.execute({
        entryId: platformIntent.entryId,
        actionId: platformIntent.actionId,
        requestedBy: effectiveFlags.userId,
        workspace: effectiveFlags.workspaceHint,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatPlatformActionExecution(result);
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.summary };
    }
    const snapshot = runtime.platformRegistryService.buildSnapshot({
      selectedId: platformIntent.mode === 'snapshot' ? platformIntent.query : null,
      query: platformIntent.mode === 'snapshot' ? platformIntent.query : null,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatPlatformSnapshot(snapshot, {
        focusExplicit: Boolean(platformIntent.mode === 'snapshot' ? platformIntent.query : null),
      });

    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'plugins' && runtime.platformRegistryService) {
    const pluginArgs = String(args || '').trim();
    const tokens = pluginArgs.split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').trim().toLowerCase();
    const actionIds = new Set(['inspect', 'open', 'doctor', 'trust', 'review', 'install', 'update', 'remove']);
    if (first === 'sync' && runtime.platformCatalogSyncService) {
      const result = await runtime.platformCatalogSyncService.sync();
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatPlatformSyncResult(result);
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.error };
    }
    if (actionIds.has(first) && runtime.platformActionService) {
      const result = await runtime.platformActionService.execute({
        entryId: tokens.slice(1).join(' ').trim(),
        actionId: first,
        requestedBy: effectiveFlags.userId,
        workspace: effectiveFlags.workspaceHint,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatPlatformActionExecution(result);
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.summary };
    }
    const query = first === 'list'
      ? tokens.slice(1).join(' ').trim() || null
      : pluginArgs || null;
    const snapshot = runtime.platformRegistryService.buildSnapshot({
      selectedId: query,
      query,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatPlatformSnapshot(snapshot, {
        focusExplicit: Boolean(query),
      });
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'aigateway') {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').trim().toLowerCase() || 'status';
    if ((first === 'status' || first === 'route') && runtime.AIGatewayGatewayService) {
      const status = runtime.AIGatewayGatewayService.readStatus();
      const body = effectiveFlags.json
        ? JSON.stringify(status, null, 2)
        : formatAIGatewayGatewayStatus(status, first === 'route' ? 'route' : 'status');
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (first === 'start' && runtime.AIGatewayGatewayLauncherService) {
      const status = await runtime.AIGatewayGatewayLauncherService.ensureStarted();
      const body = effectiveFlags.json
        ? JSON.stringify(status, null, 2)
        : formatAIGatewayGatewayStatus(status, 'route');
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (first === 'doctor' && runtime.GatewayCompatibilityDoctorService) {
      const report = await runtime.GatewayCompatibilityDoctorService.run();
      const body = effectiveFlags.json
        ? JSON.stringify(report, null, 2)
        : formatAIGatewayDoctorReport(report);
      writer.line(body);
      return { ok: Boolean(report.ok ?? true), handled: true, output: [body], error: null };
    }
    if (first === 'sync' && runtime.GatewayUpstreamSyncService) {
      const report = await runtime.GatewayUpstreamSyncService.sync();
      const body = effectiveFlags.json
        ? JSON.stringify(report, null, 2)
        : formatAIGatewaySyncReport(report);
      writer.line(body);
      return { ok: Boolean(report.ok ?? true), handled: true, output: [body], error: null };
    }
    if (first === 'promote' && runtime.GatewayUpstreamSyncService) {
      const report = await runtime.GatewayUpstreamSyncService.promote({
        autoRollback: !tokens.includes('--no-rollback'),
      });
      const body = effectiveFlags.json
        ? JSON.stringify(report, null, 2)
        : formatAIGatewaySyncReport(report);
      writer.line(body);
      return { ok: Boolean(report.ok ?? true), handled: true, output: [body], error: null };
    }
    if (first === 'rollback' && runtime.GatewayUpstreamSyncService) {
      const report = await runtime.GatewayUpstreamSyncService.rollback();
      const body = effectiveFlags.json
        ? JSON.stringify(report, null, 2)
        : formatAIGatewaySyncReport(report);
      writer.line(body);
      return { ok: Boolean(report.ok ?? true), handled: true, output: [body], error: null };
    }
  }

  return null;
}
