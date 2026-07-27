import { v4 as uuidv4 } from 'uuid';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { IExecutor } from '../contracts/IExecutor.js';
import { config } from '../config/index.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { asErrorLike } from '../utils/errorLike.js';

/**
 * JulesExecutor — Integra o Google Jules AI Agent via REST API.
 *
 * Creates asynchronous Jules sessions, polls status,
 * and returns the result (diff/PR) when the session completes.
 *
 * API Base: https://jules.googleapis.com/v1alpha
 * Auth: X-Goog-Api-Key header
 */
export class JulesExecutor implements IExecutor {
  public readonly name = 'jules';

  private readonly baseUrl = 'https://jules.googleapis.com/v1alpha';
  private readonly maxPollAttempts = 60;
  private readonly pollIntervalMs = 5000;

  private get apiKey(): string {
    return (config as any).julesApiKey || process.env.JULES_API_KEY || '';
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const result: ExecutionResult = {
      execution_id: request.execution_id || uuidv4(),
      task_id: request.task_id,
      executor: this.name,
      success: false,
      started_at: startedAt,
      finished_at: '',
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: null,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    };

    const prompt = request.instructions.join('\n').trim();
    if (!prompt) {
      result.error_message = 'No prompt was provided for Jules.';
      result.finished_at = new Date().toISOString();
      return result;
    }

    const repoSource = request.metadata?.jules_repo_source || request.metadata?.task_metadata?.jules_repo_source || '';

    try {
      // 1. Create session.
      result.actions_executed.push('[Jules] Creating session...');
      const session = await this.createSession(prompt, repoSource);
      const sessionId = session.name;
      result.metadata.jules_session_id = sessionId;
      result.actions_executed.push(`[Jules] Session created: ${sessionId}`);

      // 2. Poll until completion.
      let pollCount = 0;
      let sessionState: any = null;
      const maxSyncPollAttempts = this.resolveMaxSyncPollAttempts(request.timeout_seconds);

      while (pollCount < maxSyncPollAttempts) {
        await this.sleep(this.pollIntervalMs);
        sessionState = await this.getSession(sessionId);
        const state = sessionState.state || sessionState.status || '';

        if (state === 'COMPLETED' || state === 'SUCCEEDED') {
          result.success = true;
          result.stdout = sessionState.result?.summary || sessionState.summary || 'Jules session completed.';
          result.diff_summary = sessionState.result?.diffUrl || sessionState.diffUrl || null;
          result.actions_executed.push(`[Jules] Session completed after ${pollCount + 1} polls.`);
          break;
        }

        if (state === 'FAILED' || state === 'CANCELLED') {
          result.error_message = sessionState.error?.message || `Jules session ${state.toLowerCase()}.`;
          result.error_code = 'JULES_SESSION_FAILED';
          result.actions_executed.push(`[Jules] Session ${state}: ${result.error_message}`);
          break;
        }

        if (state === 'AWAITING_USER_INPUT' || state === 'PLAN_REVIEW') {
          // Pause and wait for external approval.
          result.error_message = `Jules session is waiting for plan approval. SessionId: ${sessionId}`;
          result.error_code = 'JULES_AWAITING_APPROVAL';
          result.metadata.jules_requires_approval = true;
          result.actions_executed.push(`[Jules] Session waiting for plan approval.`);
          break;
        }

        pollCount++;
      }

      if (pollCount >= maxSyncPollAttempts && !result.success && !result.error_message) {
        result.error_message = `Jules session started and is still running. SessionId: ${sessionId}`;
        result.error_code = 'JULES_PENDING';
        result.metadata.jules_pending = true;
      }

    } catch (error: unknown) {
      const err = asErrorLike(error);
      result.error_message = `Jules API error: ${err.message}`;
      result.error_code = 'JULES_API_ERROR';
      result.actions_executed.push(`[Jules] Error: ${err.message}`);
    }

    result.finished_at = new Date().toISOString();
    return result;
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await safeFetch(`${this.baseUrl}/sessions...pageSize=1`, {
        headers: { 'X-Goog-Api-Key': this.apiKey },
      }, {
        serviceName: 'Jules availability check',
      });
      return res.ok || res.status === 200;
    } catch (error: unknown) {return false;
    }
  }

  public async inspectSession(sessionId: string): Promise<any> {
    return this.getSession(sessionId);
  }

  private async createSession(prompt: string, repoSource: string): Promise<any> {
    const body: any = {
      prompt,
      requirePlanApproval: true,
    };

    if (repoSource) {
      body.sourceContext = {
        source: repoSource,
      };
    }

    const res = await safeFetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }, {
      serviceName: 'Jules session create',
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jules API: ${res.status} ${res.statusText} - ${text}`);
    }

    return res.json();
  }

  private async getSession(sessionId: string): Promise<any> {
    const res = await safeFetch(`${this.baseUrl}/${sessionId}`, {
      headers: { 'X-Goog-Api-Key': this.apiKey },
    }, {
      serviceName: 'Jules session inspect',
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jules API GET: ${res.status} ${res.statusText} - ${text}`);
    }

    return res.json();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resolveMaxSyncPollAttempts(timeoutSeconds?: number): number {
    const requestedSeconds = Math.max(5, timeoutSeconds || 30);
    const boundedSeconds = Math.min(requestedSeconds, 30);
    return Math.max(1, Math.min(this.maxPollAttempts, Math.floor((boundedSeconds * 1000) / this.pollIntervalMs)));
  }
}
