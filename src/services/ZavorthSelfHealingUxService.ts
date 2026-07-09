import {
  ZAVORTH_SELF_HEALING_UX_CONTRACT_VERSION,
  type ZavorthSelfHealingAction,
  type ZavorthSelfHealingBuildInput,
  type ZavorthSelfHealingIssueKind,
  type ZavorthSelfHealingProjection,
  type ZavorthSelfHealingSetupContext,
} from '../contracts/ZavorthSelfHealingUxContract.js';
import type {
  ZavorthProviderReadinessEntry,
  ZavorthProviderReadinessMatrixSnapshot,
} from '../contracts/provider/ZavorthProviderReadinessMatrixContract.js';
import type { ExperienceSnapshot } from './experience/ExperienceContracts.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';
import { logger } from '../logger.js';

type ProjectionBody = Omit<
  ZavorthSelfHealingProjection,
  'contractVersion' | 'ok' | 'shouldRender' | 'issue' | 'attempted' | 'invariants' | 'debug'
>;

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-proj-[A-Za-z0-9_-]{12,}\b/g,
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
];

export class ZavorthSelfHealingUxService {
  public buildProjection(input: ZavorthSelfHealingBuildInput = {}): ZavorthSelfHealingProjection {
    const signalText = sanitize(
      [
        input.commandText,
        input.result?.error,
        input.result?.replies?.map((reply) => reply.text).join('\n'),
        input.snapshot?.health?.summary,
        input.snapshot?.health?.warnings?.join('\n'),
        input.error instanceof Error ? input.error.message : input.error ? String(input.error) : '',
      ].filter(Boolean).join('\n'),
    );
    const snapshot = input.snapshot || input.result?.snapshot || null;
    const attempted = sanitize(input.attempted || input.result?.plan?.title || input.commandText || 'Handle the request');
    const issue = this.classify({
      signalText,
      snapshot,
      resultOk: input.result?.ok ?? (input.error ? false : true),
      resultRequiresApproval: input.result?.plan?.requiresApproval === true,
    });
    const providerFallbacks = isProviderIssue(issue)
      ? this.providerFallbacks(input.providerMatrix || this.safeProviderMatrix())
      : [];
    const shouldRender = issue !== 'none'
      || input.error !== undefined
      || input.result?.ok === false
      || input.result?.plan?.requiresApproval === true;

    const projection = this.projectIssue({
      issue,
      attempted,
      signalText,
      snapshot,
      providerFallbacks,
    });

    return {
      contractVersion: ZAVORTH_SELF_HEALING_UX_CONTRACT_VERSION,
      ok: issue === 'none' && !input.error && input.result?.ok !== false,
      shouldRender,
      issue,
      attempted,
      ...projection,
      invariants: {
        secretsRedacted: true,
        noPolicyBypass: true,
        noUnsafeAutoApply: true,
      },
      ...(input.debug
        ? {
          debug: {
            sanitizedError: input.error instanceof Error ? sanitize(input.error.message) : input.error ? sanitize(String(input.error)) : input.result?.error || null,
            signalText,
          },
        }
        : {}),
    };
  }

