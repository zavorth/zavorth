import {
  ZAVORTH_CLI_BRAND_NAME,
  formatZavorthMascotBlock,
} from './ZavorthCliMascot.js';
import { paintCliTone } from './ZavorthCliVisualTheme.js';

export type ZavorthFailureKind =
  | 'missing-config'
  | 'runtime-not-running'
  | 'provider-not-configured'
  | 'permission-required'
  | 'policy-blocked'
  | 'timeout'
  | 'invalid-workspace'
  | 'non-interactive-terminal'
  | 'unexpected-error';

export type ZavorthFailureSeverity = 'recoverable' | 'blocked' | 'error';

export type ZavorthFailureExplanationInput = {
  kind?: ZavorthFailureKind | null;
  severity?: ZavorthFailureSeverity | null;
  error?: unknown;
  whatHappened?: string | null;
  likelyCause?: string | null;
  nextStep?: string | null;
  tryCommand?: string | null;
  debug?: boolean | null;
};

export type ZavorthFailureExplanation = {
  nativeContract: 'ZavorthFailureExplanation/v1';
  kind: ZavorthFailureKind;
  severity: ZavorthFailureSeverity;
  title: 'Zavorth could not continue';
  whatHappened: string;
  likelyCause: string;
  nextStep: string;
  tryCommand: string;
  recoveryHub: 'zavorth doctor';
  stacktraceHiddenByDefault: true;
  debugDetail: string | null;
};

export type ZavorthFailureExplanationRenderOptions = {
  includeHeader?: boolean;
};

type FailureDefaults = {
  severity: ZavorthFailureSeverity;
  whatHappened: string;
  likelyCause: string;
  nextStep: string;
  tryCommand: string;
};

const FAILURE_DEFAULTS: Record<ZavorthFailureKind, FailureDefaults> = {
  'missing-config': {
    severity: 'recoverable',
    whatHappened: 'A required local configuration file or setting is missing.',
    likelyCause: 'This workspace has not finished setup yet.',
    nextStep: 'Run setup or doctor so Zavorth can show the missing item clearly.',
    tryCommand: 'zavorth setup',
  },
  'runtime-not-running': {
    severity: 'recoverable',
    whatHappened: 'The local runtime is not available right now.',
    likelyCause: 'The host process, ZavorthControl, or local listener has not started yet.',
    nextStep: 'Run a safe launch preview, then use doctor if the runtime still does not answer.',
    tryCommand: 'zavorth go --dry-run',
  },
  'provider-not-configured': {
    severity: 'recoverable',
    whatHappened: 'No usable provider or model is configured for this action.',
    likelyCause: 'Setup deferred provider selection or the model placeholder still needs a choice.',
    nextStep: 'Review setup and keep secrets out of the terminal prompt.',
    tryCommand: 'zavorth setup',
  },
  'permission-required': {
    severity: 'blocked',
    whatHappened: 'Zavorth needs approval before continuing.',
    likelyCause: 'The requested action can affect files, tools, network, or local state.',
    nextStep: 'Inspect the requested action and approve only if it matches your intent.',
    tryCommand: 'zavorth doctor',
  },
  'policy-blocked': {
    severity: 'blocked',
    whatHappened: 'Zavorth blocked the action by policy.',
    likelyCause: 'The current safety posture does not allow this action without a safer path.',
    nextStep: 'Use doctor to see which policy or workspace rule is blocking the run.',
    tryCommand: 'zavorth doctor',
  },
  timeout: {
    severity: 'recoverable',
    whatHappened: 'The operation took too long and stopped safely.',
    likelyCause: 'A local service, port check, or runtime probe did not answer in time.',
    nextStep: 'Retry with doctor so Zavorth can separate slow services from missing services.',
    tryCommand: 'zavorth doctor',
  },
  'invalid-workspace': {
    severity: 'blocked',
    whatHappened: 'The current workspace is not valid for this command.',
    likelyCause: 'Zavorth could not resolve the expected project root or workspace profile.',
    nextStep: 'Preview setup from the workspace you want Zavorth to use.',
    tryCommand: 'zavorth setup --dry-run',
  },
  'non-interactive-terminal': {
    severity: 'recoverable',
    whatHappened: 'This command needs an interactive terminal.',
    likelyCause: 'The process is running without a TTY, or automation disabled prompts.',
    nextStep: 'Open an interactive shell, or use a dry-run/json preview for automation.',
    tryCommand: 'zavorth setup --dry-run',
  },
  'unexpected-error': {
    severity: 'error',
    whatHappened: 'An unexpected error stopped the command.',
    likelyCause: 'Zavorth hit a code path that needs diagnostics instead of guessing.',
    nextStep: 'Run doctor and retry the command with the smallest safe option.',
    tryCommand: 'zavorth doctor',
  },
};

