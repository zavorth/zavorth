export type RuntimeIsolationMode = 'guarded' | 'host' | 'ephemeral' | 'sidecar';

export type RuntimeIsolationSurface =
  | 'remote_shell'
  | 'browser'
  | 'websocket_session'
  | 'secret_resolution'
  | 'high_risk_approval';

export type RuntimeIsolationGuardInput = {
  surface: RuntimeIsolationSurface;
  action: string;
  argv?: string[];
  requestedMode?: unknown;
  ephemeralAdapterAvailable?: boolean;
  sidecarAvailable?: boolean;
  approval?: {
    required?: boolean;
    ticket?: string | null;
  };
};

export type RuntimeIsolationGuardDecision = {
  ok: boolean;
  mode: RuntimeIsolationMode;
  code:
    | 'allowed'
    | 'invalid-isolation-mode'
    | 'ephemeral-adapter-required'
    | 'sidecar-required'
    | 'raw-secret-blocked'
    | 'approval-ticket-required';
  reason: string;
  audit: {
    surface: RuntimeIsolationSurface;
    action: string;
    mode: RuntimeIsolationMode;
    ephemeral: boolean;
    sidecar: boolean;
    rawSecretBlocked: boolean;
    secretRefPlaceholders: string[];
    approvalTicketRequired: boolean;
    approvalTicketProvided: boolean;
    sanitizedArgv: string[];
  };
};

const VALID_MODES = new Set<RuntimeIsolationMode>(['guarded', 'host', 'ephemeral', 'sidecar']);
const SECRET_REF_PATTERN = /<SecretRef:[A-Za-z0-9_.:-]+>/g;
const BEARER_SECRET_PATTERN = /\b(authorization\s*:\s*bearer\s+)([^\s]+)/iu;
const SECRET_ASSIGNMENT_PATTERN = /\b([A-Z0-9_]*(?:API|AUTH|CREDENTIAL|PASSWORD|SECRET|TOKEN|KEY)[A-Z0-9_]*)=([^\s]+)/iu;
const SECRET_KEY_VALUE_PATTERN = /\b(api[_-]...key|auth(?:orization)...|credential|password|secret|token)(\s*[:=]\s*)([^\s]+)/iu;
const SECRET_FLAG_PATTERN = /^-{1,2}(?:api[_-]...key|auth(?:orization)...|credential|password|secret|token)$/iu;

export class RuntimeIsolationGuardService {
  public guard(input: RuntimeIsolationGuardInput): RuntimeIsolationGuardDecision {
    const modeResolution = this.resolveMode(input);
    const placeholders = this.collectSecretRefPlaceholders(input.argv || []);
    const sanitizedArgv = this.redactArgvForAudit(input.argv || []);
    const auditBase = {
      surface: input.surface,
      action: input.action,
      mode: modeResolution.mode,
      ephemeral: modeResolution.mode === 'ephemeral',
      sidecar: modeResolution.mode === 'sidecar',
      rawSecretBlocked: false,
      secretRefPlaceholders: placeholders,
      approvalTicketRequired: Boolean(input.approval?.required),
      approvalTicketProvided: Boolean(String(input.approval?.ticket || '').trim()),
      sanitizedArgv,
    };

    if (!modeResolution.ok) {
      return {
        ok: false,
        mode: modeResolution.mode,
        code: 'invalid-isolation-mode',
        reason: `Modo de isolamento invalid: ${modeResolution.rawMode}. Use guarded, host ou ephemeral.`,
        audit: auditBase,
      };
    }

    if (modeResolution.mode === 'ephemeral' && input.ephemeralAdapterAvailable !== true) {
      return {
        ok: false,
        mode: modeResolution.mode,
        code: 'ephemeral-adapter-required',
        reason: 'Ephemeral isolation was requested, but no ephemeral adapter is available.',
        audit: auditBase,
      };
    }

    if (modeResolution.mode === 'sidecar' && input.sidecarAvailable !== true) {
      return {
        ok: false,
        mode: modeResolution.mode,
        code: 'sidecar-required',
        reason: 'Sidecar isolation was requested, but no isolated sidecar is available.',
        audit: auditBase,
      };
    }

    if (this.containsRawSecret(input.argv || [])) {
      return {
        ok: false,
        mode: modeResolution.mode,
        code: 'raw-secret-blocked',
        reason: 'Raw credential blocked in command argument. Use a SecretRef placeholder and safe injection outside the command line.',
        audit: {
          ...auditBase,
          rawSecretBlocked: true,
        },
      };
    }

    if (input.approval?.required && !auditBase.approvalTicketProvided) {
      return {
        ok: false,
        mode: modeResolution.mode,
        code: 'approval-ticket-required',
        reason: 'This action requires an approval ticket before execution.',
        audit: auditBase,
      };
    }

    return {
      ok: true,
      mode: modeResolution.mode,
      code: 'allowed',
      reason: modeResolution.mode === 'ephemeral'
        ? 'Execution allowed by the guard with an ephemeral adapter.'
        : modeResolution.mode === 'sidecar'
          ? 'Execution allowed by the guard with an isolated sidecar.'
        : 'Execution allowed by the guard.',
      audit: auditBase,
    };
  }

