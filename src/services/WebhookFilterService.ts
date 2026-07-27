/**
 * Declarative webhook route predicates — evaluate payload fields against rules.
 */

export type WebhookRoutePredicate =
  | { all: WebhookRoutePredicate[] }
  | { any: WebhookRoutePredicate[] }
  | { not: WebhookRoutePredicate }
  | {
      field?: string;
      eq?: unknown;
      ne?: unknown;
      in?: unknown[];
      contains?: string;
      regex?: string;
      exists?: boolean;
    };

export type WebhookRouteContext = {
  event: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
};

export class WebhookRouteMatcher {
  /**
   * Evaluate a predicate against route context. Missing/empty predicate → match.
   */
  public matches(predicate: WebhookRoutePredicate | null | undefined, context: WebhookRouteContext): boolean {
    if (predicate == null) return true;
    try {
      return this.evalPredicate(predicate, context);
    } catch {
      return false;
    }
  }

  /**
   * Parse JSON/string into a route predicate. Invalid shapes return null (match-all).
   */
  public parsePredicate(value: unknown): WebhookRoutePredicate | null {
    if (value == null) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        return this.parsePredicate(JSON.parse(trimmed));
      } catch {
        return { field: 'event', eq: trimmed };
      }
    }
    if (typeof value !== 'object') return null;
    return value as WebhookRoutePredicate;
  }

  private evalPredicate(spec: WebhookRoutePredicate, context: WebhookRouteContext): boolean {
    if ('all' in spec && Array.isArray(spec.all)) {
      return spec.all.every((item) => this.evalPredicate(item, context));
    }
    if ('any' in spec && Array.isArray(spec.any)) {
      return spec.any.some((item) => this.evalPredicate(item, context));
    }
    if ('not' in spec && spec.not) {
      return !this.evalPredicate(spec.not, context);
    }

    const leaf = spec as {
      field?: string;
      eq?: unknown;
      ne?: unknown;
      in?: unknown[];
      contains?: string;
      regex?: string;
      exists?: boolean;
    };

    if (!leaf.field) {
      if (leaf.eq !== undefined) return String(context.event) === String(leaf.eq);
      return true;
    }

    const resolved = this.resolveField(leaf.field, context);
    if (leaf.exists === true) return resolved !== undefined && resolved !== null;
    if (leaf.exists === false) return resolved === undefined || resolved === null;

    if (leaf.eq !== undefined) return deepEqual(resolved, leaf.eq);
    if (leaf.ne !== undefined) return !deepEqual(resolved, leaf.ne);
    if (Array.isArray(leaf.in)) return leaf.in.some((item) => deepEqual(resolved, item));
    if (leaf.contains !== undefined) {
      return stringify(resolved).includes(String(leaf.contains));
    }
    if (leaf.regex) {
      try {
        return new RegExp(String(leaf.regex), 'i').test(stringify(resolved));
      } catch {
        return false;
      }
    }
    return true;
  }

  private resolveField(field: string, context: WebhookRouteContext): unknown {
    const path = String(field || '').trim();
    if (!path) return undefined;
    if (path === 'event' || path === 'event_type') return context.event;
    if (path.startsWith('headers.') || path.startsWith('header.')) {
      const key = path.replace(/^headers...\./i, '');
      const headers = context.headers || {};
      const found = headers[key] ?? headers[key.toLowerCase()];
      return Array.isArray(found) ? found.join(',') : found;
    }
    if (path.startsWith('payload.')) {
      return getPath(context.payload, path.slice('payload.'.length));
    }
    if (path.startsWith('body.')) {
      return getPath(context.payload, path.slice('body.'.length));
    }
    return getPath({ event: context.event, payload: context.payload, body: context.payload, ...context.payload }, path);
  }
}

function getPath(root: unknown, dotted: string): unknown {
  if (!dotted) return root;
  const parts = dotted.split('.').filter(Boolean);
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) === Number(b);
  }
  return stringify(a) === stringify(b);
}
