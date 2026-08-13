import { config } from '../config/index.js';
import type { CodexRemoteSessionRecord } from './CodexRemoteSessionStoreService.js';
import { logger } from '../logger.js';
import { errorMessage } from '../utils/errorLike.js';
type CodexRemoteNotificationRuntime = {
  fetchImpl?: typeof fetch;
};

export type CodexRemoteNotificationResult = {
  delivered: boolean;
  targetChatId: string | null;
  reason: string;
};

type RuntimePresenceMetadata = {
  state?: string;
  runtimeSeconds?: number | null;
  heartbeatAgeMs?: number | null;
  stale?: boolean;
};

type RuntimeGuardrailMetadata = {
  state?: string;
  summary?: string;
  timeoutSeconds?: number | null;
  remainingSeconds?: number | null;
};

export class CodexRemoteNotificationService {
  private readonly fetchImpl: typeof fetch;

  constructor(runtime: CodexRemoteNotificationRuntime = {}) {
    this.fetchImpl = runtime.fetchImpl || fetch;
  }

  public async notifySessionEvent(
    session: CodexRemoteSessionRecord,
    input: {
      headline: string;
      summary: string;
      status: string;
    },
  ): Promise<CodexRemoteNotificationResult> {
    const targetChatId = this.normalizeTelegramChatId(session.sourceChatId);
    if (!config.telegramBotToken) {
      return {
        delivered: false,
        targetChatId,
        reason: 'telegram-disabled',
      };
    }
    if (!targetChatId) {
      return {
        delivered: false,
        targetChatId: null,
        reason: 'missing-chat-id',
      };
    }

    const lines = [
      input.headline,
      '',
      `${session.title} (${session.sessionId})`,
      `Status: ${input.status}.`,
      `Perfil: ${session.profileId}.`,
      `Workspace: ${session.workspaceRoot}.`,
      this.buildPresenceLine(session),
      this.buildGuardrailLine(session),
      input.summary,
    ].filter(Boolean);

    try {
      const response = await this.fetchImpl(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          chat_id: targetChatId,
          text: lines.join('\n'),
        }),
      });

      return {
        delivered: response.ok,
        targetChatId,
        reason: response.ok ? 'delivered' : `http-${response.status}`,
      };
    } catch (error: unknown) {logger.warn('[Codex Remote Notification] network request failed', error);
    return {
        delivered: false,
        targetChatId,
        reason: errorMessage(error, 'notification-failed'),
      };
  }
  }

  public normalizeTelegramChatId(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }
    if (/^-?\d+$/.test(normalized)) {
      return normalized;
    }
    const parts = normalized.split(':').reverse();
    const numeric = parts.find((entry) => /^-?\d+$/.test(entry.trim()));
    return numeric ? numeric.trim() : null;
  }

  private buildPresenceLine(session: CodexRemoteSessionRecord): string {
    const metadata = this.readRuntimeMetadata(session);
    const presence = metadata.presence;
    if (!presence) {
      return 'Presence: n/d.';
    }
    const runtime = presence.runtimeSeconds !== null && presence.runtimeSeconds !== undefined ? `${presence.runtimeSeconds}s`
      : 'n/d';
    const heartbeatAge = presence.heartbeatAgeMs !== null && presence.heartbeatAgeMs !== undefined ? `${Math.round(presence.heartbeatAgeMs / 1000)}s`
      : 'n/d';
    return `Presence: ${presence.state || 'n/d'} | runtime=${runtime} | heartbeat-age=${heartbeatAge} | stale=${presence.stale ? 'yes' : 'no'}.`;
  }

  private buildGuardrailLine(session: CodexRemoteSessionRecord): string {
    const metadata = this.readRuntimeMetadata(session);
    const guardrail = metadata.guardrails;
    if (!guardrail) {
      return 'Guardrail: n/d.';
    }
    const timeout = guardrail.timeoutSeconds !== null && guardrail.timeoutSeconds !== undefined ? `${guardrail.timeoutSeconds}s`
      : 'n/d';
    const remaining = guardrail.remainingSeconds !== null && guardrail.remainingSeconds !== undefined ? `${guardrail.remainingSeconds}s`
      : 'n/d';
    const summary = guardrail.summary || 'Sem additional summary.';
    return `Guardrail: ${guardrail.state || 'n/d'} | timeout=${timeout} | remaining=${remaining} | ${summary}`;
  }

  private readRuntimeMetadata(session: CodexRemoteSessionRecord): {
    presence: RuntimePresenceMetadata | null;
    guardrails: RuntimeGuardrailMetadata | null;
  } {
    const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
    return {
      presence: metadata.codexRemotePresence && typeof metadata.codexRemotePresence === 'object'
        ? metadata.codexRemotePresence as RuntimePresenceMetadata
        : null,
      guardrails: metadata.codexRemoteGuardrails && typeof metadata.codexRemoteGuardrails === 'object'
        ? metadata.codexRemoteGuardrails as RuntimeGuardrailMetadata
        : null,
    };
  }
}
