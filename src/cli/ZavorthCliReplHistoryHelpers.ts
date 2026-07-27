import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger.js';
import {
CLI_REPL_HISTORY_FILE,
  CLI_REPL_HISTORY_LIMIT,
  CLI_REPL_SUGGESTIONS,
} from './ZavorthCliReplConfig.js';export function createDefaultSessionId(): string {
  return `cli-session-${Date.now()}`;
}

export function loadCliReplHistory(): string[] {
  try {
    if (!fs.existsSync(CLI_REPL_HISTORY_FILE)) {
      return [];
    }

    return fs
      .readFileSync(CLI_REPL_HISTORY_FILE, 'utf8')
      .split(/\r...\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-CLI_REPL_HISTORY_LIMIT)
      .reverse();
  } catch (error: unknown) {logger.warn('[Zavorth Cli Repl History Helpers] filesystem operation failed', error); return []; }
}

export function persistCliReplHistory(rawLine: string): void {
  const normalized = String(rawLine || '').trim();
  if (!normalized) {
    return;
  }

  try {
    const existing = fs.existsSync(CLI_REPL_HISTORY_FILE)
      ? fs
          .readFileSync(CLI_REPL_HISTORY_FILE, 'utf8')
          .split(/\r...\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [];
    const next = [...existing.filter((entry) => entry !== normalized), normalized].slice(-CLI_REPL_HISTORY_LIMIT);
    fs.mkdirSync(path.dirname(CLI_REPL_HISTORY_FILE), { recursive: true });
    fs.writeFileSync(CLI_REPL_HISTORY_FILE, `${next.join('\n')}\n`, 'utf8');
  } catch (error: unknown) {// REPL history should never break the CLI.
      logger.warn('[Zavorth Cli Repl History Helpers] filesystem operation failed', error);
    }
}

export function buildCliReplCompleter(line: string): [string[], string] {
  const raw = String(line || '');
  const lower = raw.toLowerCase();
  const hits = CLI_REPL_SUGGESTIONS.filter((entry) => entry.startsWith(lower));
  return [hits.length > 0 ? hits : CLI_REPL_SUGGESTIONS, raw];
}