  private classify(input: {
    signalText: string;
    snapshot: ExperienceSnapshot | null;
    resultOk: boolean;
    resultRequiresApproval: boolean;
  }): ZavorthSelfHealingIssueKind {
    const text = input.signalText.toLowerCase();
    const provider = sanitize(String(input.snapshot?.agent?.providerLabel || '')).toLowerCase();
    const model = sanitize(String(input.snapshot?.agent?.modelLabel || '')).toLowerCase();
    const health = sanitize(String(input.snapshot?.health?.status || '')).toLowerCase();

    if (input.resultRequiresApproval || /\b(waiting_approval|approval required|requires approval|pending approval)\b/i.test(text)) {
      return 'approval_required';
    }
    if (/\b(telegram|discord|slack|signal|whatsapp|matrix|email|channel|surface)\b/i.test(text)
      && /\b(connect|configure|setup|pair|pairing|allowlist|token|webhook|not configured|missing|unauthorized|forbidden)\b/i.test(text)) {
      return /\b(pair|pairing|allowlist)\b/i.test(text) ? 'channel_unpaired' : 'channel_missing';
    }
    if (!provider || provider === 'not configured' || provider === 'missing' || !model || model === 'not configured' || model === 'missing') {
      return 'provider_missing';
    }
    if (/\b(insufficient[_ -]?quota|quota|credit|credits|billing|402|payment required|rate limit|429)\b/i.test(text)) {
      return 'provider_quota';
    }
    if (/\b(unauthorized|invalid api key|invalid key|missing api key|api key missing|401|403|forbidden|auth)\b/i.test(text)) {
      return 'provider_auth';
    }
    if (/\b(timeout|timed out|etimedout|deadline exceeded|504|gateway timeout)\b/i.test(text)) {
      return 'provider_timeout';
    }
    if (/\b(provider unavailable|model unavailable|503|502|upstream|no route|route unavailable)\b/i.test(text)) {
      return 'provider_unavailable';
    }
    if (/\b(sandbox|docker|wsl|firecracker|container)\b/i.test(text)
      && /\b(unavailable|missing|failed|not found|not ready|disabled)\b/i.test(text)) {
      return 'sandbox_unavailable';
    }
    if (health === 'blocked' || /\b(econnrefused|eaddrinuse|gateway down|runtime unavailable|connection refused|port .* occupied)\b/i.test(text)) {
      return 'runtime_unavailable';
    }
    if (!input.resultOk) {
      return 'unknown_failure';
    }
    return 'none';
  }

  private projectIssue(input: {
    issue: ZavorthSelfHealingIssueKind;
    attempted: string;
    signalText: string;
    snapshot: ExperienceSnapshot | null;
    providerFallbacks: string[];
  }): ProjectionBody {
    switch (input.issue) {
      case 'provider_missing':
        return this.providerMissing(input);
      case 'provider_auth':
        return this.providerAuth(input);
      case 'provider_quota':
        return this.providerQuota(input);
      case 'provider_timeout':
      case 'provider_unavailable':
        return this.providerUnavailable(input);
      case 'channel_missing':
      case 'channel_unpaired':
        return this.channelIssue(input);
      case 'sandbox_unavailable':
        return this.sandboxIssue();
      case 'approval_required':
        return this.approvalRequired();
      case 'runtime_unavailable':
        return this.runtimeIssue();
      case 'unknown_failure':
        return this.unknownIssue(input);
      default:
        return {
          problem: 'No repair is needed right now.',
          impact: 'The request can continue normally.',
          nextSafeAction: 'Continue with another natural request.',
          canZavorthRepair: false,
          needsUserInput: false,
          actions: [action('continue', 'continue', 'Continue', 'Send the next request when ready.', false, false, true)],
          fallback: null,
          setup: null,
          receipt: {
            willBeCreated: false,
            reason: 'No repair or governed change was needed.',
          },
        };
    }
  }

  private providerMissing(input: { providerFallbacks: string[] }): ProjectionBody {
    return {
      problem: 'No usable LLM provider/model is configured for the main agent loop.',
      impact: 'Zavorth can still explain setup and approvals, but it cannot use full LLM intelligence until a provider is selected.',
      nextSafeAction: 'I can guide provider setup here. Tell me which provider to use, paste a key only when asked, or choose a local provider.',
      canZavorthRepair: true,
      needsUserInput: true,
      actions: [
        action('configure-provider', 'configure_provider', 'Configure provider', 'Start exactly at provider/model setup and keep secrets redacted.', false, true, true, 'zavorth setup'),
        action('use-local', 'configure_provider', 'Use local provider', 'Prefer Ollama/LM Studio/local context when available.', false, false, true, null, 'Use a local provider'),
      ],
      fallback: {
        attempted: false,
        reason: input.providerFallbacks.length
          ? 'A fallback can be selected after you approve the route or provide a credential.'
          : 'No ready fallback route has live proof yet.',
        selectedProvider: null,
        candidates: input.providerFallbacks,
      },
      setup: setup('provider', ['provider choice', 'model choice', 'API key or local endpoint when required'], [
        'Secrets are captured only in secret fields and redacted from output.',
        'Provider live tests are explicit and leave proof receipts.',
      ]),
      receipt: receipt('A setup receipt is created when a provider is configured or tested.'),
    };
  }

