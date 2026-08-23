import { globalSpinner } from './presentation/TerminalSpinner.js';
import type {
  ZavorthCliFlags,
  ZavorthCliRuntime,
  CliExecutionResult,
  CliTerminalStreamEvent,
  CliWriter,
} from './ZavorthCliContract.js';
import type { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import {
  type UniversalAgentRunResult,
} from '../runtime/agent/index.js';
import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import { SurfaceOperationalIntentService } from '../services/SurfaceOperationalIntentService.js';
import { resolveCliUniversalModelProfile } from './ZavorthCliModelPickerHelpers.js';
import { ZavorthUserResponseRendererService } from '../services/ZavorthUserResponseRendererService.js';
import {
  formatCliChatAssistantMessage,
} from './ZavorthCliChatRenderers.js';
import {
  formatCliApprovalRequiredEventCard,
  formatCliChatReplyEventCard,
  formatCliRecoverableErrorEventCard,
  formatCliSuccessEventCard,
  formatCliCuratorNotificationCard,
} from './ZavorthCliEventCards.js';

export { buildCliReplCompleter, createDefaultSessionId, loadCliReplHistory, persistCliReplHistory } from './ZavorthCliReplHistoryHelpers.js';

import { Database } from '../storage/Database.js';
import { asErrorLike } from '../utils/errorLike.js';

import {
  buildWorkflowJobCounts,
  createCliUniversalExecutor,
  createCliWorkflowQueueExecutor,
  formatCliConversationLabel,
  formatWorkflowJobCounts,
  parseWorkflowQueueLimit,
  resolveWorkflowQueueAction,
  summarizeWorkflowQueueJobs,
} from './ZavorthCliFlowHelpers.js';
export async function executeCliWorkflowQueueCommand(
  runtime: ZavorthCliRuntime,
  args: string,
  flags: ZavorthCliFlags,
  writer: CliWriter,
): Promise<CliExecutionResult | null> {
  const agentGateway = runtime.agentGateway || null;
  if (!agentGateway) {
    const error = 'Workflow queue is unavailable in this CLI instance.';
    if (flags.json) {
      const body = JSON.stringify({
        ok: false,
        mode: 'workflow_queue',
        error,
      }, null, 2);
      writer.line(body);
      return { ok: false, handled: true, output: [body], error };
    }
    const body = formatCliRecoverableErrorEventCard({
      body: error,
      command: 'doctor',
    });
    writer.line(body);
    return { ok: false, handled: true, output: [body], error };
  }

  const action = resolveWorkflowQueueAction(args);
  if (action === 'unknown') {
    const error = 'Use workflows status or workflows process.';
    if (flags.json) {
      const body = JSON.stringify({
        ok: false,
        mode: 'workflow_queue',
        error,
      }, null, 2);
      writer.line(body);
      return { ok: false, handled: true, output: [body], error };
    }
    const body = formatCliRecoverableErrorEventCard({
      body: error,
      command: 'workflows status',
      hints: ['To run the local queue: workflows process'],
    });
    writer.line(body);
    return { ok: false, handled: true, output: [body], error };
  }

  if (action === 'status') {
    const snapshot = agentGateway.buildSnapshot();
    const jobs = snapshot.workflowJobs || agentGateway.listWorkflowJobs(50);
    const counts = buildWorkflowJobCounts(jobs);
    if (flags.json) {
      const body = JSON.stringify({
        ok: true,
        mode: 'workflow_queue_status',
        generatedAt: snapshot.generatedAt,
        queue: snapshot.workflowQueue,
        counts,
        jobs: jobs.map((job: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: job.id,
          kind: job.kind,
          runId: job.runId || null,
          approvalId: job.approvalId || null,
          status: job.status,
          attempts: job.attempts ?? null,
          createdAt: job.createdAt || null,
          updatedAt: job.updatedAt || null,
          nextAttemptAt: job.nextAttemptAt || null,
        })),
      }, null, 2);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const body = formatCliChatAssistantMessage({
      title: 'Workflow Queue',
      body: [
        `Queue: ${snapshot.workflowQueue.label}`,
        `Adapter: ${snapshot.workflowQueue.kind}  ?  ${snapshot.workflowQueue.capabilities.durable ? 'durable' : 'memory'}  -  ${snapshot.workflowQueue.capabilities.multiHostSafe ? 'multi-host' : 'local'}`,
        `Jobs: ${counts.total}`,
        formatWorkflowJobCounts(counts),
        ...summarizeWorkflowQueueJobs(jobs),
      ],
      hints: [
        counts.queued > 0 ? 'workflows process' : 'Nothing is ready to process right now.',
        'workflows status --json',
      ],
    });
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const limit = parseWorkflowQueueLimit(args);
  const executor = createCliWorkflowQueueExecutor(runtime, flags);
  const results = await agentGateway.processQueuedWorkflows({
    executor,
    ...(limit ? { limit } : {}),
  });
  const snapshot = agentGateway.buildSnapshot();
  const counts = buildWorkflowJobCounts(snapshot.workflowJobs || agentGateway.listWorkflowJobs(50));
  const failed = results.filter((result: UniversalAgentRunResult) => !result.ok || result.run.status === 'failed').length;

  if (flags.json) {
    const body = JSON.stringify({
      ok: failed === 0,
      mode: 'workflow_queue_process',
      processed: results.length,
      failed,
      limit: limit || null,
      queue: snapshot.workflowQueue,
      counts,
      results: results.map((result) => ({
        ok: result.ok,
        runId: result.run.id,
        status: result.run.status,
        summary: result.run.summary,
        replies: result.replies,
      })),
      remaining: snapshot.workflowJobs.filter((job) => job.status === 'queued').length,
    }, null, 2);
    writer.line(body);
    return { ok: failed === 0, handled: true, output: [body], error: failed > 0 ? 'One or more workflows failed.' : null };
  }

  const primaryReply = results
    .map((result) => String(result.replies[0]?.text || result.run.summary || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const body = formatCliSuccessEventCard({
    title: results.length > 0 ? 'Queue processed' : 'Workflow Queue',
    body: results.length > 0
      ? [
        `${results.length} workflow(s) processed.`,
        failed > 0 ? `${failed} workflow(s) failed and remain recorded in the queue.` : 'No failures were reported by the worker.',
        ...primaryReply,
      ]
      : 'No workflow is ready to process right now.',
    hints: [
      'workflows status',
      'workflows process --json',
    ],
  });
  writer.line(body);
  return {
    ok: failed === 0,
    handled: true,
    output: [body],
    error: failed > 0 ? 'One or more workflows failed.' : null,
  };
}

export async function executeCliUniversalAgentRuntime(
  runtime: ZavorthCliRuntime,
  normalized: string,
  flags: ZavorthCliFlags,
  writer: CliWriter,
): Promise<CliExecutionResult> {
  const agentGateway = runtime.agentGateway || null;
  const trimmed = String(normalized || '').trim();
  if (!agentGateway || !trimmed) {
    return {
      ok: false,
      handled: false,
      output: [],
      error: 'Universal runtime is unavailable for the CLI.',
    };
  }
  if (flags.terminalAbortSignal?.aborted) {
    return {
      ok: false,
      handled: true,
      output: ['Request interrupted before it reached the runtime.'],
      error: 'interrupted',
    };
  }

  const requestText = formatCliConversationLabel(trimmed);
  const explicitExecution = String(flags.command || '').trim() === 'task';
  const surfaceOperationalIntentService = runtime.surfaceOperationalIntentService || new SurfaceOperationalIntentService();
  const responseDecision = await surfaceOperationalIntentService.decideResponse({
    surface: 'cli',
    text: requestText,
    explicitExecution,
  });
  const requestedTools = responseDecision.requestedTools;
  const executorOptions = responseDecision.responsePath === 'fast-chat'
    ? {}
    : { executor: createCliUniversalExecutor(runtime, trimmed, flags) };
  const legacyUnifiedGatewayAvailable = Boolean(runtime.legacyUnifiedGateway);
  const modelProfile = resolveCliUniversalModelProfile({
    routingPolicy: resolveCliLegacyUnifiedGateway(runtime) ? 'gateway' : 'fallback',
  });

  const showSpinner = !flags.json && process.stdout.isTTY && !flags.terminalStream;
  const terminalStreamBus = createCliTerminalRuntimeEventBus(flags);
  if (terminalStreamBus && typeof agentGateway.addRuntimeEventBus === 'function') {
    agentGateway.addRuntimeEventBus(terminalStreamBus);
  }
  if (showSpinner) {
    globalSpinner.start('Zavorth is thinking...');
  }

  try {
    const result = await agentGateway.handle({
      userId: flags.userId || 'cli-operator',
      channel: 'cli',
      sessionId: flags.sessionId,
      text: requestText,
      workspace: flags.workspaceHint || process.cwd(),
      requestedTools,
      modelProfile,
      metadata: {
        transport: trimmed.startsWith('/') ? 'slash_command' : 'text',
        source: 'cli',
        originalInput: trimmed,
        responseDecision,
        artifactPolicy: responseDecision.artifactPolicy,
        legacyUnifiedGatewayAvailable,
        legacyUnifiedGatewayBypassed: legacyUnifiedGatewayAvailable,
      },
    }, executorOptions);
    if (flags.terminalAbortSignal?.aborted) {
      return {
        ok: false,
        handled: true,
        output: ['Request interrupted safely. No terminal result was applied.'],
        error: 'interrupted',
      };
    }

    if (showSpinner) {
      globalSpinner.succeed('Zavorth finished reasoning');
    }

    const rawPrimaryReply = String(result.replies[0]?.text || '').trim()
      || result.run.summary
      || 'Request processed by the universal runtime.';
    const approval = result.run.approvals.find((entry) => entry.status === 'pending') || null;
    const primaryReply = new ZavorthUserResponseRendererService().render({
      text: rawPrimaryReply,
      channel: 'cli',
      audience: 'developer',
      run: result.run,
      approvalId: approval?.id || null,
      approvalStatus: approval?.status || null,
      replayCommand: `zavorth replay run ${result.run.id} --json`,
      includeTechnicalFooter: false,
    }).text;

    if (flags.json) {
      const body = JSON.stringify(
        {
          ok: result.ok,
          mode: 'universal_agent_runtime',
          runId: result.run.id,
          requestId: result.run.requestId,
          sessionId: result.run.sessionId,
          status: result.run.status,
          summary: result.run.summary,
          replies: result.replies,
          approvals: result.run.approvals,
          toolExposure: result.run.toolExposure,
          metadata: result.run.metadata,
        },
        null,
        2,
      );
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.run.summary };
    }

    const body = approval
      ? formatCliApprovalRequiredEventCard({
        body: [
          primaryReply,
        ],
        command: `approve ${approval.id}`,
        hints: [
          'Nothing has been executed yet.',
          `To cancel: reject ${approval.id}`,
        ],
      })
      : formatCliChatReplyEventCard(primaryReply)
        || formatCliChatAssistantMessage({
          title: 'Zavorth',
          body: primaryReply,
          hints: [
            `run ${result.run.id}`,
            result.run.metadata?.taskId ? `task ${result.run.metadata.taskId}` : '',
          ].filter(Boolean) as string[],
        });

    writer.line(body);
    await showCurationNotifications(runtime, writer);
    return {
      ok: result.ok,
      handled: true,
      output: [body],
      error: result.ok ? null : result.run.summary,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    if (showSpinner) {
      globalSpinner.fail('Runtime command failed');
    }
    const message = `I could not process this request through the universal runtime: ${err.message}`;
    if (flags.repl) {
      const body = formatCliRecoverableErrorEventCard({
        body: message,
        command: 'doctor',
      });
      writer.line(body);
      return {
        ok: false,
        handled: true,
        output: [body],
        error: message,
      };
    }
    writer.error(message);
    return {
      ok: false,
      handled: true,
      output: [],
      error: message,
    };
  } finally {
    if (terminalStreamBus && typeof agentGateway.removeRuntimeEventBus === 'function') {
      agentGateway.removeRuntimeEventBus(terminalStreamBus);
    }
  }
}

function createCliTerminalRuntimeEventBus(flags: ZavorthCliFlags): { emit: (type: string, payload?: Record<string, unknown>) => Promise<void> } | null {
  const sink = flags.terminalStream || null;
  if (!sink) {
    return null;
  }
  return {
    emit: async (type: string, payload: Record<string, unknown> = {}) => {
      const event = mapRuntimeEventToTerminalStream(type, payload);
      if (event) {
        await sink.onEvent(event);
      }
    },
  };
}

function mapRuntimeEventToTerminalStream(
  type: string,
  payload: Record<string, unknown>,
): CliTerminalStreamEvent | null {
  if (type === 'agent.stream.assistant') {
    const phase = String(payload.phase || '').toLowerCase();
    const done = payload.done === true || phase === 'done';
    const delta = String(payload.delta || '');
    const accumulated = String(payload.accumulated || '');
    return {
      type: done ? 'done' : phase === 'start' ? 'start' : 'delta',
      delta,
      accumulated,
      text: accumulated || delta,
      runId: typeof payload.runId === 'string' ? payload.runId : undefined,
      streamId: typeof payload.streamId === 'string' ? payload.streamId : undefined,
      raw: payload,
    };
  }
  if (type === 'agent.stream.thinking' || type === 'agent.stream.reasoning') {
    const delta = String(payload.delta || payload.text || '');
    return {
      type: 'delta',
      title: 'Thinking',
      status: 'running',
      delta,
      text: delta,
      runId: typeof payload.runId === 'string' ? payload.runId : undefined,
      raw: payload,
    };
  }
  if (type === 'agent.stream.diff') {
    return {
      type: 'delta',
      title: String(payload.filePath || 'File modification'),
      status: 'running',
      text: String(payload.diff || payload.text || ''),
      raw: payload,
    };
  }
  if (type === 'agent.stream.tool') {
    const duration = typeof payload.durationMs === 'number' ? ` (${payload.durationMs}ms)` : '';
    const title = `${String(payload.title || 'Tool activity')}${duration}`;
    return {
      type: 'tool',
      title,
      status: String(payload.streamStatus || payload.phase || 'running'),
      text: String(payload.toolCallDelta || payload.title || 'Tool activity'),
      runId: typeof payload.runId === 'string' ? payload.runId : undefined,
      streamId: typeof payload.streamId === 'string' ? payload.streamId : undefined,
      raw: payload,
    };
  }
  if (type === 'agent.execution.started' || type === 'agent.execution.completed' || type === 'agent.execution.failed') {
    return {
      type: type.endsWith('failed') ? 'error' : 'status',
      title: String(payload.title || type),
      status: String(payload.status || type.split('.').pop() || 'status'),
      text: String(payload.detail || payload.summary || payload.title || type),
      runId: typeof payload.runId === 'string' ? payload.runId : undefined,
      raw: payload,
    };
  }
  return null;
}

/**
 * Splits a free-text "--reason <answer>" flag out of the approval args. The
 * answer is the CLI face of the spine's "other" escape: it denies fail-closed
 * and is relayed verbatim to the agent as decision context.
 */
export function parseCliApprovalReason(args: string): { refArgs: string; reason: string | null } {
  const normalized = String(args || '').trim();
  const marker = /(?:^|\s)--reason(?:=|\s+)/i.exec(normalized);
  if (!marker) {
    return { refArgs: normalized, reason: null };
  }
  const refArgs = normalized.slice(0, marker.index).trim();
  const rawReason = normalized.slice(marker.index + marker[0].length).trim();
  const unquoted = rawReason.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
  return { refArgs, reason: unquoted || null };
}

export async function executeCliUniversalApprovalDecision(
  runtime: ZavorthCliRuntime,
  args: string,
  decision: 'approve' | 'reject',
  flags: ZavorthCliFlags,
  writer: CliWriter,
): Promise<CliExecutionResult | null> {
  const agentGateway = runtime.agentGateway || null;
  const { refArgs, reason } = parseCliApprovalReason(args);
  const approvalRef = String(refArgs || '').trim().split(/\s+/)[0] || '';
  const pendingApproval = agentGateway?.findPendingApproval(approvalRef) || null;
  if (!agentGateway || !approvalRef || !pendingApproval) {
    return null;
  }

  const originalInput = String(
    pendingApproval.run.metadata?.originalInput
      || pendingApproval.run.input
      || '',
  ).trim();
  const approvalOptions = pendingApproval.run.channel === 'cli' && originalInput
    ? { executor: createCliUniversalExecutor(runtime, originalInput, flags) }
    : {};
  const result = decision === 'approve'
    ? await agentGateway.approve(approvalRef, approvalOptions)
    : await agentGateway.reject(approvalRef, { reason });
  if (!result) {
    return null;
  }

  if (flags.json) {
    const body = JSON.stringify(
      {
        ok: result.ok,
        mode: 'universal_agent_runtime_approval',
        decision: result.decision,
        resumed: result.resumed,
        queued: Boolean(result.queued),
        runId: result.run.id,
        status: result.run.status,
        summary: result.run.summary,
        approval: result.approval,
        workflowJob: result.workflowJob || null,
        replies: result.replies,
        error: result.error || null,
      },
      null,
      2,
    );
    writer.line(body);
    return { ok: result.ok, handled: true, output: [body], error: result.error || null };
  }

  if (!result.ok) {
    const body = formatCliRecoverableErrorEventCard({
      body: result.error || result.run.summary,
      command: 'doctor',
    });
    writer.line(body);
    return { ok: false, handled: true, output: [body], error: result.error || result.run.summary };
  }

  const rawReplyText = String(result.replies[0]?.text || '').trim() || result.run.summary;
  const replyText = new ZavorthUserResponseRendererService().render({
    text: rawReplyText,
    channel: 'cli',
    audience: 'developer',
    run: result.run,
    replayCommand: `zavorth replay run ${result.run.id} --json`,
    includeTechnicalFooter: false,
  }).text;
  const body = decision === 'reject'
    ? formatCliSuccessEventCard({
      title: 'Cancelled',
      body: replyText,
    })
    : formatCliChatReplyEventCard(replyText)
      || formatCliChatAssistantMessage({
        title: 'Zavorth',
        body: replyText,
        hints: [`run ${result.run.id}`],
      });

  writer.line(body);
  return {
    ok: true,
    handled: true,
    output: [body],
    error: null,
  };
}

export async function executeCliLegacyUnifiedConversation(
  legacyUnifiedGateway: Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'>,
  normalized: string,
  flags: ZavorthCliFlags,
  writer: CliWriter,
  responseDecision?: ZavorthResponseDecision | null,
): Promise<CliExecutionResult> {
  const replies: string[] = [];
  const trimmed = String(normalized || '').trim();

  try {
    const result = await legacyUnifiedGateway.handleEvent({
      surface: flags.platform,
      chatId: flags.chatId,
      userId: flags.userId,
      text: trimmed,
      isGroup: false,
      reply: async (text: string) => {
        replies.push(String(text || '').trim() || '(empty message)');
      },
      metadata: {
        channel: 'cli',
        stage: 'legacy-unified-cli-v1',
        sessionId: flags.sessionId,
        workspaceContext: flags.workspaceHint || null,
        transport: trimmed.startsWith('/') ? 'slash_command' : 'text',
        cli: true,
        responseDecision: responseDecision || null,
      },
    });

    const outputReplies = Array.from(
      new Set(
        [...replies, String(result.responseText || '').trim()]
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    );

    if (flags.json) {
      const body = JSON.stringify(
        {
          ok: true,
          mode: 'legacy_unified_gateway_adapter',
          responseText: String(result.responseText || '').trim() || null,
          replies: outputReplies,
          surface: result.surface,
          intentCategory: result.intentCategory,
        },
        null,
        2,
      );
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const conversationLabel = formatCliConversationLabel(trimmed);
    const responseText = outputReplies.join('\n\n') || 'Command handled without a text response.';
    const eventReply = outputReplies
      .map((reply) => formatCliChatReplyEventCard(reply))
      .find(Boolean);
    const body = flags.repl
      ? eventReply || formatCliChatAssistantMessage({
        title: 'Zavorth',
        body: responseText,
      })
      : [
        `Request: ${conversationLabel}`,
        `Zavorth: ${responseText}`,
      ].join('\n');

    writer.line(body);
    return {
      ok: true,
      handled: true,
      output: [body],
      error: null,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message = `Could not process this conversation through the unified CLI: ${err.message}`;
    if (flags.repl) {
      const body = formatCliRecoverableErrorEventCard({
        body: message,
        command: 'doctor',
      });
      writer.line(body);
      return {
        ok: false,
        handled: true,
        output: [body],
        error: message,
      };
    }
    writer.error(message);
    return {
      ok: false,
      handled: true,
      output: [],
      error: message,
    };
  }
}

export function resolveCliLegacyUnifiedGateway(
  runtime: Pick<ZavorthCliRuntime, 'legacyUnifiedGateway'> & { agentGateway?: unknown },
): Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'> | null {
  if (runtime.agentGateway) {
    return null;
  }
  return runtime.legacyUnifiedGateway || null;
}

export async function showCurationNotifications(
  runtime: ZavorthCliRuntime,
  writer: CliWriter,
): Promise<void> {
  // 1. Check for memory consolidation
  try {
    const db = await Database.getInstance();
    const recentEpisode = db.get<{ key: string; value: string; created_at: string }>(
      `SELECT key, value, created_at FROM user_memory WHERE category = 'episode' AND created_at >= datetime('now', '-15 seconds') ORDER BY created_at DESC LIMIT 1`
    );
    if (recentEpisode) {
      const card = formatCliCuratorNotificationCard(
        `Memory consolidation: Recent facts were unified into 1 persistent knowledge item (${recentEpisode.key}).`
      );
      writer.line('\n' + card);
    }
  } catch (error: unknown) {
    // ignore
  }

  // 2. Check for newly auto-generated skills (learning candidates)
  try {
    if (runtime.learningPlaneService) {
      const snapshot = runtime.learningPlaneService.buildSnapshot();
      const now = new Date();
      const recentCandidates = snapshot.candidates.filter((c) => {
        if (!c.updatedAt) return false;
        const diffSeconds = (now.getTime() - new Date(c.updatedAt).getTime()) / 1000;
        return diffSeconds >= 0 && diffSeconds <= 15;
      });
      for (const candidate of recentCandidates) {
        const card = formatCliCuratorNotificationCard(
          `New auto-generated skill from your last task: "${candidate.title}" (Confidence: ${Math.round(candidate.score * 100)}%).`
        );
        writer.line('\n' + card);
      }
    }
  } catch (error: unknown) {
    // ignore
  }
}
