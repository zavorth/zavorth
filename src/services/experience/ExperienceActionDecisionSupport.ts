import { logger } from '../../logger.js';
import {
  EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceActionCard,
  type ExperienceCommand,
  type ExperienceCommandResult,
  type ExperienceReceipt,
  type ExperienceSnapshot,
} from './ExperienceContracts.js';

import type { ExperienceCoreService } from './ExperienceCoreService.js';

function normalizeKey(value: unknown): string {
  const normalized = String(value || '').normalize('NFD').toLowerCase();
  let output = '';
  let previousWasDash = false;
  for (const char of normalized) {
    const code = char.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036f) {
      continue;
    }
    const keep = (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9');
    if (keep) {
      output += char;
      previousWasDash = false;
      continue;
    }
    if (!previousWasDash) {
      output += '-';
      previousWasDash = true;
    }
  }
  while (output.startsWith('-')) output = output.slice(1);
  while (output.endsWith('-')) output = output.slice(0, -1);
  return output;
}

function isProviderHealingIssue(issue: string): boolean {
  return (
    issue === 'provider_auth' ||
    issue === 'provider_quota' ||
    issue === 'provider_timeout' ||
    issue === 'provider_unavailable'
  );
}

function parseActionCardId(actionId: string, allowedKinds: string[]): { kind: string; value: string } | null {
  for (const kind of allowedKinds) {
    const prefix = `${kind}:`;
    if (actionId.startsWith(prefix)) {
      const value = actionId.slice(prefix.length).trim();
      return value ? { kind, value } : null;
    }
  }
  return null;
}

function parseFirstRunActionId(actionId: string): { key: 'language' | 'surface' | 'learning'; value: string } | null {
  const prefix = 'first-run:';
  if (!actionId.startsWith(prefix)) return null;
  const rest = actionId.slice(prefix.length);
  const separator = rest.indexOf(':');
  if (separator < 0) return null;
  const key = rest.slice(0, separator);
  const value = rest.slice(separator + 1).trim();
  if ((key === 'language' || key === 'surface' || key === 'learning') && value) {
    return { key, value };
  }
  return null;
}

function parseLearningActionId(actionId: string): { kind: 'approve' | 'reject' | 'forget'; value: string } | null {
  const prefix = 'learn:';
  if (!actionId.startsWith(prefix)) return null;
  const rest = actionId.slice(prefix.length);
  const separator = rest.indexOf(':');
  if (separator < 0) return null;
  const kind = rest.slice(0, separator);
  const value = rest.slice(separator + 1).trim();
  if ((kind === 'approve' || kind === 'reject' || kind === 'forget') && value) {
    return { kind, value };
  }
  return null;
}

function parseSelfHealingActionId(actionId: string): { issue: string; action: string } | null {
  const prefix = 'self-healing:';
  if (!actionId.startsWith(prefix)) return null;
  const rest = actionId.slice(prefix.length);
  const separator = rest.indexOf(':');
  if (separator < 0) return null;
  const issue = rest.slice(0, separator).trim();
  const action = rest.slice(separator + 1).trim();
  return issue && action ? { issue, action } : null;
}

function action(input: {
  id: string;
  label: string;
  kind: ExperienceAction['kind'];
  reason: string;
  command?: string | null;
  route?: string | null;
  risk?: ExperienceAction['risk'];
  requiresApproval?: boolean;
}): ExperienceAction {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    command: input.command ?? null,
    route: input.route ?? null,
    risk: input.risk || 'safe',
    requiresApproval: input.requiresApproval === true,
    reason: input.reason,
  };
}

export class ExperienceActionDecisionSupport {
  public constructor(private readonly owner: ExperienceCoreService) {}