  private providerAuth(input: { providerFallbacks: string[] }): ProjectionBody {
    return {
      problem: 'The selected provider rejected authentication or is missing a valid credential.',
      impact: 'Retrying the same provider would keep failing until the credential is replaced or a fallback route is selected.',
      nextSafeAction: input.providerFallbacks.length
        ? `I can retry through an allowed fallback route (${input.providerFallbacks[0]}) or guide you through replacing the key.`
        : 'I need a valid credential or a local provider choice before retrying.',
      canZavorthRepair: input.providerFallbacks.length > 0,
      needsUserInput: input.providerFallbacks.length === 0,
      actions: [
        action('retry-fallback', 'retry_fallback', 'Retry with fallback', 'Use the next allowed ready provider route through the gateway.', false, false, true),
        action('replace-key', 'configure_provider', 'Replace credential', 'Open provider setup at the credential step without printing secrets.', false, true, true, 'zavorth setup'),
      ],
      fallback: fallback(input.providerFallbacks, 'Authentication failed on the selected provider.'),
      setup: setup('provider', ['valid provider credential or explicit local provider choice'], [
        'Old secrets are never printed.',
        'A live proof receipt should confirm the new credential before normal use.',
      ]),
      receipt: receipt('Credential replacement, fallback selection and live proof each produce receipts.'),
    };
  }

  private providerQuota(input: { providerFallbacks: string[] }): ProjectionBody {
    return {
      problem: 'The selected provider appears to be out of quota, credit, or rate-limit budget.',
      impact: 'The request should not keep hammering the same route; that would waste time and may increase lockout risk.',
      nextSafeAction: input.providerFallbacks.length
        ? `I can switch to the next allowed route (${input.providerFallbacks[0]}) and record why.`
        : 'I need another provider, local model, or refreshed quota before retrying.',
      canZavorthRepair: input.providerFallbacks.length > 0,
      needsUserInput: input.providerFallbacks.length === 0,
      actions: [
        action('retry-fallback', 'retry_fallback', 'Use fallback route', 'Retry through the gateway with the next allowed provider.', false, false, true),
        action('choose-provider', 'configure_provider', 'Choose another provider', 'Select another provider/model with explicit credential handling.', false, true, true, 'zavorth setup'),
      ],
      fallback: fallback(input.providerFallbacks, 'Quota or rate-limit failure on the selected provider.'),
      setup: setup('provider', ['fallback provider or refreshed provider quota'], [
        'Zavorth should prefer proven fallback routes before interrupting you.',
      ]),
      receipt: receipt('Fallback or quota repair decisions are recorded as provider receipts.'),
    };
  }

  private providerUnavailable(input: { providerFallbacks: string[]; issue: ZavorthSelfHealingIssueKind }): ProjectionBody {
    return {
      problem: input.issue === 'provider_timeout'
        ? 'The selected provider timed out.'
        : 'The selected provider or model route is unavailable.',
      impact: 'The user request is still valid; only the route failed.',
      nextSafeAction: input.providerFallbacks.length
        ? `I can retry through ${input.providerFallbacks[0]} and keep the failed route in the receipt.`
        : 'I need a ready fallback route or a local provider before retrying.',
      canZavorthRepair: input.providerFallbacks.length > 0,
      needsUserInput: input.providerFallbacks.length === 0,
      actions: [
        action('retry-fallback', 'retry_fallback', 'Retry safely', 'Use the next ready gateway route with the same request.', false, false, true),
        action('provider-proof', 'configure_provider', 'Check routes', 'Run provider live proof only when explicitly allowed.', false, false, true, 'zavorth providers'),
      ],
      fallback: fallback(input.providerFallbacks, 'Provider route failed at runtime.'),
      setup: setup('provider', ['ready fallback route or local endpoint'], [
        'No hidden network probe is performed by the UX layer.',
      ]),
      receipt: receipt('Provider failures and fallback route choices are recorded.'),
    };
  }

