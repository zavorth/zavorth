/**
 * Local conversation continuum capture + redacted recall helpers.
 * Pillar: Conversation recall (Learned Knowledge Plane).
 */

import path from 'node:path';
import {
  SessionContinuumService,
  resolveSessionContinuumStorePath,
  type SessionContinuumAppendTurnResult,
  type SessionContinuumSearchInput,
} from '../SessionContinuumService.js';
import type { ZavorthSessionRecallSnapshot } from '../ZavorthSessionRecallService.js';
import { isContinuumCaptureEnabled } from './LearnedKnowledgeFlags.js';
import { stripMemoryScaffolding } from '../memory/MemoryIngestionHygiene.js';
import { logger } from '../../logger.js';

const SECRET_RE = /\b(?:api[_-]?key|token|password|secret|authorization|bearer|client_secret)\s*[:=]\s*\S+/gi;
const TOKEN_PREFIX_RE = /\b(?:sk-|hf_|AIza|xox[baprs]-|ghp_|gho_|github_pat_|AKIA)[A-Za-z0-9_-]{8,}\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

export function redactConversationText(text: string): string {
  return String(text || '')
    .replace(SECRET_RE, '[REDACTED]')
    .replace(BEARER_RE, 'Bearer [REDACTED]')
    .replace(TOKEN_PREFIX_RE, '[REDACTED]')
    .replace(JWT_RE, '[REDACTED]')
    .trim();
}

export type CaptureConversationTurnInput = {
  userMessage?: string | null;
  assistantMessage?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  surface?: string | null;
  projectRoot?: string | null;
  runtimeDir?: string | null;
  dbPath?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export type ConversationRecallInput = SessionContinuumSearchInput & {
  projectRoot?: string | null;
  runtimeDir?: string | null;
  dbPath?: string | null;
  maxSnippet?: number | null;
};

let sharedContinuum: SessionContinuumService | null = null;
let sharedKey = '';

function resolveRuntimeDir(input: { projectRoot?: string | null; runtimeDir?: string | null }): string {
  if (input.runtimeDir) return path.resolve(String(input.runtimeDir));
  const root = path.resolve(String(input.projectRoot || process.cwd()));
  return path.join(root, 'data', 'runtime');
}

export function getConversationContinuum(options: {
  projectRoot?: string | null;
  runtimeDir?: string | null;
  dbPath?: string | null;
} = {}): SessionContinuumService {
  const runtimeDir = resolveRuntimeDir(options);
  const storePath = resolveSessionContinuumStorePath(runtimeDir);
  const dbPath = options.dbPath ? path.resolve(String(options.dbPath)) : null;
  const key = `${storePath}::${dbPath || ''}`;
  if (sharedContinuum && sharedKey === key) return sharedContinuum;
  sharedContinuum = new SessionContinuumService({
    storePath,
    stateDbPath: dbPath,
  });
  sharedKey = key;
  return sharedContinuum;
}

/** Reset cached continuum (tests). */
export function resetConversationContinuumCache(): void {
  sharedContinuum = null;
  sharedKey = '';
}

/**
 * Best-effort end-of-turn capture. Never throws to callers.
 * Disabled when ZAVORTH_CONTINUUM_CAPTURE=0.
 */
export function captureConversationTurn(
  input: CaptureConversationTurnInput,
): SessionContinuumAppendTurnResult | null {
  if (!isContinuumCaptureEnabled()) return null;
  const userMessage = stripMemoryScaffolding(redactConversationText(String(input.userMessage || ''))).slice(0, 8000);
  const assistantMessage = stripMemoryScaffolding(redactConversationText(String(input.assistantMessage || ''))).slice(0, 8000);
  if (!userMessage && !assistantMessage) return null;
  try {
    const continuum = getConversationContinuum({
      projectRoot: input.projectRoot,
      runtimeDir: input.runtimeDir,
      dbPath: input.dbPath,
    });
    const surface = String(input.surface || 'conversational').trim() || 'conversational';
    const userId = String(input.userId || '').trim() || null;
    return continuum.appendTurn({
      sessionId: input.sessionId || null,
      title: surface,
      userMessage: userMessage || null,
      assistantMessage: assistantMessage || null,
      metadata: {
        ...(input.metadata || {}),
        surface,
        userId,
        source: input.source || 'ConversationContinuumCapture',
        continuum: 'session-continuum/1',
        localOnly: true,
      },
    });
  } catch (error: unknown) {
    logger.warn('[Conversation continuum] capture failed', error);
    return null;
  }
}

/**
 * Search conversation continuum (JSON store or operational FTS when dbPath set).
 * Snippets are re-redacted before return.
 */
export function recallConversations(input: ConversationRecallInput = {}): ZavorthSessionRecallSnapshot {
  const continuum = getConversationContinuum({
    projectRoot: input.projectRoot,
    runtimeDir: input.runtimeDir,
    dbPath: input.dbPath,
  });
  const limit = Math.min(50, Math.max(1, Number(input.limit || 8) || 8));
  const snap = continuum.recall({
    query: input.query,
    sessionId: input.sessionId,
    currentSessionId: input.currentSessionId,
    aroundMessageId: input.aroundMessageId,
    limit,
    window: input.window,
  });
  const maxSnippet = Math.min(500, Math.max(40, Number(input.maxSnippet || 200) || 200));
  return {
    ...snap,
    hits: (snap.hits || []).map((hit) => ({
      ...hit,
      snippet: redactConversationText(String(hit.snippet || '')).slice(0, maxSnippet),
      neighbors: (hit.neighbors || []).map((n) => ({
        ...n,
        content: redactConversationText(String(n.content || '')).slice(0, maxSnippet),
      })),
    })),
  };
}

export function formatConversationRecallLines(
  snap: ZavorthSessionRecallSnapshot,
  maxSnippet = 200,
): string[] {
  if (!snap.hits?.length) {
    return [
      'No conversation hits.',
      `Store: ${snap.storePath}`,
      'Complete a chat turn (continuum capture on) then search again.',
    ];
  }
  const continuum = getConversationContinuum({});
  const lines = continuum.formatHits(snap.hits, maxSnippet).map((line) => redactConversationText(line));
  lines.unshift(
    `Conversation recall (${snap.mode}): ${snap.returned} hit(s) · sessions=${snap.sessionCount}`,
    `Store: ${snap.storePath}`,
  );
  return lines;
}

export function continuumBackendLabel(options: {
  projectRoot?: string | null;
  runtimeDir?: string | null;
  dbPath?: string | null;
} = {}): 'operational-fts' | 'json-store' {
  const continuum = getConversationContinuum(options);
  continuum.getStorePath();
  // When state DB path is configured and file exists or path set, recall service prefers FTS.
  // Honesty: if dbPath provided to constructor, label operational-fts; else json-store.
  if (options.dbPath) return 'operational-fts';
  return 'json-store';
}
