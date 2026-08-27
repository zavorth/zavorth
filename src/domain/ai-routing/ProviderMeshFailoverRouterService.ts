export type ProviderErrorKind =
  | 'rate_limit_429'
  | 'credit_exhausted_402'
  | 'timeout_504'
  | 'context_overflow'
  | 'server_error_5xx'
  | 'unknown';

export interface ProviderErrorClassification {
  readonly kind: ProviderErrorKind;
  readonly isRetryableOnAlternateProvider: boolean;
  readonly message: string;
  readonly statusCode?: number;
}

export interface ProviderRouteCandidate {
  readonly providerId: string;
  readonly model: string;
  readonly priority: number;
  readonly isLocal?: boolean;
}

export interface ProviderAttemptRecord {
  readonly providerId: string;
  readonly model: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: string;
  readonly errorKind?: ProviderErrorKind;
}

export interface FailoverExecutionResult<T> {
  readonly success: boolean;
  readonly result?: T;
  readonly activeProviderId: string;
  readonly activeModel: string;
  readonly totalAttempts: number;
  readonly attemptHistory: readonly ProviderAttemptRecord[];
  readonly finalError?: string;
}

export class ProviderMeshFailoverRouterService {
  public classifyError(error: unknown): ProviderErrorClassification {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const lower = rawMessage.toLowerCase();
    const status = (error as { status?: number; statusCode?: number })?.status || (error as { statusCode?: number })?.statusCode;

    if (status === 429 || lower.includes('rate limit') || lower.includes('quota exceeded') || lower.includes('tpm')) {
      return {
        kind: 'rate_limit_429',
        isRetryableOnAlternateProvider: true,
        message: rawMessage,
        statusCode: 429,
      };
    }

    if (status === 402 || lower.includes('insufficient_quota') || lower.includes('credit') || lower.includes('balance')) {
      return {
        kind: 'credit_exhausted_402',
        isRetryableOnAlternateProvider: true,
        message: rawMessage,
        statusCode: 402,
      };
    }

    if (status === 504 || lower.includes('timeout') || lower.includes('etimedout') || lower.includes('timed out')) {
      return {
        kind: 'timeout_504',
        isRetryableOnAlternateProvider: true,
        message: rawMessage,
        statusCode: 504,
      };
    }

    if (lower.includes('maximum context length') || lower.includes('context window') || lower.includes('prompt is too long')) {
      return {
        kind: 'context_overflow',
        isRetryableOnAlternateProvider: false,
        message: rawMessage,
      };
    }

    if (typeof status === 'number' && status >= 500 && status < 600) {
      return {
        kind: 'server_error_5xx',
        isRetryableOnAlternateProvider: true,
        message: rawMessage,
        statusCode: status,
      };
    }

    return {
      kind: 'unknown',
      isRetryableOnAlternateProvider: false,
      message: rawMessage,
      statusCode: status,
    };
  }

  public async executeWithFailover<T>(
    candidates: readonly ProviderRouteCandidate[],
    requestExecutor: (candidate: ProviderRouteCandidate) => Promise<T>
  ): Promise<FailoverExecutionResult<T>> {
    if (candidates.length === 0) {
      return {
        success: false,
        activeProviderId: '',
        activeModel: '',
        totalAttempts: 0,
        attemptHistory: [],
        finalError: 'No provider candidates configured for routing.',
      };
    }

    const sortedCandidates = [...candidates].sort((a, b) => a.priority - b.priority);
    const history: ProviderAttemptRecord[] = [];

    for (const candidate of sortedCandidates) {
      const start = Date.now();
      try {
        const result = await requestExecutor(candidate);
        const durationMs = Date.now() - start;

        history.push({
          providerId: candidate.providerId,
          model: candidate.model,
          durationMs,
          success: true,
        });

        return {
          success: true,
          result,
          activeProviderId: candidate.providerId,
          activeModel: candidate.model,
          totalAttempts: history.length,
          attemptHistory: history,
        };
      } catch (err: unknown) {
        const durationMs = Date.now() - start;
        const classification = this.classifyError(err);

        history.push({
          providerId: candidate.providerId,
          model: candidate.model,
          durationMs,
          success: false,
          error: classification.message,
          errorKind: classification.kind,
        });

        // If error is not retryable (e.g. client error or permanent context overflow without larger model), halt
        if (!classification.isRetryableOnAlternateProvider) {
          return {
            success: false,
            activeProviderId: candidate.providerId,
            activeModel: candidate.model,
            totalAttempts: history.length,
            attemptHistory: history,
            finalError: `Non-retryable provider error on ${candidate.providerId}: ${classification.message}`,
          };
        }
      }
    }

    const lastAttempt = history[history.length - 1];
    return {
      success: false,
      activeProviderId: lastAttempt?.providerId || '',
      activeModel: lastAttempt?.model || '',
      totalAttempts: history.length,
      attemptHistory: history,
      finalError: `All ${candidates.length} provider fallback candidates failed. Last error: ${lastAttempt?.error}`,
    };
  }
}
