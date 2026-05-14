import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import { formatCliSessionPlaneOutput } from './ZavorthCliFlowHelpers.js';
import {
  buildSessionPlaneInput,
  parseCliSessionSendArgs,
  resolveSessionTargetRef,
} from './ZavorthCliCommandHelpers.js';
import {
  formatLearningActionExecution,
  formatLearningMetricsSnapshot,
  formatLearningSnapshot,
  formatLayeredMemoryProcedures,
  formatLayeredMemorySearch,
  formatLayeredMemoryStatus,
  formatMemoryPlaneSnapshot,
} from './ZavorthCliSurfaceHelpers.js';
import {
  formatHookPlaneSnapshot,
  formatLayeredMemoryMetrics,
  formatSessionSendResult,
  formatSessionSpawnResult,
  formatToolSurfaceSnapshot,
} from './ZavorthCliNativeRenderers.js';
import {
  formatWorkspaceMemoryAction,
  formatWorkspaceMemoryResolution,
  formatWorkspaceMemoryReview,
} from './ZavorthCliWorkspaceMemoryRenderer.js';
import {
  buildMemoryWithReceiptsCliSnapshot,
  buildMemoryWithReceiptsSnapshotFromRun,
  formatMemoryWithReceiptsSnapshot,
  resolveMemoryWithReceiptsCliText,
} from './ZavorthCliMemoryWithReceiptsRenderer.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

export async function handleZavorthCliRegistrySessionsCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, args, writer } = params;

  if ((commandName === 'sessions' || commandName === 'sessionhistory') && runtime.sessionPlaneService) {
    const input = buildSessionPlaneInput(effectiveFlags, args || null);
    const rawBody = commandName === 'sessionhistory'
      ? await runtime.sessionPlaneService.renderHistoryReport(input)
      : await runtime.sessionPlaneService.renderOverviewReport(input);
    const body = effectiveFlags.json
      ? JSON.stringify(await runtime.sessionPlaneService.buildSnapshot(input), null, 2)
      : commandName === 'sessionhistory'
        ? formatCliSessionPlaneOutput('history', rawBody, args, effectiveFlags.sessionId)
        : formatCliSessionPlaneOutput('overview', rawBody, args, effectiveFlags.sessionId);

    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'sessionsend' && runtime.sessionPlaneService) {
    const parsed = parseCliSessionSendArgs(args);
    if (!parsed) {
      const error = 'Uso: sessionsend <sessionId|chatId> -- <mensagem>';
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }
    const target = resolveSessionTargetRef(parsed.targetRef, effectiveFlags);
    const result = await runtime.sessionPlaneService.sendToSession({
      userId: effectiveFlags.userId,
      platform: target.platform,
      chatId: target.chatId,
      sessionId: target.sessionId,
      sourceUserId: target.sourceUserId,
      text: parsed.message,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(result, null, 2)
      : formatSessionSendResult(result);
    writer.line(body);
    return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : 'Falha ao enviar para a sessao.' };
  }

  if (commandName === 'sessionspawn' && runtime.sessionPlaneService) {
    const spawnPlatform = String(args || '').trim() || 'web';
    const result = await runtime.sessionPlaneService.spawnSession({
      userId: effectiveFlags.userId,
      platform: spawnPlatform,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(result, null, 2)
      : formatSessionSpawnResult(result);
    writer.line(body);
    return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : 'Falha ao abrir a sessao derivada.' };
  }

  if (commandName === 'memoryplane' && runtime.memoryPlaneService) {
    const snapshot = await runtime.memoryPlaneService.buildSnapshot({
      userId: effectiveFlags.userId,
      platform: effectiveFlags.platform,
      chatId: effectiveFlags.chatId,
      sessionId: effectiveFlags.sessionId,
      workspaceHint: effectiveFlags.workspaceHint,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatMemoryPlaneSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'tools' && runtime.toolSurfaceService) {
    const snapshot = runtime.toolSurfaceService.buildSnapshot({
      userId: effectiveFlags.userId,
      chatId: effectiveFlags.chatId,
      sessionId: effectiveFlags.sessionId,
      selectedId: args || null,
      query: args || null,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatToolSurfaceSnapshot(snapshot);

    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'hooks' && runtime.hookPlaneService) {
    const snapshot = runtime.hookPlaneService.buildSnapshot();
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatHookPlaneSnapshot(snapshot);

    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'learning' && runtime.learningPlaneService) {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').trim().toLowerCase();
    const candidateId = tokens.slice(1).join(' ').trim();
    if (first === 'metrics') {
      const metrics = runtime.learningPlaneService.readMetrics();
      const body = effectiveFlags.json
        ? JSON.stringify(metrics, null, 2)
        : formatLearningMetricsSnapshot(metrics);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if ((first === 'approve' || first === 'reject' || first === 'promote') && candidateId) {
      const result = await runtime.learningPlaneService.executeAction({
        candidateId,
        actionId: first,
      } as any);
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatLearningActionExecution(result);
      writer.line(body);
      return { ok: Boolean((result as any).ok ?? true), handled: true, output: [body], error: null };
    }
    const snapshot = runtime.learningPlaneService.buildSnapshot();
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatLearningSnapshot(snapshot, first === 'candidates' ? 'candidates' : 'status');
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'memory') {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').trim().toLowerCase();
    const rest = tokens.slice(1).join(' ').trim();
    if (first === 'receipts' || first === 'source' || first === 'sources' || first === 'origem') {
      const gatewaySnapshot = runtime.agentGateway?.buildSnapshot({
        activeSessionId: effectiveFlags.sessionId,
      } as any) as any;
      const activeRun = gatewaySnapshot?.activeRun
        || (Array.isArray(gatewaySnapshot?.runs)
          ? gatewaySnapshot.runs.find((run: any) => run?.sessionId === effectiveFlags.sessionId) || gatewaySnapshot.runs[0]
          : null);
      const snapshot = activeRun
        ? buildMemoryWithReceiptsSnapshotFromRun(activeRun)
        : buildMemoryWithReceiptsCliSnapshot({
          text: resolveMemoryWithReceiptsCliText(args) || rest,
          userId: effectiveFlags.userId,
          sessionId: effectiveFlags.sessionId,
        });
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatMemoryWithReceiptsSnapshot(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (runtime.workspaceMemoryOsService && (first === 'review' || first === 'resolve' || first === 'forget' || first === 'correct')) {
      if (first === 'resolve') {
        const resolution = await runtime.workspaceMemoryOsService.resolveFollowUp(rest || 'continua', {
          userId: effectiveFlags.userId,
          platform: effectiveFlags.platform,
          chatId: effectiveFlags.chatId,
          sessionId: effectiveFlags.sessionId,
          workspaceHint: effectiveFlags.workspaceHint,
        });
        const body = effectiveFlags.json
          ? JSON.stringify(resolution, null, 2)
          : formatWorkspaceMemoryResolution(resolution);
        writer.line(body);
        return { ok: true, handled: true, output: [body], error: null };
      }
      if (first === 'forget') {
        const key = tokens[1] || '';
        const result = await runtime.workspaceMemoryOsService.executeAction({
          action: 'forget',
          key,
          userId: effectiveFlags.userId,
          platform: effectiveFlags.platform,
          chatId: effectiveFlags.chatId,
          sessionId: effectiveFlags.sessionId,
          workspaceHint: effectiveFlags.workspaceHint,
        });
        const body = effectiveFlags.json
          ? JSON.stringify(result, null, 2)
          : formatWorkspaceMemoryAction(result);
        writer.line(body);
        return { ok: result.ok || result.status === 'noop', handled: true, output: [body], error: result.ok ? null : result.summary };
      }
      if (first === 'correct') {
        const key = tokens[1] || '';
        const value = tokens.slice(2).join(' ').trim();
        const result = await runtime.workspaceMemoryOsService.executeAction({
          action: 'correct',
          key,
          value,
          userId: effectiveFlags.userId,
          platform: effectiveFlags.platform,
          chatId: effectiveFlags.chatId,
          sessionId: effectiveFlags.sessionId,
          workspaceHint: effectiveFlags.workspaceHint,
        });
        const body = effectiveFlags.json
          ? JSON.stringify(result, null, 2)
          : formatWorkspaceMemoryAction(result);
        writer.line(body);
        return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.summary };
      }

      const snapshot = await runtime.workspaceMemoryOsService.buildReview({
        userId: effectiveFlags.userId,
        platform: effectiveFlags.platform,
        chatId: effectiveFlags.chatId,
        sessionId: effectiveFlags.sessionId,
        workspaceHint: effectiveFlags.workspaceHint,
        query: rest || null,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatWorkspaceMemoryReview(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (runtime.layeredMemoryService && (first === 'status' || first === 'metrics' || first === 'search' || first === 'procedures')) {
      if (first === 'metrics') {
        const metrics = await runtime.layeredMemoryService.readMetrics();
        const body = effectiveFlags.json
          ? JSON.stringify(metrics, null, 2)
          : formatLayeredMemoryMetrics(metrics);
        writer.line(body);
        return { ok: true, handled: true, output: [body], error: null };
      }
      if (first === 'search') {
        const snapshot = await runtime.layeredMemoryService.search({ query: rest } as any);
        const body = effectiveFlags.json
          ? JSON.stringify(snapshot, null, 2)
          : formatLayeredMemorySearch(snapshot);
        writer.line(body);
        return { ok: true, handled: true, output: [body], error: null };
      }
      if (first === 'procedures') {
        const snapshot = await runtime.layeredMemoryService.readProcedures();
        const body = effectiveFlags.json
          ? JSON.stringify(snapshot, null, 2)
          : formatLayeredMemoryProcedures(snapshot);
        writer.line(body);
        return { ok: true, handled: true, output: [body], error: null };
      }
      const snapshot = await runtime.layeredMemoryService.buildStatus();
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatLayeredMemoryStatus(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (runtime.memoryPlaneService) {
      const snapshot = await runtime.memoryPlaneService.buildSnapshot({
        userId: effectiveFlags.userId,
        platform: effectiveFlags.platform,
        chatId: effectiveFlags.chatId,
        sessionId: effectiveFlags.sessionId,
        workspaceHint: effectiveFlags.workspaceHint,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatMemoryPlaneSnapshot(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
  }

  return null;
}