  public async handleActionCardDecision(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): Promise<ExperienceCommandResult | null> {
    const actionId = command.actionCardDecision?.actionId || '';
    const approvalMatch = parseActionCardId(actionId, ['approve', 'reject']);
    if (approvalMatch) {
      const decision = approvalMatch.kind as 'approve' | 'reject';
      const approvalId = approvalMatch.value;
      const result =
        decision === 'approve'
          ? await this.owner.agentGateway?.approve(approvalId)
          : await this.owner.agentGateway?.reject(approvalId);
      this.owner.publishRuntimeApprovalDecision(
        {
          ...command,
          approval: { id: approvalId, decision },
        },
        Boolean(result),
      );
      const snapshot = this.owner.buildHome(command);
      const reply = this.owner.replyFromText(
        result
          ? `Action card resolved: ${decision === 'approve' ? 'approved' : 'rejected'} ${approvalId}.`
          : `No pending approval found for ${approvalId}.`,
        command,
        result?.run?.id || snapshot.agent.activeRunId,
      );
      return {
        ok: Boolean(result),
        handled: true,
        plan,
        snapshot,
        replies: [reply],
        receipts: snapshot.receipts,
        error: result ? null : 'Approval not found.',
      };
    }

    const firstRunMatch = parseFirstRunActionId(actionId);
    if (firstRunMatch) {
      const key = firstRunMatch.key;
      const value = firstRunMatch.value;
      const service = this.owner.getFirstRunService(command.userId);
      const snapshotBefore = service.buildSnapshot();
      if (key === 'language') service.applyStep({ language: value });
      if (key === 'surface') service.applyStep({ surface: value });
      if (key === 'learning') service.applyStep({ allowLearning: value === 'learning:on' || value === 'true' || value === 'on' });
      const home = this.owner.buildHome(command);
      const summary = service.needsOnboarding()
        ? service.buildSnapshot().nextPrompt || snapshotBefore.nextPrompt || 'Continue setup.'
        : service.buildSnapshot().welcomeLines.join('\n');
      return {
        ok: true,
        handled: true,
        plan,
        snapshot: home,
        replies: [this.owner.replyFromText(summary, command, home.agent.activeRunId)],
        receipts: home.receipts,
        error: null,
      };
    }

    const learningMatch = parseLearningActionId(actionId);
    if (learningMatch) {
      if (learningMatch.kind === 'forget') {
        const undo = this.owner.undoLearnedRuntimeItem(learningMatch.value, command.userId);
        const snapshot = this.owner.buildHome(command);
        this.owner.attachRuntimeStateSnapshot(snapshot);
        return {
          ok: undo.ok,
          handled: true,
          plan,
          snapshot,
          replies: [this.owner.replyFromText(undo.summary, command, snapshot.agent.activeRunId)],
          receipts: snapshot.receipts,
          error: undo.ok ? null : undo.summary,
        };
      }
      const learning = await this.owner.learningOs.decide({
        candidateId: learningMatch.value,
        decision: learningMatch.kind === 'approve' ? 'approve' : 'reject',
        workspace: command.workspace || null,
      });
      const snapshot = this.owner.buildHome(command);
      this.owner.publishRuntimeLearningDecision(
        {
          ...command,
          learning: {
            candidateId: learningMatch.value,
            decision: learningMatch.kind === 'approve' ? 'approve' : 'reject',
          },
        },
        learning,
      );
      this.owner.attachRuntimeStateSnapshot(snapshot);
      return {
        ok: learning.ok,
        handled: true,
        plan,
        snapshot,
        replies: [this.owner.replyFromText(learning.summary, command, snapshot.agent.activeRunId)],
        receipts: snapshot.receipts,
        error: learning.ok ? null : learning.summary,
      };
    }

    const selfHealingMatch = parseSelfHealingActionId(actionId);
    if (selfHealingMatch) {
      const healingAction = selfHealingMatch.action;
      if (healingAction.includes('configure-provider')) {
        return this.owner.finalizeCommandResult(
          command,
          this.owner.buildContextualSetupResult(command, {
            ...plan,
            kind: 'provider-setup',
            title: 'Provider setup',
            summary: 'Connect a model provider inside the conversation.',
            nextSafeAction: 'Tell me the provider to connect, then provide the credential only when asked.',
          }),
        );
      }
      if (healingAction.includes('configure-channel')) {
        return this.owner.finalizeCommandResult(
          command,
          this.owner.buildContextualSetupResult(command, {
            ...plan,
            kind: 'channel-setup',
            title: 'Channel setup',
            summary: 'Connect a communication surface inside the conversation.',
            nextSafeAction:
              'Tell me the surface to connect, then provide token, webhook or pairing details only when asked.',
          }),
        );
      }
      const snapshot = this.owner.buildHome(command);
      return this.owner.finalizeCommandResult(command, {
        ok: true,
        handled: true,
        plan,
        snapshot,
        replies: [
          this.owner.replyFromText(
            'I have the recovery action. Send the original request again and I will retry with the prepared fallback or ask only for the missing input.',
            command,
            snapshot.agent.activeRunId,
          ),
        ],
        receipts: snapshot.receipts,
        error: null,
      });
    }

    const healingCancelMatch = parseActionCardId(actionId, ['healing:cancel']);
    if (healingCancelMatch) {
      const targetRunId = healingCancelMatch.value || command.actionCardDecision?.cardId || null;
      defaultZavorthSpeculativeAutonomyCancellationRegistry.requestCancel(targetRunId, 'experience-action-card');
      const snapshot = this.owner.buildHome(command);
      return {
        ok: true,
        handled: true,
        plan,
        snapshot,
        replies: [
          this.owner.replyFromText(
            'Auto-healing cancellation recorded. The speculative loop should stop and show the last error instead of consuming more budget.',
            command,
            snapshot.agent.activeRunId,
          ),
        ],
        receipts: snapshot.receipts,
        error: null,
      };
    }

    const snapshot = this.owner.buildHome(command);
    return {
      ok: true,
      handled: true,
      plan,
      snapshot,
      replies: [
        this.owner.replyFromText(
          `Action card ${command.actionCardDecision?.cardId} selected. Action ${actionId} requires the appropriate surface or a new governed plan.`,
          command,
          snapshot.agent.activeRunId,
        ),
      ],
      receipts: snapshot.receipts,
      error: null,
    };
  }

