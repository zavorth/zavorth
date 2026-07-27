/**
 * Shared consensus surface for CLI + slash/chat/channels.
 *
 * Same user-owned rules everywhere: no product-default models.
 * CLI:   zavorth consensus ?  * Chat:  /consensus ?  (Telegram, WhatsApp, Discord, web, desktop, Control)
 */

import { AgentConsensusTool } from '../tools/AgentConsensusTool.js';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';

export type ConsensusSurfaceInvokeInput = {
  /** Raw argv tokens after `consensus` or raw slash args after `/consensus`. */
  tokens?: string[];
  /** Already-structured args (from Discord options, dashboard, etc.). */
  structured?: Record<string, unknown>;
  sessionId?: string | null;
  projectRoot?: string;
  llmRuntime?: LlmRuntimeService;
};

export type ConsensusSurfaceResult = {
  ok: boolean;
  text: string;
  json: Record<string, unknown>;
};

/**
 * Parse free-form CLI/slash tokens into AgentConsensusTool args.
 *
 * Examples:
 *   preview
 *   status
 *   run "Should we ship..." --strategy user_stack --mode fallback
 *   run --query "..." --reviewer ollama:llama3.2 --reviewer deepseek:deepseek-chat
 *   save-profile --reviewer a:b --reviewer c:d --enabled
 */
export function parseConsensusSurfaceTokens(
  tokens: string[],
  extras: { sessionId?: string | null } = {},
): Record<string, unknown> {
  const args = tokens.map((t) => String(t || '').trim()).filter(Boolean);
  const out: Record<string, unknown> = {};

  if (extras.sessionId) {
    out.sessionId = extras.sessionId;
  }

  if (args.length === 0) {
    // Opening consensus with no args → home screen (status/preview), not a forced run
    out.action = 'home';
    return out;
  }

  const head = args[0].toLowerCase();
  const rest = args.slice(1);

  if (head === 'help' || head === '-h' || head === '--help') {
    out.action = 'help';
    return out;
  }

  if (
    head === 'preview'
    || head === 'status'
    || head === 'home'
    || head === 'run'
    || head === 'save_profile'
    || head === 'save-profile'
    || head === 'profile-save'
  ) {
    out.action = head === 'save-profile' || head === 'profile-save' ? 'save_profile' : head;
    applyFlagsAndPositionals(rest, out);
    // `run` without query is invalid later; keep flags if any
    return out;
  }

  // Natural usage: "/consensus Should we ship A..." → run with that query.
  // No need to type "run" or flags unless the user wants fine control.
  if (!head.startsWith('-')) {
    out.action = 'run';
    // If the only tokens are a question, whole line is the query.
    // Flags may still follow: /consensus Ship A... --strategy user_stack
    const flagIdx = args.findIndex((t) => t.startsWith('-'));
    if (flagIdx === -1) {
      out.query = args.join(' ');
    } else {
      out.query = args.slice(0, flagIdx).join(' ');
      applyFlagsAndPositionals(args.slice(flagIdx), out);
    }
    return out;
  }

  // Only flags (e.g. --strategy user_stack) → home/preview of that strategy
  out.action = 'home';
  applyFlagsAndPositionals(args, out);
  return out;
}

function applyFlagsAndPositionals(tokens: string[], out: Record<string, unknown>): void {
  const positionals: string[] = [];
  const reviewers: Array<{ provider: string; model: string }> = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t === '--json') {
      out.json = true;
      continue;
    }
    if (t === '--enabled') {
      out.enabled = true;
      continue;
    }
    if (t === '--disabled') {
      out.enabled = false;
      continue;
    }
    if (t === '--fallback' || t === '--mode-fallback') {
      out.mode = 'fallback';
      continue;
    }
    if (t === '--plain' || t === '--mode-plain') {
      out.mode = 'plain';
      continue;
    }

    const kv = matchOption(t, tokens, i);
    if (kv) {
      i = kv.nextIndex;
      switch (kv.key) {
        case 'query':
        case 'q':
          out.query = kv.value;
          break;
        case 'strategy':
        case 's':
          out.strategy = kv.value;
          break;
        case 'mode':
        case 'm':
          out.mode = kv.value;
          break;
        case 'session':
        case 'session-id':
        case 'sessionId':
          out.sessionId = kv.value;
          break;
        case 'system':
        case 'system-prompt':
          out.systemPrompt = kv.value;
          break;
        case 'reviewer':
        case 'r': {
          const parsed = parseProviderModel(kv.value);
          if (parsed) reviewers.push(parsed);
          break;
        }
        case 'synthesizer':
        case 'synth': {
          const parsed = parseProviderModel(kv.value);
          if (parsed) out.synthesizer = parsed;
          break;
        }
        case 'default-mode':
          out.defaultMode = kv.value;
          break;
        case 'min-reviewers':
          out.minReviewers = Number(kv.value) || 2;
          break;
        case 'timeout':
        case 'timeout-ms':
          out.timeoutMs = Number(kv.value) || undefined;
          break;
        case 'concurrency':
        case 'max-concurrent':
          out.maxConcurrent = Number(kv.value) || undefined;
          break;
        default:
          break;
      }
      continue;
    }

    if (!t.startsWith('-')) {
      positionals.push(t);
    }
  }

  if (reviewers.length > 0) {
    out.reviewers = reviewers;
  }

  // Remaining positionals become the query if not set
  if (!out.query && positionals.length > 0) {
    out.query = positionals.join(' ');
  }
}

