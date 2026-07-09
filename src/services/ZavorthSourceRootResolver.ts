import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';

type ResolveSourceRootInput = {
  sourceRoot?: string | null;
  zavorthRoot?: string | null;
  ledgerPath?: string | null;
  fallback?: string | null;
};

const DEFAULT_LEDGER_RELATIVE_PATH = path.join('docs', '400-zavorth-source-full-surface-ledger-private.json');

export function resolveZavorthSourceRoot(input: ResolveSourceRootInput = {}): string {
  return path.resolve(
    firstText(
      input.sourceRoot,
      readEnv('ZAVORTH_SOURCE_ROOT', 'SOURCE_ROOT'),
      readLedgerSourceRoot(input),
      input.fallback,
      process.cwd(),
    ),
  );
}

function readLedgerSourceRoot(input: ResolveSourceRootInput): string | null {
  const zavorthRoot = path.resolve(input.zavorthRoot || process.cwd());
  const ledgerPath = path.resolve(input.ledgerPath || path.join(zavorthRoot, DEFAULT_LEDGER_RELATIVE_PATH));
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as { sourceRoot?: unknown };
    return typeof parsed.sourceRoot === 'string' && parsed.sourceRoot.trim()
      ? parsed.sourceRoot
      : null;
  } catch (error: any) { logger.warn('[Zavorth Source Root Resolver] JSON parse failed', error); return null; }
}

function readEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return null;
}

function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return process.cwd();
}