  public buildContextualSetupResult(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): ExperienceCommandResult {
    const snapshot = this.owner.buildHome(command);
    const target = plan.kind === 'provider-setup' ? 'provider' : 'channel';
    const replyText =
      target === 'provider'
        ? [
            'I can connect a model provider from here without exposing secrets.',
            '',
            'Tell me one of these:',
            '- "use Gemini"',
            '- "use OpenRouter"',
            '- "use Ollama local"',
            '- "connect Groq"',
            '',
            'When a key is needed, I will ask for it explicitly, store only a redacted SecretRef path, run an explicit live proof, and create a receipt.',
          ].join('\n')
        : [
            'I can connect a communication surface from here.',
            '',
            'Tell me the surface you want, for example Telegram, Discord, Slack, Signal, WhatsApp, Matrix or Email.',
            'I will ask only for the exact token, webhook, pairing code or allowlisted user id needed by that surface.',
            '',
            'Remote surfaces stay least-privilege until pairing, allowlist and proof receipts exist.',
          ].join('\n');
    return {
      ok: true,
      handled: true,
      plan,
      snapshot,
      replies: [this.owner.replyFromText(replyText, command, snapshot.agent.activeRunId)],
      receipts: snapshot.receipts,
      error: null,
    };
  }

  public contextualSetupKind(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): 'provider-setup' | 'channel-setup' | null {
    if (plan.kind === 'provider-setup' || plan.kind === 'channel-setup') return plan.kind;
    const intent = String(command.intent || '');
    if (intent === 'setup:provider') {
      return 'provider-setup';
    }
    if (intent === 'setup:channel') {
      return 'channel-setup';
    }
    return null;
  }