function matchOption(
  token: string,
  tokens: string[],
  index: number,
): { key: string; value: string; nextIndex: number } | null {
  if (token.startsWith('--') && token.includes('=')) {
    const eq = token.indexOf('=');
    return {
      key: token.slice(2, eq),
      value: token.slice(eq + 1),
      nextIndex: index,
    };
  }
  if (token.startsWith('--') && tokens[index + 1] && !tokens[index + 1].startsWith('-')) {
    return {
      key: token.slice(2),
      value: tokens[index + 1],
      nextIndex: index + 1,
    };
  }
  if (token.startsWith('-') && token.length === 2 && tokens[index + 1] && !tokens[index + 1].startsWith('-')) {
    const short: Record<string, string> = {
      q: 'query',
      s: 'strategy',
      m: 'mode',
      r: 'reviewer',
    };
    const key = short[token.slice(1)] || token.slice(1);
    return {
      key,
      value: tokens[index + 1],
      nextIndex: index + 1,
    };
  }
  return null;
}

function parseProviderModel(raw: string): { provider: string; model: string } | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  // provider:model  or  provider/model
  const sep = text.includes(':') ? ':' : text.includes('/') ? '/' : null;
  if (!sep) return null;
  const [provider, ...rest] = text.split(sep);
  const model = rest.join(sep).trim();
  if (!provider?.trim() || !model) return null;
  return { provider: provider.trim(), model };
}

export function formatConsensusHelp(): string {
  return [
    'Consensus — multi-model deliberation with YOUR models only',
    '',
    'Everyday use (chat / dashboard / Telegram / WhatsApp / Discord):',
    '  /consensus',
    '      → home: shows if your panel is ready (no LLM cost)',
    '  /consensus Should we ship plan A or B...',
    '      → runs consensus on that question (no need to type "run")',
    '',
    'Optional power flags (only if you want control):',
    '  /consensus Ship A or B... --strategy profile',
    '  /consensus Ship A or B... --reviewer ollama:llama3.2 --reviewer deepseek:deepseek-chat',
    '',
    'Inspect without spending tokens:',
    '  /consensus status',
    '  /consensus preview',
    '',
    'Save your preferred reviewers once:',
    '  /consensus save-profile --reviewer prov:model --reviewer prov2:model2',
    '',
    'CLI (same behavior, good for scripts):',
    '  zavorth consensus',
    '  zavorth consensus "Should we ship A or B..."',
    '  zavorth consensus status',
    '  zavorth consensus save-profile --reviewer xai:grok-2 --reviewer mistral:mistral-small',
    '',
    'You do NOT need: /consensus run X --Y  for normal use.',
    '"run" and flags are optional power-user syntax.',
  ].join('\n');
}

/**
 * Invoke consensus on any surface. Returns human text + structured json.
 */
export async function invokeConsensusSurface(
  input: ConsensusSurfaceInvokeInput,
): Promise<ConsensusSurfaceResult> {
  const fromTokens = input.tokens
    ? parseConsensusSurfaceTokens(input.tokens, { sessionId: input.sessionId })
    : {};
  const structured = { ...fromTokens, ...(input.structured || {}) };

  if (input.sessionId && !structured.sessionId) {
    structured.sessionId = input.sessionId;
  }

  if (String(structured.action || '') === 'help') {
    return {
      ok: true,
      text: formatConsensusHelp(),
      json: { ok: true, action: 'help' },
    };
  }

  // home → rich status/preview without LLM cost
  if (String(structured.action || '') === 'home') {
    structured.action = 'status';
    structured._home = true;
  }

  const tool = new AgentConsensusTool({
    llmRuntime: input.llmRuntime || new LlmRuntimeService(),
    projectRoot: input.projectRoot || process.cwd(),
  });

  const raw = await tool.execute(structured);
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, text: raw, json: { ok: false, error: 'invalid_tool_payload', raw } };
  }

  const text = formatConsensusReply(json, structured);
  return {
    ok: json.ok === true,
    text,
    json,
  };
}

