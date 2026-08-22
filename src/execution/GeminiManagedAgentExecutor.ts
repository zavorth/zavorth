import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import type { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import type { IExecutor } from '../contracts/IExecutor.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { mapGeminiInteractionToReceipt } from '../providers/GeminiInteractionsProviderAdapter.js';
import { asErrorLike } from '../utils/errorLike.js';

export type GeminiManagedAgentExecutorOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
  agent?: string | null;
  fetchImpl?: typeof fetch;
};

interface GeminiManagedAgentInteraction {
  id?: string | null;
  name?: string | null;
  output_text?: string | null;
}

export class GeminiManagedAgentExecutor implements IExecutor {
  public readonly name = 'gemini_managed_agent';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly agent: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: GeminiManagedAgentExecutorOptions = {}) {
    this.apiKey = String(options.apiKey || config.geminiInteractionsApiKey || config.geminiApiKey || '').trim();
    this.baseUrl = String(options.baseUrl || config.geminiManagedAgentsBaseUrl || 'https://generativelanguage.googleapis.com/v1beta')
      .trim()
      .replace(/\/+$/, '');
    this.model = String(options.model || config.geminiManagedAgentsModel || 'gemini-2.5-flash').trim();
    this.agent = String(options.agent || config.geminiManagedAgentsAgent || 'zavorth-managed-agent').trim();
    this.fetchImpl = options.fetchImpl;
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const result = this.createResult(request, startedAt);
    const prompt = request.instructions.join('\n').trim() || request.objective;

    if (!config.geminiManagedAgentsEnabled && process.env.ZAVORTH_GEMINI_MANAGED_AGENTS_ENABLED !== 'true') {
      result.error_code = 'GEMINI_MANAGED_AGENT_DISABLED';
      result.error_message = 'Gemini Managed Agents is disabled. Set ZAVORTH_GEMINI_MANAGED_AGENTS_ENABLED=true and approve usage before running.';
      return this.finish(result);
    }

    if (!this.apiKey) {
      result.error_code = 'GEMINI_MANAGED_AGENT_AUTH_MISSING';
      result.error_message = 'Missing GEMINI_INTERACTIONS_API_KEY or GEMINI_API_KEY for Gemini Managed Agents.';
      return this.finish(result);
    }

    if (!request.metadata?.approval_id && !request.metadata?.approved) {
      result.error_code = 'GEMINI_MANAGED_AGENT_APPROVAL_REQUIRED';
      result.error_message = 'Managed Agents run in a remote sandbox and require explicit Zavorth approval.';
      result.metadata = {
        suggested_scope: 'once',
        suggested_backend: this.name,
        model: this.model,
      };
      return this.finish(result);
    }

    try {
      result.actions_executed.push('[Gemini Managed Agent] Criando interaction governada...');
      const body = await this.createInteraction(prompt, request);
      const receipt = mapGeminiInteractionToReceipt(body, this.model, null, Boolean(config.geminiManagedAgentsStore));
      result.success = true;
      result.stdout = body?.output_text
        || receipt.steps.filter((step) => step.kind === 'model_output' && step.text).map((step) => step.text).join('\n')
        || 'Gemini Managed Agent completed a interaction.';
      result.actions_executed.push(`[Gemini Managed Agent] Interaction ${body?.id || body?.name || 'without-id'} completed.`);
      result.metadata = {
        gemini_managed_agent: {
          provider: 'gemini',
          backend: this.name,
          model: this.model,
          agent: this.agent,
          interactionId: body?.id || body?.name || null,
          steps: receipt.steps,
          storedServerSide: Boolean(config.geminiManagedAgentsStore),
        },
      };
    } catch (error: unknown) {
      asErrorLike(error);
      result.error_code = 'GEMINI_MANAGED_AGENT_API_ERROR';
      result.error_message = `Gemini Managed Agent API error: ${(error as Error)?.message || String(error)}`;
    }

    return this.finish(result);
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(config.geminiManagedAgentsEnabled && this.apiKey);
  }

  private async createInteraction(prompt: string, request: ExecutionRequest): Promise<GeminiManagedAgentInteraction> {
    const payload = {
      model: this.model,
      agent: this.agent,
      input: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'You are running as a governed Zavorth remote managed agent.',
                `Workspace label: ${request.workspace}`,
                `Objective: ${request.objective}`,
                prompt,
              ].filter(Boolean).join('\n\n'),
            },
          ],
        },
      ],
      background: Boolean(request.metadata?.background),
      store: Boolean(config.geminiManagedAgentsStore),
      metadata: {
        execution_id: request.execution_id,
        task_id: request.task_id,
        zavorth_backend: this.name,
      },
    };

      const response = await this.requestSafe(`${this.baseUrl}/interactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.error?.message || body?.message || `HTTP ${response.status}`;
      throw new Error(detail);
    }
    return body;
  }

  private async requestSafe(url: string, init: RequestInit): Promise<Response> {
    if (this.fetchImpl) {
      return this.fetchImpl(url, init);
    }
    return safeFetch(url, init, { serviceName: 'Gemini Managed Agent' });
  }

  private createResult(request: ExecutionRequest, startedAt: string): ExecutionResult {
    return {
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
  }

  private finish(result: ExecutionResult): ExecutionResult {
    result.finished_at = new Date().toISOString();
    return result;
  }
}