  public async maybeRetryProviderFallback(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
    firstResult: UniversalAgentRunResult,
  ): Promise<UniversalAgentRunResult> {
    if (firstResult.ok !== false || !this.owner.agentGateway) return firstResult;

    const firstSnapshot = this.owner.buildHome({
      surface: command.surface,
      userId: command.userId,
      sessionId: firstResult.run.sessionId || command.sessionId || null,
      workspace: command.workspace || firstResult.run.workspace || null,
      activeRunId: firstResult.run.id,
      responseProfile: command.responseProfile || null,
    });
    const matrix = this.owner.safeProviderReadinessMatrix();
    const projection = this.owner.selfHealingUx.buildProjection({
      attempted: plan.title,
      commandText: command.text,
      snapshot: firstSnapshot,
      error: firstResult.run.summary || firstResult.replies.map((reply) => reply.text).join('\n'),
      providerMatrix: matrix,
    });
    const fallbackProvider = this.owner.selectFallbackProvider(projection, firstResult.run.modelProfile.providerLabel);
    if (!fallbackProvider || !isProviderHealingIssue(projection.issue)) {
      return firstResult;
    }

    try {
      const retryResult = await this.owner.agentGateway.handle({
        userId: command.userId,
        sessionId: command.sessionId,
        channel: command.surface,
        text: command.text,
        workspace: command.workspace || null,
        metadata: {
          ...(command.metadata || {}),
          providerName: fallbackProvider,
          responseProfile: command.responseProfile || undefined,
          selfHealingProviderFallback: {
            fromProvider: firstResult.run.modelProfile.providerLabel || null,
            selectedProvider: fallbackProvider,
            issue: projection.issue,
            previousRunId: firstResult.run.id,
          },
          experiencePlan: {
            id: plan.id,
            kind: plan.kind,
            risk: plan.risk,
            requiresApproval: plan.requiresApproval,
            autonomyMode: command.autonomyMode,
          },
        },
      });
      this.owner.selfHealingReceipts.append({
        projection,
        action:
          projection.actions.find((candidate) => candidate.kind === 'retry_fallback') || projection.actions[0] || null,
        status: retryResult.ok ? 'applied' : 'failed',
        applied: true,
        fallbackProvider,
        summary: retryResult.ok ? `Provider fallback retried through ${fallbackProvider} after ${projection.issue}.`
          : `Provider fallback through ${fallbackProvider} was attempted but still failed.`,
      });
      return retryResult.ok ? retryResult : firstResult;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.owner.selfHealingReceipts.append({
        projection,
        action:
          projection.actions.find((candidate) => candidate.kind === 'retry_fallback') || projection.actions[0] || null,
        status: 'failed',
        applied: true,
        fallbackProvider,
        summary: `Provider fallback through ${fallbackProvider} failed: ${error instanceof Error ? err.message : String(error || 'unknown error')}.`,
      });
      return firstResult;
    }
  }

  public finalizeCommandResult(command: ExperienceCommand, result: ExperienceCommandResult): ExperienceCommandResult {
    const projection = this.owner.selfHealingUx.buildProjection({
      attempted: result.plan.title,
      commandText: command.text,
      result,
      snapshot: result.snapshot,
    });
    if (!projection.shouldRender) return result;

    const primaryAction = projection.actions[0] || null;
    const status = projection.needsUserInput ? 'needs_user' : projection.canZavorthRepair ? 'proposed' : 'blocked';
    const receipt = this.owner.selfHealingReceipts.append({
      projection,
      action: primaryAction,
      status,
      applied: false,
      summary: projection.problem,
    });
    const selfHealingCards = this.owner.buildSelfHealingActionCards(projection, receipt);
    const snapshot: ExperienceSnapshot = {
      ...result.snapshot,
      actionCards: this.owner.mergeActionCards(selfHealingCards, result.snapshot.actionCards || []),
      receipts: this.owner.mergeExperienceReceipts(
        [this.owner.selfHealingReceiptToExperienceReceipt(receipt)],
        result.snapshot.receipts,
      ),
      raw: {
        ...(result.snapshot.raw || {}),
        selfHealing: projection,
        selfHealingReceipt: receipt,
      },
    };
    return {
      ...result,
      snapshot,
      receipts: snapshot.receipts,
    };
  }

