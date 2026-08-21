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
import { ZavorthMnemosMemoryUxService } from '../services/ZavorthMnemosMemoryUxService.js';





import { ZavorthMnemosProceduralMemoryService } from '../services/ZavorthMnemosProceduralMemoryService.js';
import { ZavorthMnemosQueryService } from '../services/ZavorthMnemosQueryService.js';
import type { ZavorthAgentGateway } from '../runtime/agent/index.js';
import type { LearningPlaneActionId } from '../services/ZavorthLearningPlaneService.js';

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
      const error = 'Usage: sessionsend <sessionId|chatId> -- <message>';
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
    return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : 'Failed to send to the session.' };
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
    return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : 'Failed to open the derived session.' };
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
    const learningActionId = first === 'promote-procedure' || first === 'promoteprocedure'
      ? 'promoteProcedure'
      : first === 'promote-skill' || first === 'promoteskill'
        ? 'promoteSkill'
        : first === 'approve' || first === 'reject' || first === 'promote' || first === 'forget'
          ? first
          : null;
    if (first === 'metrics') {
      const metrics = runtime.learningPlaneService.readMetrics();
      const body = effectiveFlags.json
        ? JSON.stringify(metrics, null, 2)
        : formatLearningMetricsSnapshot(metrics);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (learningActionId && candidateId) {
      const result = await runtime.learningPlaneService.executeAction({
        candidateId,
        actionId: learningActionId as LearningPlaneActionId,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatLearningActionExecution(result);
      writer.line(body);
      return { ok: Boolean(result.ok ?? true), handled: true, output: [body], error: null };
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
    if (first === 'mnemos' || first === 'mnemos-ux') {
      const mnemosAction = String(tokens[1] || '').trim().toLowerCase();
      if (mnemosAction === 'query') {
        const queryText = tokens.slice(2).join(' ').trim();
        const snapshot = new ZavorthMnemosQueryService().query({ query: queryText });
        const body = effectiveFlags.json
          ? JSON.stringify(snapshot, null, 2)
          : formatMnemosQueryCli(snapshot);
        writer.line(body);
        return { ok: true, handled: true, output: [body], error: null };
      }
      const service = new ZavorthMnemosMemoryUxService();
      const snapshot = service.buildSnapshot();
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : service.formatCli(snapshot);
      writer.line(body);
      return { ok: snapshot.status !== 'blocked', handled: true, output: [body], error: snapshot.status === 'blocked' ? 'Mnemos memory UX blocked.' : null };
    }
    if (first === 'procedural') {
      const service = new ZavorthMnemosProceduralMemoryService();
      const subcommand = String(tokens[1] || 'list').toLowerCase();
      const parsed = parseProceduralMemoryArgs(tokens.slice(2));
      const snapshot = subcommand === 'preview'
        ? service.preview({ text: parsed.text || parsed.rest, scope: parsed.scope })
        : subcommand === 'apply'
          ? service.apply({ text: parsed.text || parsed.rest, scope: parsed.scope, approvalId: parsed.approvalId })
          : subcommand === 'query'
            ? service.query({ query: parsed.text || parsed.rest })
            : subcommand === 'revoke'
              ? service.revoke({ id: parsed.id || parsed.rest, approvalId: parsed.approvalId, reason: parsed.reason })
              : service.list();
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatProceduralMemoryCli(snapshot);
      writer.line(body);
      return { ok: snapshot.status !== 'blocked', handled: true, output: [body], error: snapshot.status === 'blocked' ? 'Mnemos procedural memory blocked.' : null };
    }
    if (first === 'receipts' || first === 'source' || first === 'sources') {
      const agentGateway = runtime.agentGateway as ZavorthAgentGateway | null | undefined;
      const gatewaySnapshot = agentGateway?.buildSnapshot({
        activeSessionId: effectiveFlags.sessionId,
      });
      const activeRun = gatewaySnapshot?.activeRun
        || (Array.isArray(gatewaySnapshot?.runs)
          ? gatewaySnapshot.runs.find((run) => run?.sessionId === effectiveFlags.sessionId) || gatewaySnapshot.runs[0]
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
        const resolution = await runtime.workspaceMemoryOsService.resolveFollowUp(rest || 'continue this thread', {
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
        const snapshot = await runtime.layeredMemoryService.search({ query: rest });
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

function parseProceduralMemoryArgs(tokens: string[]): {
  text: string;
  rest: string;
  approvalId: string | null;
  id: string | null;
  reason: string | null;
  scope: string[];
} {
  const remaining: string[] = [];
  let text = '';
  let approvalId: string | null = null;
  let id: string | null = null;
  let reason: string | null = null;
  let scope: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1] || '';
    if (token === '--text') {
      text = next;
      index += 1;
    } else if (token === '--approval-id') {
      approvalId = next;
      index += 1;
    } else if (token === '--id') {
      id = next;
      index += 1;
    } else if (token === '--reason') {
      reason = next;
      index += 1;
    } else if (token === '--scope') {
      scope = next.split(',').map((entry) => entry.trim()).filter(Boolean);
      index += 1;
    } else {
      remaining.push(token);
    }
  }
  return {
    text,
    rest: remaining.join(' ').trim(),
    approvalId,
    id,
    reason,
    scope,
  };
}

function formatProceduralMemoryCli(snapshot: any): string {
  const lines = [
    'Mnemos Procedural Memory',
    `status: ${snapshot.status}`,
    `action: ${snapshot.action}`,
    `rules: ${snapshot.summary?.active || 0}/${snapshot.summary?.total || 0} active`,
  ];
  if (snapshot.rule) {
    lines.push(`rule: ${snapshot.rule.id}`);
    lines.push(`kind: ${snapshot.rule.kind}`);
    lines.push(`risk: ${snapshot.rule.risk}`);
    lines.push(`statement: ${snapshot.rule.statement}`);
  }
  const rules = Array.isArray(snapshot.rules) ? snapshot.rules.slice(0, 8) : [];
  for (const rule of rules) {
    lines.push(`- ${rule.id} [${rule.status}/${rule.kind}/${rule.risk}] ${rule.statement}`);
  }
  return lines.join('\n');
}

function formatMnemosQueryCli(snapshot: any): string {
  const lines = [
    'Mnemos Wiki Query',
    `status: ${snapshot.status}`,
    `hits: ${snapshot.summary?.hits || 0}/${snapshot.summary?.pagesScanned || 0}`,
  ];
  for (const hit of Array.isArray(snapshot.hits) ? snapshot.hits.slice(0, 6) : []) {
    lines.push(`- ${hit.title || hit.pageId} (${hit.score}): ${hit.path}`);
  }
  if (!snapshot.hits?.length) {
    lines.push('No matching wiki pages.');
  }
  return lines.join('\n');
}
