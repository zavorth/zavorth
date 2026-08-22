import { asErrorLike } from '../../utils/errorLike';
import { extractMessageContents, sanitizeRequest } from "../shared/utils/inputSanitizer";
import { logger } from '@/shared/utils/logger';

export interface GuardPattern {
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high';
}

export interface GuardOptions {
  mode?: 'block' | 'warn' | 'log';
  enabled?: boolean;
  blockThreshold?: 'low' | 'medium' | 'high';
  customPatterns?: Array<string | RegExp | { name?: string; pattern: string | RegExp; severity?: 'low' | 'medium' | 'high' }>;
  logger?: Console;
}

export interface SanitizeResult {
  flagged: boolean;
  detections: Array<{ pattern: string; severity: string; match: string }>;
  piiDetections: unknown[];
}

export interface GuardResult {
  blocked: boolean;
  result: SanitizeResult;
}

const DEFAULT_GUARD_PATTERNS: GuardPattern[] = [
  {
    name: "system_override_inline",
    pattern: /\bsystem\s*:\s*override\b/i,
    severity: "high",
  },
  {
    name: "markdown_system_block",
    pattern: /```+\s*system\b/i,
    severity: "high",
  },
];

const SEVERITY_SCORES = {
  low: 1,
  medium: 2,
  high: 3,
} as const;

function normalizePatternEntry(entry: string | RegExp | { name?: string; pattern: string | RegExp; severity?: 'low' | 'medium' | 'high' }, index: number): GuardPattern | null {
  if (entry instanceof RegExp) {
    return {
      name: `custom_${index}`,
      pattern: entry,
      severity: "high",
    };
  }

  if (typeof entry === "string") {
    return {
      name: `custom_${index}`,
      pattern: new RegExp(entry, "i"),
      severity: "high",
    };
  }

  if (!entry || (!(entry.pattern instanceof RegExp) && typeof entry.pattern !== "string")) {
    return null;
  }

  return {
    name: entry.name || `custom_${index}`,
    pattern: entry.pattern instanceof RegExp ? entry.pattern : new RegExp(entry.pattern, "i"),
    severity: entry.severity || "high",
  };
}

function detectWithPatterns(text: string, patterns: GuardPattern[]): Array<{ pattern: string; severity: string; match: string }> {
  const detections: Array<{ pattern: string; severity: string; match: string }> = [];

  for (const rule of patterns) {
    const match = text.match(rule.pattern);
    if (match) {
      detections.push({
        pattern: rule.name,
        severity: rule.severity,
        match: match[0].slice(0, 50),
      });
    }
  }

  return detections;
}

function shouldBlock(detections: Array<{ severity: string }>, threshold: string): boolean {
  const minimumSeverity = SEVERITY_SCORES[threshold as keyof typeof SEVERITY_SCORES] || 3;
  return detections.some(
    (d) => (SEVERITY_SCORES[d.severity as keyof typeof SEVERITY_SCORES] || 0) >= minimumSeverity
  );
}

/**
 * Create a prompt injection guard middleware.
 */
export function createInjectionGuard(options: GuardOptions = {}): (body: unknown) => GuardResult {
  const mode =
    options.mode || process.env.INJECTION_GUARD_MODE || process.env.INPUT_SANITIZER_MODE || "warn";
  const enabled = options.enabled ?? process.env.INPUT_SANITIZER_ENABLED !== "false";
  const blockThreshold = options.blockThreshold || options.threshold || "high";
  const loggerInstance = options.logger || console;
  const customPatterns = [...DEFAULT_GUARD_PATTERNS, ...(options.customPatterns || [])]
    .map(normalizePatternEntry)
    .filter((p): p is GuardPattern => p !== null);

  /**
   * Check a request body for prompt injection.
   */
  return function guardRequest(body: unknown): GuardResult {
    if (!enabled || !body || typeof body !== "object") {
      return { blocked: false, result: { flagged: false, detections: [], piiDetections: [] } };
    }

    const result: SanitizeResult = sanitizeRequest(body as Record<string, unknown>, loggerInstance);
    const contents = extractMessageContents(body as Record<string, unknown>);
    const customDetections = detectWithPatterns(contents.join("\n"), customPatterns);

    if (customDetections.length > 0) {
      const existingDetections = new Set(
        result.detections.map((d) => `${d.pattern}:${d.match}:${d.severity}`)
      );

      for (const detection of customDetections) {
        const key = `${detection.pattern}:${detection.match}:${detection.severity}`;
        if (!existingDetections.has(key)) {
          result.detections.push(detection);
        }
      }
    }

    result.flagged = result.detections.length > 0 || result.piiDetections.length > 0;

    if (!result.flagged) {
      return { blocked: false, result };
    }

    if (mode === "block" && shouldBlock(result.detections, blockThreshold)) {
      loggerInstance.warn?.("[InjectionGuard] Blocked request with prompt injection:", {
        detections: result.detections.map((d) => ({ pattern: d.pattern, severity: d.severity })),
      });
      return { blocked: true, result };
    }

    if (mode === "warn" || mode === "log") {
      loggerInstance[mode === "warn" ? "warn" : "info"]?.(
        "[InjectionGuard] Detected potential injection patterns:",
        {
          detections: result.detections.map((d) => ({ pattern: d.pattern, severity: d.severity })),
          pii: result.piiDetections.length,
        }
      );
    }

    return { blocked: false, result };
  };
}

/**
 * Next.js API route handler wrapper for injection guarding.
 */
export function withInjectionGuard(
  handler: (request: Request, context: unknown) => Promise<Response>,
  options: GuardOptions = {}
) {
  const guard = createInjectionGuard(options);

  return async function guardedHandler(request: Request, context: unknown): Promise<Response> {
    // Only apply to POST/PUT/PATCH
    if (!["POST", "PUT", "PATCH"].includes(request.method)) {
      return handler(request, context);
    }

    try {
      // Clone request so body can still be read by handler
      const cloned = request.clone();
      const body = await cloned.json().catch(() => null);

      if (body) {
        const { blocked, result } = guard(body);

        if (blocked) {
          return new Response(
            JSON.stringify({
              error: {
                message: "Request blocked: potential prompt injection detected",
                type: "injection_detected",
                detections: result.detections.length,
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Attach sanitization result as header for downstream handlers
        if (result.flagged) {
          request.headers.set("X-Injection-Flagged", "true");
          request.headers.set("X-Injection-Detections", String(result.detections.length));
        }
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      // Don't block on guard errors — fail open
      logger.warn('[prompt Injection Guard] operation failed', err);
    }

    return handler(request, context);
  };
}