const SECRET_PATTERNS = [
  /sk-(?:proj|svcacct)-[A-Za-z0-9_-]{8,}/gu,
  /sk-[A-Za-z0-9]{20,}/gu,
  /ghp_[A-Za-z0-9_]{16,}/gu,
  /xox[baprs]-[A-Za-z0-9-]{16,}/gu,
  /(?:_authToken|authToken|api[_-]?key|token|secret)\s*[:=]\s*["']?[^"'\s]+/giu,
];

export function allZavorthFailureKinds(): ZavorthFailureKind[] {
  return Object.keys(FAILURE_DEFAULTS) as ZavorthFailureKind[];
}

export function buildZavorthFailureExplanation(
  input: ZavorthFailureExplanationInput = {},
): ZavorthFailureExplanation {
  const kind = input.kind || classifyZavorthFailureKind(input.error);
  const defaults = FAILURE_DEFAULTS[kind];
  const debugEnabled = input.debug === true || process.env.ZAVORTH_DEBUG_FAILURES === '1';

  return {
    nativeContract: 'ZavorthFailureExplanation/v1',
    kind,
    severity: input.severity || defaults.severity,
    title: 'Zavorth could not continue',
    whatHappened: cleanLine(input.whatHappened) || defaults.whatHappened,
    likelyCause: cleanLine(input.likelyCause) || cleanLine(messageFromError(input.error)) || defaults.likelyCause,
    nextStep: cleanLine(input.nextStep) || defaults.nextStep,
    tryCommand: cleanLine(input.tryCommand) || defaults.tryCommand,
    recoveryHub: 'zavorth doctor',
    stacktraceHiddenByDefault: true,
    debugDetail: debugEnabled ? debugDetailFromError(input.error) : null,
  };
}

export function classifyZavorthFailureKind(error: unknown): ZavorthFailureKind {
  const message = `${messageFromError(error)} ${errorCodeFrom(error)}`.toLowerCase();

  if (/\b(non[- ]?interactive|tty|stdin|stdout|prompt)\b/u.test(message)) {
    return 'non-interactive-terminal';
  }
  if (/\b(timeout|timed out|etimedout)\b/u.test(message)) {
    return 'timeout';
  }
  if (/\b(policy|blocked|denied|not allowed|safety)\b/u.test(message)) {
    return 'policy-blocked';
  }
  if (/\b(permission|approval|required approval|eacces|eperm)\b/u.test(message)) {
    return 'permission-required';
  }
  if (/\b(provider|model|api key|apikey|credential|secret)\b/u.test(message)) {
    return 'provider-not-configured';
  }
  if (/\b(runtime|listener|port|econnrefused|connection refused|not running|zavorthControl|host)\b/u.test(message)) {
    return 'runtime-not-running';
  }
  if (/\b(workspace|project root|invalid cwd|outside root|enoent)\b/u.test(message)) {
    return 'invalid-workspace';
  }
  if (/\b(config|missing|env|\.env|not configured)\b/u.test(message)) {
    return 'missing-config';
  }

  return 'unexpected-error';
}

export function renderZavorthFailureExplanation(
  explanation: ZavorthFailureExplanation,
  options: ZavorthFailureExplanationRenderOptions = {},
): string {
  const includeHeader = options.includeHeader !== false;
  const lines = [
    ...(includeHeader ? formatZavorthMascotBlock([
      paintCliTone(ZAVORTH_CLI_BRAND_NAME, 'brand'),
      paintCliTone('Failure explained', explanation.severity === 'blocked' ? 'warning' : 'danger'),
      paintCliTone(`Recovery hub: ${explanation.recoveryHub}`, 'muted'),
    ]) : []),
    ...(includeHeader ? [''] : []),
    paintCliTone(explanation.title, explanation.severity === 'blocked' ? 'warning' : 'danger'),
    `What happened: ${explanation.whatHappened}`,
    `Likely cause: ${explanation.likelyCause}`,
    `Next step: ${explanation.nextStep}`,
    `Try: ${explanation.tryCommand}`,
  ];

  if (explanation.debugDetail) {
    lines.push('', paintCliTone('Debug detail', 'muted'), explanation.debugDetail);
  }

  return lines.join('\n');
}

export function formatZavorthFailureExplanation(input: ZavorthFailureExplanationInput): string {
  return renderZavorthFailureExplanation(buildZavorthFailureExplanation(input));
}

function messageFromError(error: unknown): string {
  if (!error) {
    return '';
  }
  if (error instanceof Error) {
    return redactSensitiveText(error.message || error.name || '');
  }
  return redactSensitiveText(String(error));
}

function errorCodeFrom(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function debugDetailFromError(error: unknown): string | null {
  if (!error) {
    return null;
  }
  if (error instanceof Error) {
    return redactSensitiveText(error.stack || error.message || error.name || '');
  }
  return redactSensitiveText(String(error));
}

function cleanLine(value: string | null | undefined): string {
  return redactSensitiveText(String(value || ''))
    .replace(/\s+/gu, ' ')
    .trim();
}

function redactSensitiveText(value: string): string {
  let output = String(value || '');
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, '[redacted]');
  }
  return output;
}