  private channelIssue(input: { issue: ZavorthSelfHealingIssueKind; signalText: string }): ProjectionBody {
    const target = detectChannel(input.signalText);
    return {
      problem: input.issue === 'channel_unpaired'
        ? `${target} needs pairing or allowlist approval before it can reach tools.`
        : `${target} is not configured enough for live use.`,
      impact: 'Zavorth will not expose tools to an unpaired or misconfigured remote surface.',
      nextSafeAction: `I can start the ${target} setup at the exact missing step, then run a live proof if you approve it.`,
      canZavorthRepair: true,
      needsUserInput: true,
      actions: [
        action('configure-channel', 'configure_channel', `Configure ${target}`, 'Collect token/webhook/pairing details in redacted fields.', false, true, true, `zavorth channels ${target.toLowerCase()}`),
        action('pair-channel', 'configure_channel', `Pair ${target}`, 'Create or verify pairing/allowlist before tools are reachable.', true, true, true),
      ],
      fallback: null,
      setup: setup('channel', [`${target} token, webhook, pairing code or allowlisted user id`], [
        'Remote channels stay least-privilege by default.',
        'Inbound senders must be paired or allowlisted before tool access.',
      ]),
      receipt: receipt('Channel setup, pairing and delivery proofs are recorded.'),
    };
  }

  private sandboxIssue(): ProjectionBody {
    return {
      problem: 'The requested mutation path needs a sandbox, but the preferred sandbox backend is not ready.',
      impact: 'Zavorth should not apply host mutations directly when sandbox validation is required.',
      nextSafeAction: 'I can repair sandbox configuration or fall back to the governed local-copy sandbox after approval.',
      canZavorthRepair: true,
      needsUserInput: false,
      actions: [
        action('repair-sandbox', 'repair_sandbox', 'Repair sandbox', 'Check Docker/WSL/local-copy backend and prepare the safest available option.', true, false, true),
        action('local-copy-sandbox', 'repair_sandbox', 'Use governed local copy', 'Run mutation rehearsal in the local-copy sandbox instead of touching the host.', true, false, true),
      ],
      fallback: null,
      setup: setup('sandbox', ['approval for sandbox repair or fallback backend'], [
        'No partial hunk or mutation is applied directly to the host.',
      ]),
      receipt: receipt('Sandbox fallback and validation logs are summarized in receipts.'),
    };
  }

  private approvalRequired(): ProjectionBody {
    return {
      problem: 'The next step is sensitive enough to require approval.',
      impact: 'Zavorth paused before changing files, running risky commands, sending external data or persisting behavior.',
      nextSafeAction: 'Review the scope, risk and receipt preview. Approve only if it matches what you intended.',
      canZavorthRepair: false,
      needsUserInput: true,
      actions: [
        action('review-approval', 'approve', 'Review approval', 'Show risk, affected files/commands, sandbox and receipt preview.', false, true, true, 'zavorth approve'),
        action('limit-scope', 'approve', 'Limit scope', 'Narrow the request before approving.', false, true, true),
      ],
      fallback: null,
      setup: setup('approval', ['approve, reject, or narrow the scope'], [
        'Approval cannot be bypassed by learned preferences.',
      ]),
      receipt: receipt('The final decision is recorded as a safety receipt.'),
    };
  }

  private runtimeIssue(): ProjectionBody {
    return {
      problem: 'The local runtime or gateway connection is unavailable or blocked.',
      impact: 'The terminal can still guide setup, but live agent state, zavorthControl updates or channel delivery may be stale.',
      nextSafeAction: 'I can restart the local runtime, pick a free port, or reconnect to the existing gateway.',
      canZavorthRepair: true,
      needsUserInput: false,
      actions: [
        action('repair-runtime', 'repair_runtime', 'Repair runtime', 'Restart or reconnect the local runtime with a fresh health receipt.', true, false, true, 'zavorth start'),
        action('open-evidence', 'open_evidence', 'Show evidence', 'Open the runtime evidence after repair.', false, false, true),
      ],
      fallback: null,
      setup: setup('runtime', ['approval if a persistent process must be started or restarted'], [
        'Zavorth should not silently install or persist background services.',
      ]),
      receipt: receipt('Runtime repair produces a health receipt.'),
    };
  }