  public buildSelfHealingActionCards(
    projection: ZavorthSelfHealingProjection,
    receipt: ZavorthSelfHealingReceipt,
  ): ExperienceActionCard[] {
    if (projection.issue === 'none') return [];
    return [
      {
        contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
        id: `self-healing:${projection.issue}:${receipt.id.split(':').pop()}`,
        source: 'self-healing',
        title: this.owner.selfHealingCardTitle(projection),
        summary: projection.nextSafeAction,
        risk: this.owner.selfHealingRisk(projection),
        status: projection.needsUserInput || projection.canZavorthRepair ? 'pending' : 'ready',
        scope: projection.setup?.target || 'current request',
        sandbox: projection.setup?.target === 'sandbox' ? 'required' : 'not required',
        affectedFiles: [],
        affectedCommands: projection.actions
          .map((candidate) => candidate.command)
          .filter((entry): entry is string => Boolean(entry)),
        ttlSeconds: 3600,
        receiptHint: receipt.id,
        actions: projection.actions
          .slice(0, 4)
          .map((candidate) => this.owner.selfHealingActionToExperienceAction(projection, candidate)),
        createdAt: receipt.createdAt,
      },
    ];
  }

  public buildSelfHealingCardsFromReceipts(receipts: ZavorthSelfHealingReceipt[]): ExperienceActionCard[] {
    return receipts
      .filter(
        (receipt) => receipt.status === 'proposed' || receipt.status === 'needs_user' || receipt.status === 'failed',
      )
      .slice(0, 3)
      .map((receipt) => {
        const target = receipt.issue.startsWith('channel_') ? 'channel'
          : receipt.issue.startsWith('provider_') ? 'provider'
            : receipt.issue === 'sandbox_unavailable'
              ? 'sandbox'
              : receipt.issue === 'runtime_unavailable'
                ? 'runtime'
                : 'request';
        return {
          contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
          id: `self-healing:receipt:${receipt.id.split(':').pop()}`,
          source: 'self-healing' as const,
          title: receipt.applied ? `Recovered ${target}` : `Recover ${target}`,
          summary: receipt.nextSafeAction,
          risk: receipt.approvalRequired ? ('attention' as const) : ('safe' as const),
          status: receipt.status === 'failed' ? ('blocked' as const) : ('pending' as const),
          scope: target,
          sandbox: target === 'sandbox' ? 'required' : 'not required',
          affectedFiles: [],
          affectedCommands: [],
          ttlSeconds: 3600,
          receiptHint: receipt.id,
          actions: this.owner.actionsForSelfHealingReceipt(receipt),
          createdAt: receipt.createdAt,
        };
      });
  }

  public actionsForSelfHealingReceipt(receipt: ZavorthSelfHealingReceipt): ExperienceAction[] {
    if (receipt.issue.startsWith('provider_')) {
      return [
        action({
          id: `self-healing:${receipt.issue}:configure-provider`,
          label: 'Configure provider',
          kind: 'healing',
          command: 'connect a provider',
          risk: 'safe',
          reason: 'Continue provider setup inside the conversation without exposing secrets.',
        }),
        action({
          id: `self-healing:${receipt.issue}:retry-fallback`,
          label: 'Retry fallback',
          kind: 'healing',
          command: receipt.fallbackProvider ? `retry with ${receipt.fallbackProvider}` : 'retry with fallback',
          risk: 'safe',
          reason: 'Use an allowed gateway fallback route when one is ready.',
        }),
      ];
    }
    if (receipt.issue.startsWith('channel_')) {
      return [
        action({
          id: `self-healing:${receipt.issue}:configure-channel`,
          label: 'Connect surface',
          kind: 'healing',
          command: 'connect a channel',
          risk: 'safe',
          reason: 'Collect only the missing token, webhook or pairing detail.',
        }),
      ];
    }
    if (receipt.issue === 'approval_required') {
      return [
        action({
          id: `self-healing:${receipt.issue}:review-approval`,
          label: 'Review approval',
          kind: 'approval',
          command: 'review pending approval',
          risk: 'attention',
          requiresApproval: false,
          reason: 'Show scope, risk and receipt preview before deciding.',
        }),
      ];
    }
    return [
      action({
        id: `self-healing:${receipt.issue}:inspect`,
        label: 'Inspect recovery',
        kind: 'healing',
        risk: 'attention',
        reason: receipt.summary,
      }),
    ];
  }

