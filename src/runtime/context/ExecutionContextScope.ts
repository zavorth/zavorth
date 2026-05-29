import { AsyncLocalStorage } from 'node:async_hooks';
import type { CanonicalRunContext } from '../../contracts/ExecutionLifecycleContract.js';
import type { ProfileRuntimeBundle } from '../../contracts/ProfileManifestContract.js';

export type ExecutionContextScopeSnapshot = CanonicalRunContext & {
  workspace: string | null;
  profileBundle: ProfileRuntimeBundle | null;
  metadata: Readonly<Record<string, unknown>>;
};

export type ExecutionContextScopeInput = CanonicalRunContext & {
  workspace?: string | null;
  profileBundle?: ProfileRuntimeBundle | null;
  metadata?: Record<string, unknown> | null;
};

function freezeMetadata(metadata: Record<string, unknown> | null | undefined): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(metadata || {}) });
}

function normalizeNullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function normalizeText(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : fallback;
}

export class ExecutionContextScope {
  private readonly storage = new AsyncLocalStorage<ExecutionContextScopeSnapshot>();

  public run<T>(context: ExecutionContextScopeInput, callback: () => T): T {
    const snapshot = this.freezeContext(context);
    return this.storage.run(snapshot, callback);
  }

  public current(): ExecutionContextScopeSnapshot | null {
    return this.storage.getStore() || null;
  }

  public requireCurrent(reason = 'Execution context is required for governed runtime work.'): ExecutionContextScopeSnapshot {
    const current = this.current();
    if (!current) {
      throw new Error(reason);
    }
    return current;
  }

  private freezeContext(context: ExecutionContextScopeInput): ExecutionContextScopeSnapshot {
    return Object.freeze({
      traceId: normalizeText(context.traceId, 'unknown-trace'),
      runId: normalizeText(context.runId, 'unknown-run'),
      sessionId: normalizeNullableText(context.sessionId),
      surface: normalizeText(context.surface, 'unknown'),
      requestedBy: normalizeText(context.requestedBy, 'anonymous'),
      profile: normalizeNullableText(context.profile),
      workspace: normalizeNullableText(context.workspace),
      profileBundle: deepFreeze(context.profileBundle || null),
      metadata: freezeMetadata(context.metadata),
    });
  }
}

export const executionContextScope = new ExecutionContextScope();

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    deepFreeze(record[key]);
  }
  return Object.freeze(value);
}