  private unknownIssue(input: { signalText: string }): ProjectionBody {
    const summary = input.signalText ? firstSentence(input.signalText) : 'The request did not complete cleanly.';
    return {
      problem: summary,
      impact: 'Zavorth did not have enough structured information to safely auto-repair this failure.',
      nextSafeAction: 'I can inspect the failure, keep secrets redacted, and propose a narrow repair before applying anything.',
      canZavorthRepair: true,
      needsUserInput: false,
      actions: [
        action('inspect-failure', 'escalate', 'Inspect failure', 'Collect safe diagnostics and produce a repair proposal.', false, false, true),
        action('retry-narrow', 'continue', 'Retry narrowly', 'Retry with a smaller scope or clearer target.', false, true, true),
      ],
      fallback: null,
      setup: setup('general', ['approval before any repair that changes state'], [
        'Stack traces and raw logs stay behind debug mode.',
      ]),
      receipt: receipt('If a repair is attempted, Zavorth records the scope and result.'),
    };
  }

  private providerFallbacks(matrix: ZavorthProviderReadinessMatrixSnapshot | null): string[] {
    const entries = Array.isArray(matrix?.entries) ? matrix.entries : [];
    return entries
      .filter((entry: ZavorthProviderReadinessEntry) => entry?.defaultRouteAllowed === true || entry?.liveReady === true || entry?.status === 'ready')
      .filter((entry: ZavorthProviderReadinessEntry) => !entry?.defaultBlockReason)
      .map((entry: ZavorthProviderReadinessEntry) => sanitize(entry?.id || entry?.label || ''))
      .filter(Boolean)
      .slice(0, 4);
  }

  private safeProviderMatrix(): ZavorthProviderReadinessMatrixSnapshot | null {
    try {
      return new ZavorthProviderReadinessMatrixService().buildSnapshot({
        includeAdvanced: false,
        probe: false,
        live: false,
      });
    } catch (error: unknown) {logger.warn('[Zavorth Self Healing Ux] creation failed', error); return null; }
  }
}

function action(
  id: string,
  kind: ZavorthSelfHealingAction['kind'],
  label: string,
  detail: string,
  approvalRequired: boolean,
  needsUserInput: boolean,
  safeToAutomate: boolean,
  command?: string | null,
  prompt?: string | null,
): ZavorthSelfHealingAction {
  return {
    id,
    kind,
    label,
    detail,
    approvalRequired,
    needsUserInput,
    safeToAutomate,
    ...(command ? { command } : {}),
    ...(prompt ? { prompt } : {}),
  };
}

function setup(
  target: ZavorthSelfHealingSetupContext['target'],
  requiredInput: string[],
  notes: string[],
): ZavorthSelfHealingSetupContext {
  return {
    target,
    requiredInput,
    secretSafe: true,
    notes,
  };
}

function fallback(candidates: string[], reason: string) {
  return {
    attempted: false,
    reason,
    selectedProvider: candidates[0] || null,
    candidates,
  };
}

function receipt(reason: string) {
  return {
    willBeCreated: true,
    reason,
  };
}

function detectChannel(text: string): string {
  const match = text.match(/\b(telegram|discord|slack|signal|whatsapp|matrix|email|teams|line|irc|twitch|nostr)\b/i);
  if (!match) return 'Channel';
  const raw = match[1].toLowerCase();
  return raw === 'teams' ? 'Microsoft Teams' : raw.charAt(0).toUpperCase() + raw.slice(1);
}

function isProviderIssue(issue: ZavorthSelfHealingIssueKind): boolean {
  return issue === 'provider_missing'
    || issue === 'provider_auth'
    || issue === 'provider_quota'
    || issue === 'provider_timeout'
    || issue === 'provider_unavailable';
}

function firstSentence(text: string): string {
  const normalized = sanitize(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return 'The request did not complete cleanly.';
  return normalized.split(/(?<=[.!?])\s+/u)[0]?.slice(0, 220) || normalized.slice(0, 220);
}

export function sanitize(value: unknown): string {
  let text = String(value || '');
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, '[redacted]');
  }
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 4000);
}