  public selfHealingActionToExperienceAction(
    projection: ZavorthSelfHealingProjection,
    healingAction: ZavorthSelfHealingAction,
  ): ExperienceAction {
    return action({
      id: `self-healing:${projection.issue}:${healingAction.id}`,
      label: healingAction.label,
      kind: 'healing',
      command: healingAction.command || healingAction.prompt || null,
      risk: this.owner.selfHealingRisk(projection),
      requiresApproval: healingAction.approvalRequired,
      reason: healingAction.detail,
    });
  }

  public selfHealingReceiptToExperienceReceipt(receipt: ZavorthSelfHealingReceipt): ExperienceReceipt {
    return {
      id: receipt.id,
      title: receipt.applied ? `Self-healing applied: ${receipt.issue}` : `Self-healing prepared: ${receipt.issue}`,
      detail: receipt.summary,
      status:
        receipt.status === 'applied' || receipt.status === 'skipped'
          ? 'ready'
          : receipt.status === 'failed'
            ? 'failed'
            : receipt.status === 'blocked'
              ? 'blocked'
              : 'pending',
      source: 'self-healing',
      createdAt: receipt.createdAt,
    };
  }

  public selfHealingCardTitle(projection: ZavorthSelfHealingProjection): string {
    if (projection.issue.startsWith('provider_')) return 'Provider recovery';
    if (projection.issue.startsWith('channel_')) return 'Channel setup';
    if (projection.issue === 'approval_required') return 'Approval needed';
    if (projection.issue === 'sandbox_unavailable') return 'Sandbox recovery';
    if (projection.issue === 'runtime_unavailable') return 'Runtime recovery';
    return 'Recovery plan';
  }

  public selfHealingRisk(projection: ZavorthSelfHealingProjection): ExperienceAction['risk'] {
    if (projection.issue === 'approval_required' || projection.issue === 'sandbox_unavailable') return 'attention';
    if (projection.issue === 'runtime_unavailable') return 'attention';
    if (projection.issue === 'unknown_failure') return 'attention';
    return 'safe';
  }

  public mergeExperienceReceipts(primary: ExperienceReceipt[], secondary: ExperienceReceipt[]): ExperienceReceipt[] {
    const seen = new Set<string>();
    return [...primary, ...secondary]
      .filter((receipt) => {
        if (seen.has(receipt.id)) return false;
        seen.add(receipt.id);
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 12);
  }

  public mergeActionCards(primary: ExperienceActionCard[], secondary: ExperienceActionCard[]): ExperienceActionCard[] {
    const seen = new Set<string>();
    return [...primary, ...secondary]
      .filter((card) => {
        if (seen.has(card.id)) return false;
        seen.add(card.id);
        return true;
      })
      .slice(0, 12);
  }

  public safeProviderReadinessMatrix() {
    try {
      return this.owner.providerReadinessMatrix.buildSnapshot({
        includeAdvanced: false,
        probe: false,
        live: false,
      });
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] safeProviderReadinessMatrix failed:', error);
      return null;
    }
  }

  public selectFallbackProvider(
    projection: ZavorthSelfHealingProjection,
    attemptedProvider: string | null | undefined,
  ): string | null {
    const attempted = normalizeKey(attemptedProvider);
    for (const candidate of projection.fallback?.candidates || []) {
      if (normalizeKey(candidate) && normalizeKey(candidate) !== attempted) return candidate;
    }
    return null;
  }

  public replyFromText(text: string, command: ExperienceCommand, runId: string | null) {
    return {
      id: `experience-reply:${Date.now().toString(36)}`,
      role: 'assistant' as const,
      text,
      createdAt: this.owner.now().toISOString(),
      runId,
    };
  }
}