export function formatConsensusReply(
  json: Record<string, unknown>,
  request: Record<string, unknown> = {},
): string {
  if (request.json === true) {
    return JSON.stringify(json, null, 2);
  }

  const action = String(json.action || request.action || 'preview');
  const lines: string[] = [];

  if (json.ok === false) {
    lines.push('Consensus — not ready');
    lines.push('');
    lines.push(String(json.error || json.reason || 'Unknown error'));
    const guidance = Array.isArray(json.guidance) ? json.guidance as string[] : [];
    if (guidance.length) {
      lines.push('', 'What to do:');
      for (const g of guidance.slice(0, 8)) lines.push(`  • ${g}`);
    }
    const stack = Array.isArray(json.availableFromUserStack)
      ? json.availableFromUserStack as Array<{ provider?: string; model?: string; source?: string }>
      : [];
    if (stack.length) {
      lines.push('', 'Your stack candidates:');
      for (const c of stack.slice(0, 8)) {
        lines.push(`  - ${c.provider}/${c.model} (${c.source || '...'})`);
      }
    }
    lines.push('', 'Help: /consensus help   |   zavorth consensus help');
    return lines.join('\n');
  }

  if (action === 'status' || action === 'preview' || action === 'home') {
    const isHome = request._home === true || action === 'home';
    lines.push(isHome ? 'Consensus' : (action === 'status' ? 'Consensus status' : 'Consensus preview'));
    lines.push('');
    if (isHome) {
      lines.push('Just type your question after /consensus — no "run" required.');
      lines.push('Example: /consensus Should we ship plan A or B...');
      lines.push('');
    }
    if (json.reason) lines.push(String(json.reason));
    if (json.strategy) lines.push(`Strategy: ${json.strategy}`);
    if (json.modeDefault) lines.push(`Default mode: ${json.modeDefault}`);

    // status payload uses availableFromUserStack; preview may use reviewers
    const reviewers = Array.isArray(json.reviewers)
      ? json.reviewers as Array<{ provider?: string; model?: string; source?: string }>
      : Array.isArray(json.availableFromUserStack)
        ? json.availableFromUserStack as Array<{ provider?: string; model?: string; source?: string }>
        : [];
    const wouldRun = json.wouldRun === true || (Array.isArray(json.reviewers) && (json.reviewers as unknown[]).length >= 2);

    if (reviewers.length) {
      lines.push('', wouldRun || isHome ? 'Your panel:' : 'Candidates:');
      for (const r of reviewers.slice(0, 8)) {
        lines.push(`  ? ${r.provider}/${r.model}${r.source ? ` [${r.source}]` : ''}`);
      }
    }
    const synth = json.synthesizer as { provider?: string; model?: string } | null | undefined;
    if (synth?.provider) {
      lines.push(`Synthesizer: ${synth.provider}/${synth.model}`);
    }

    if (isHome || action === 'preview') {
      lines.push('');
      if (wouldRun || (Array.isArray(json.reviewers) && (json.reviewers as unknown[]).length >= 2)) {
        lines.push('Ready. Ask anything:');
        lines.push('  /consensus <your question>');
      } else {
        lines.push('Not ready yet — configure secondary/fallback models, or save a profile once.');
        lines.push('  /consensus help');
      }
    }

    const guidance = Array.isArray(json.guidance) ? json.guidance as string[] : [];
    if (guidance.length && reviewers.length < 2) {
      lines.push('', 'Guidance:');
      for (const g of guidance.slice(0, 5)) lines.push(`  • ${g}`);
    }
    return lines.join('\n');
  }

  if (action === 'save_profile') {
    lines.push('Consensus profile saved');
    lines.push('');
    const profile = json.profile as { reviewers?: unknown[]; enabled?: boolean } | undefined;
    lines.push(`Enabled: ${profile?.enabled !== false}`);
    lines.push(`Reviewers: ${Array.isArray(profile?.reviewers) ? profile!.reviewers!.length : 0}`);
    lines.push('', 'Run with: /consensus run <q> --strategy profile');
    return lines.join('\n');
  }

  if (action === 'run') {
    lines.push('Consensus result');
    lines.push('');
    if (json.strategy) lines.push(`Strategy: ${json.strategy} | mode: ${json.mode || 'plain'}`);
    if (json.reviewersUsed !== undefined) {
      lines.push(`Reviewers used: ${json.reviewersUsed} (failed: ${json.reviewersFailed ?? 0})`);
    }
    if (json.totalLatencyMs !== undefined) {
      lines.push(`Latency: ${json.totalLatencyMs}ms`);
    }
    lines.push('', String(json.synthesis || '(empty synthesis)'));
    return lines.join('\n');
  }

  return JSON.stringify(json, null, 2);
}
