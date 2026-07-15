import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginRouterService } from '../../src/services/PluginRouterService.js';

describe('PluginRouterService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function writePlugin(root: string, id: string, summary: string, tags: string[], caps: string[]) {
    const dir = path.join(root, 'plugins', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        id,
        label: id,
        summary,
        description: summary,
        moduleKind: 'tool',
        tags,
        capabilities: caps.map((cap) => ({ id: cap, intent: cap, label: cap, summary: cap })),
      }),
      'utf8',
    );
  }

  it('does not soft-rank free-text phrases via keyword overlap', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-router-'));
    tempRoots.push(root);
    writePlugin(root, 'web-search', 'Search the web via backends', ['search', 'web'], ['search.query']);
    writePlugin(root, 'github', 'GitHub CLI bridge', ['github'], ['github.status']);
    writePlugin(root, 'cost-tracker', 'LLM cost ledger', ['cost'], ['cost.summary']);

    const service = new PluginRouterService();
    const result = await service.recommend({
      root,
      intent: 'I need to search the web',
      limit: 3,
      useLlm: false,
    });

    expect(result.ok).toBe(true);
    expect(result.usedLlm).toBe(false);
    // Free-text keyword ranking removed — no forced web-search win without LLM or exact id.
    expect(result.recommendations.some((item) => item.pluginId === 'web-search')).toBe(false);
  });

  it('ranks exact plugin id intent without free-text soft match', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-router-exact-'));
    tempRoots.push(root);
    writePlugin(root, 'web-search', 'Search the web via backends', ['search', 'web'], ['search.query']);
    writePlugin(root, 'github', 'GitHub CLI bridge', ['github'], ['github.status']);

    const service = new PluginRouterService();
    const result = await service.recommend({
      root,
      intent: 'web-search',
      limit: 3,
      useLlm: false,
    });

    expect(result.recommendations[0]?.pluginId).toBe('web-search');
    expect(result.recommendations[0]?.reasons.join(' ')).toMatch(/exact plugin id/i);
  });

  it('explain returns found metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-router-explain-'));
    tempRoots.push(root);
    writePlugin(root, 'memory-local', 'Local key value memory', ['memory'], ['memory.write']);
    const explained = new PluginRouterService().explain({ root, pluginId: 'memory-local' });
    expect(explained.found).toBe(true);
    expect(explained.reasons.length).toBeGreaterThan(0);
  });

  it('accepts explicit candidates with exact plugin id intent', async () => {
    const service = new PluginRouterService();
    const result = await service.recommend({
      root: process.cwd(),
      intent: 'github',
      useLlm: false,
      candidates: [
        {
          pluginId: 'github',
          summary: 'PRs and issues',
          tags: ['github', 'pr'],
          capabilities: [{ id: 'github.pr.list' }],
        },
        { pluginId: 'web-search', summary: 'web', tags: ['search'], capabilities: [{ id: 'search.query' }] },
      ],
    });
    expect(result.recommendations[0].pluginId).toBe('github');
  });

  it('does not soft-match free-text "pull requests" to github without LLM', async () => {
    const service = new PluginRouterService();
    const result = await service.recommend({
      root: process.cwd(),
      intent: 'github pull requests',
      useLlm: false,
      candidates: [
        {
          pluginId: 'github',
          summary: 'PRs and issues',
          tags: ['github', 'pr'],
          capabilities: [{ id: 'github.pr.list' }],
        },
        { pluginId: 'web-search', summary: 'web', tags: ['search'], capabilities: [{ id: 'search.query' }] },
      ],
    });
    // "github" as token is exact id match; free-text words "pull"/"requests" do not rank alone.
    expect(result.recommendations[0]?.pluginId).toBe('github');
    // Intent that only has free-text words yields no soft ranking:
    const empty = await service.recommend({
      root: process.cwd(),
      intent: 'pull requests and issues please',
      useLlm: false,
      candidates: [
        {
          pluginId: 'github',
          summary: 'PRs and issues',
          tags: ['github', 'pr'],
          capabilities: [{ id: 'github.pr.list' }],
        },
      ],
    });
    expect(empty.recommendations).toEqual([]);
  });
});