  private resolveMode(input: RuntimeIsolationGuardInput): {
    ok: boolean;
    mode: RuntimeIsolationMode;
    rawMode: string;
  } {
    const requested = String(input.requestedMode || '').trim().toLowerCase();
    const configured = requested || this.modeFromEnv(input.surface);
    const rawMode = configured || 'guarded';

    if (!VALID_MODES.has(rawMode as RuntimeIsolationMode)) {
      return {
        ok: false,
        mode: 'guarded',
        rawMode,
      };
    }

    return {
      ok: true,
      mode: rawMode as RuntimeIsolationMode,
      rawMode,
    };
  }

  private modeFromEnv(surface: RuntimeIsolationSurface): string {
    if (surface === 'remote_shell') {
      return String(process.env.ZAVORTH_REMOTE_SHELL_ISOLATION || '').trim().toLowerCase();
    }
    if (surface === 'browser') {
      return String(process.env.ZAVORTH_BROWSER_ISOLATION || '').trim().toLowerCase();
    }
    return String(process.env.ZAVORTH_RUNTIME_ISOLATION || '').trim().toLowerCase();
  }

  private collectSecretRefPlaceholders(argv: string[]): string[] {
    return Array.from(new Set(argv.flatMap((arg) => Array.from(String(arg).matchAll(SECRET_REF_PATTERN), (match) => match[0]))));
  }

  private containsRawSecret(argv: string[]): boolean {
    for (let index = 0; index < argv.length; index += 1) {
      const arg = String(argv[index] || '');
      if (!arg || this.onlySecretRefPlaceholder(arg)) {
        continue;
      }

      const nextArg = String(argv[index + 1] || '');
      if (SECRET_FLAG_PATTERN.test(arg) && nextArg && !this.onlySecretRefPlaceholder(nextArg)) {
        return true;
      }

      const bearerMatch = arg.match(BEARER_SECRET_PATTERN);
      if (bearerMatch && !this.onlySecretRefPlaceholder(bearerMatch[2] || '')) {
        return true;
      }

      const assignmentMatch = arg.match(SECRET_ASSIGNMENT_PATTERN);
      if (assignmentMatch && !this.onlySecretRefPlaceholder(assignmentMatch[2] || '')) {
        return true;
      }

      const keyValueMatch = arg.match(SECRET_KEY_VALUE_PATTERN);
      if (keyValueMatch && !this.onlySecretRefPlaceholder(keyValueMatch[3] || '')) {
        return true;
      }
    }

    return false;
  }

  private onlySecretRefPlaceholder(value: string): boolean {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return false;
    }

    const withoutPlaceholders = normalized.replace(SECRET_REF_PATTERN, '').trim();
    return withoutPlaceholders.length === 0;
  }

  private redactArgvForAudit(argv: string[]): string[] {
    return argv.map((arg, index) => {
      const previousArg = String(argv[index - 1] || '');
      if (SECRET_FLAG_PATTERN.test(previousArg) && !this.onlySecretRefPlaceholder(String(arg || ''))) {
        return '[redacted-secret]';
      }
      return this.redactForAudit(arg);
    });
  }

  private redactForAudit(value: string): string {
    const normalized = String(value || '');
    if (this.onlySecretRefPlaceholder(normalized)) {
      return normalized;
    }

    const bearerRedacted = normalized.replace(BEARER_SECRET_PATTERN, '$1[redacted-secret]');
    if (bearerRedacted !== normalized) {
      return bearerRedacted;
    }

    return normalized
      .replace(SECRET_ASSIGNMENT_PATTERN, '$1=[redacted-secret]')
      .replace(SECRET_KEY_VALUE_PATTERN, '$1$2[redacted-secret]')
      .replace(SECRET_REF_PATTERN, (placeholder) => placeholder);
  }
}
