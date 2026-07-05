import type { CompiledPolicyRule, PolicyCompilerSnapshot } from '../contracts/PracticalAgencyContract.js';
import { logger } from '../logger.js';

export class ZavorthPolicyCompilerService {
  public compile(input: { source?: string | Record<string, unknown> | null } = {}): PolicyCompilerSnapshot {
    try {
      const raw = typeof input.source === 'string'
        ? parsePolicyText(input.source)
        : (input.source && typeof input.source === 'object' ? input.source : defaultPolicy());
      const rules = normalizeRules(raw);
      return {
        source: 'ZavorthPolicyCompilerService',
        status: rules.length > 0 ? 'passed' : 'warning',
        rules,
        hardBlocksPreserved: true,
        error: null,
      };
    } catch (error) {
    logger.warn('[Zavorth  Compiler] parsing failed', error);
    return {
        source: 'ZavorthPolicyCompilerService',
        status: 'blocked',
        rules: [],
        hardBlocksPreserved: true,
        error: redact(error?.message || 'Policy could not be compiled.'),
      };
  }
  }
}

function defaultPolicy(): Record<string, unknown> {
  return {
    rules: [
      { id: 'allow-safe-read', action: 'read', target: 'workspace', decision: 'allow' },
      { id: 'block-secret-read', action: 'read', target: '.env|id_rsa|credentials.json', decision: 'deny' },
      { id: 'shell-requires-approval', action: 'exec', target: '*', decision: 'require_approval' },
      { id: 'install-requires-sandbox', action: 'install', target: '*', decision: 'require_sandbox' },
      { id: 'allow-reversible-workspace-write', action: 'write', target: 'workspace:reversible', decision: 'allow' },
    ],
  };
}

function parsePolicyText(source: string): Record<string, unknown> {
  const trimmed = source.trim();
  if (!trimmed) return defaultPolicy();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  const rules: Array<Record<string, string>> = [];
  let current: Record<string, string> | null = null;
  for (const line of trimmed.split(/\r?\n/)) {
    const item = /^\s*-\s*id:\s*(.+?)\s*$/.exec(line);
    if (item) {
      current = { id: item[1].trim() };
      rules.push(current);
      continue;
    }
    const pair = /^\s*(action|target|decision):\s*(.+?)\s*$/.exec(line);
    if (pair && current) {
      current[pair[1]] = pair[2].trim();
    }
  }
  return { rules };
}

function normalizeRules(raw: Record<string, unknown>): CompiledPolicyRule[] {
  const rawRules = Array.isArray(raw.rules) ? raw.rules : [];
  return rawRules
    .map((entry, index) => {
      const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      const decision = String(record.decision || '').trim();
      if (!['allow', 'require_approval', 'require_sandbox', 'deny'].includes(decision)) {
        return null;
      }
      return {
        id: safeText(record.id || `policy-${index + 1}`, `policy-${index + 1}`),
        action: safeText(record.action || '*', '*'),
        target: safeText(record.target || '*', '*'),
        decision: decision as CompiledPolicyRule['decision'],
      };
    })
    .filter((entry): entry is CompiledPolicyRule => Boolean(entry));
}

function safeText(value: unknown, fallback: string): string {
  const redacted = redact(String(value || '').trim()).slice(0, 160);
  return redacted || fallback;
}

function redact(value: string): string {
  return String(value || '')
    .replace(/\b(?:token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi, '[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]');
}
