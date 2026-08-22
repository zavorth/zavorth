import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';

export type ExecutorRecoveryAttempt = {
  request: ExecutionRequest;
  note: string;
};

export class ExecutorRecoveryService {
  public buildRecoveryAttempt(
    executorName: string,
    request: ExecutionRequest,
    result: ExecutionResult,
  ): ExecutorRecoveryAttempt | null {
    const attemptCount = Number(request.metadata?.executor_recovery_attempt || 0);
    if (attemptCount >= 1 || result.success) {
      return null;
    }

    switch (String(executorName || '').trim().toLowerCase()) {
      case 'aistudio':
        return this.buildAiStudioRecovery(request, result);
      case 'stitch':
        return this.buildStitchRecovery(request, result);
      case 'jules':
        return this.buildJulesRecovery(request, result);
      case 'gemini_cli':
      case 'codex':
        return this.buildTimeoutRetry(executorName, request, result);
      default:
        return null;
    }
  }

  public supportsCommandPatch(executorName: string): boolean {
    return ['local', 'local_executor'].includes(String(executorName || '').trim().toLowerCase());
  }

  private buildAiStudioRecovery(
    request: ExecutionRequest,
    result: ExecutionResult,
  ): ExecutorRecoveryAttempt | null {
    if (result.error_code !== 'AISTUDIO_NO_FINAL_RESPONSE') {
      return null;
    }

    return {
      request: this.cloneRequest(request, {
        timeout_seconds: Math.min((request.timeout_seconds || 120) + 60, 300),
        metadata: {
          aistudio_force_final_plain_response: true,
          executor_recovery_attempt: 1,
          executor_recovery_reason: result.error_code,
        },
      }),
      note: 'Google AI Studio did not finish a final response. I will retry with a simple plain-text closure request.',
    };
  }

  private buildStitchRecovery(
    request: ExecutionRequest,
    result: ExecutionResult,
  ): ExecutorRecoveryAttempt | null {
    if (!['STITCH_TIMEOUT', 'STITCH_NETWORK_ERROR', 'STITCH_VALIDATION_ERROR'].includes(String(result.error_code || '').trim())) {
      return null;
    }

    return {
      request: this.cloneRequest(request, {
        timeout_seconds: Math.min((request.timeout_seconds || 240) + 60, 360),
        metadata: {
          stitch_force_compact_prompt: true,
          stitch_model_id: 'GEMINI_3_FLASH',
          executor_recovery_attempt: 1,
          executor_recovery_reason: result.error_code,
        },
      }),
      note: 'Google Stitch failed on the first attempt. Retrying with a compact brief and lighter model to unblock generation.',
    };
  }

  private buildJulesRecovery(
    request: ExecutionRequest,
    result: ExecutionResult,
  ): ExecutorRecoveryAttempt | null {
    if (result.error_code !== 'JULES_API_ERROR') {
      return null;
    }

    return {
      request: this.cloneRequest(request, {
        timeout_seconds: Math.min((request.timeout_seconds || 30) + 30, 90),
        metadata: {
          executor_recovery_attempt: 1,
          executor_recovery_reason: result.error_code,
        },
      }),
      note: 'Jules failed na call inicial da API. Vou repetir a session uma vez before devolver error.',
    };
  }

  private buildTimeoutRetry(
    executorName: string,
    request: ExecutionRequest,
    result: ExecutionResult,
  ): ExecutorRecoveryAttempt | null {
    const haystack = [
      String(result.error_code || ''),
      String(result.error_message || ''),
      String(result.stderr || ''),
    ].join('\n').toLowerCase();

    if (!haystack.includes('timeout')) {
      return null;
    }

    return {
      request: this.cloneRequest(request, {
        timeout_seconds: Math.min((request.timeout_seconds || 120) + 120, 480),
        metadata: {
          executor_recovery_attempt: 1,
          executor_recovery_reason: 'timeout_retry',
        },
      }),
      note: `${executorName} excedeu o tempo limite. Vou repetir uma vez com timeout maior.`,
    };
  }

  private cloneRequest(
    request: ExecutionRequest,
    overrides: {
      timeout_seconds?: number;
      metadata?: Record<string, unknown>;
    },
  ): ExecutionRequest {
    return {
      ...request,
      timeout_seconds: overrides.timeout_seconds ?? request.timeout_seconds,
      metadata: {
        ...(request.metadata || {}),
        ...(overrides.metadata || {}),
      },
    };
  }
}
