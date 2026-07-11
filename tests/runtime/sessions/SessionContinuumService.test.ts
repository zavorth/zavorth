import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  SessionContinuumService,
  resolveSessionContinuumStorePath,
} from '../../../src/services/SessionContinuumService.js';
import type { ContextCompactionMessage } from '../../../src/services/ContextCompactionService.js';
import { SessionSearchFts5Tool } from '../../../src/tools/SessionSearchFts5Tool.js';
import { ZavorthSessionSearchTool } from '../../../src/tools/ZavorthSessionSearchTool.js';
import { ToolExposurePolicy } from '../../../src/runtime/agent/ToolExposurePolicy.js';
import { resolveToolGroupCatalogEntry } from '../../../src/runtime/agent/tools/ToolGroupCatalog.js';
import { SAFE_OBSERVATION_TOOL_NAMES } from '../../../src/tools/governance/SafeObservationTools.js';

function bulkyToolOutput(): string {
  return Array.from({ length: 240 }, (_, index) => `stdout ${index}: repeated build line`).join('\n');
}

describe('SessionContinuumService', () => {
  let root: string;
  let storePath: string;
  const now = () => new Date('2026-06-15T12:00:00.000Z');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-session-continuum-'));
    storePath = resolveSessionContinuumStorePath(path.join(root, 'runtime'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('uses one store path for append, search, and tool-facing search', async () => {
    const continuum = new SessionContinuumService({ storePath, now });
    continuum.appendTurn({
      sessionId: 'session-continuum-1',
      title: 'Provider mesh',
      userMessage: 'Fix native session search continuum path.',
      assistantMessage: 'Appended to local mnemos session recall store.',
    });

    const browse = continuum.browse({ limit: 5 });
    const discover = continuum.discover('continuum path', { limit: 5 });
    const searchTool = new SessionSearchFts5Tool({ continuum });
    const zavorthTool = new ZavorthSessionSearchTool({ continuum });
    const toolResult = await searchTool.execute({ mode: 'discover', query: 'continuum' });
    const zavorthResult = await zavorthTool.execute({ query: 'continuum' });

    expect(continuum.getStorePath()).toBe(path.resolve(storePath));
    expect(discover.storePath).toBe(path.resolve(storePath));
    expect(browse.mode).toBe('browse');
    expect(discover.returned).toBeGreaterThan(0);
    expect(discover.hits[0]?.sessionId).toBe('session-continuum-1');
    expect(toolResult).toContain(path.resolve(storePath));
    expect(toolResult).toContain('continuum');
    expect(zavorthResult).toContain(path.resolve(storePath));
    expect(zavorthResult).toContain('continuum');
    expect(fs.existsSync(storePath)).toBe(true);
  });

  it('surfaces compaction receipts through continuum.compact', () => {
    const continuum = new SessionContinuumService({ storePath, now });
    const messages: ContextCompactionMessage[] = [
      { role: 'user', content: 'Analyze the repository.' },
      {
        role: 'assistant',
        content: 'Let me run a shell command.',
        toolCalls: [{ id: 'call-shell-1', name: 'shell', arguments: {} }],
      },
      {
        role: 'tool',
        toolName: 'shell',
        toolCallId: 'call-shell-1',
        status: 'ok',
        content: bulkyToolOutput(),
      },
      { role: 'assistant', content: 'I found the architecture entrypoints.' },
      { role: 'user', content: 'Keep this exact instruction for the next step.' },
    ];

    const result = continuum.compact({
      messages,
      now: now(),
      lastActivityAt: new Date(now().getTime() - 61 * 60 * 1000),
      usableContextTokens: 50000,
      recentVerbatimTurns: 2,
    });

    expect(result.triggered).toBe(true);
    expect(result.mode).toBe('time-based-microcompact');
    expect(result.receipt).toEqual(expect.objectContaining({
      durableMutation: false,
      providerCall: false,
      gatesToolAuthority: false,
      secretsRedacted: true,
    }));
    expect(result.receipt.id).toMatch(/^ctx-compact-/);
  });

  it('exposes session_search and aliases as safe tools without experimental flags', () => {
    const policy = new ToolExposurePolicy();
    const tools = [
      'session_search',
      'session_search_fts5',
      'zavorth_session_search',
      'sessions.search',
      'sessions.history',
      'sessions.list',
      'memory.read',
    ];
    const profile = policy.buildProfile({ requestedTools: tools });

    for (const toolId of tools) {
      const entry = profile.tools.find((tool) => tool.id === toolId);
      expect(entry).toEqual(expect.objectContaining({
        id: toolId,
        risk: 'safe',
        requiresApproval: false,
      }));
    }

    expect(resolveToolGroupCatalogEntry('session_search')?.risk).toBe('safe');
    expect(resolveToolGroupCatalogEntry('session_search_fts5')?.risk).toBe('safe');
    expect(resolveToolGroupCatalogEntry('zavorth_session_search')?.risk).toBe('safe');
    expect(resolveToolGroupCatalogEntry('sessions.search')?.risk).toBe('safe');
    expect(new SessionSearchFts5Tool().name).toBe('session_search');
    expect(SAFE_OBSERVATION_TOOL_NAMES).toEqual(expect.arrayContaining([
      'session_search',
      'zavorth_session_search',
      'session_search_fts5',
      'sessions.search',
    ]));
  });

  it('captures user text through appendTurn even without messages[]', () => {
    const continuum = new SessionContinuumService({ storePath, now });
    continuum.appendTurn({
      sessionId: 'session-text-only',
      title: 'runtime',
      userMessage: 'What did we decide about continuum defaults?',
      assistantMessage: 'Session search is on the default daily path.',
    });
    const hits = continuum.discover('continuum defaults', { limit: 5 });
    expect(hits.returned).toBeGreaterThan(0);
    expect(hits.hits.some((hit) => /continuum defaults/i.test(hit.snippet || hit.title))).toBe(true);
  });
});
