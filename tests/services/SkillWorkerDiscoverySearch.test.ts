import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SkillWorkerDiscoveryService } from '../../src/services/SkillWorkerDiscoveryService.js';
import { SkillLocalRegistry } from '../../src/skills/marketplace/SkillLocalRegistry.js';
import { SkillSearchIndexService } from '../../src/services/SkillSearchIndexService.js';
import { LlmSkillRankService } from '../../src/services/LlmSkillRankService.js';

describe('SkillWorkerDiscoveryService search', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-discovery-'));
    const skillDir = path.join(tempRoot, 'skills', 'local-web');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: local-web\ndescription: web search helper\ntools:\n  - name: web_search\n---\n# Local web\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(skillDir, 'manifest.json'),
      JSON.stringify({
        name: 'local-web',
        version: '1.0.0',
        description: 'web search helper',
        tools: [{ name: 'web_search' }],
      }),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('searches local skills offline without remote', async () => {
    const discovery = new SkillWorkerDiscoveryService({
      projectRoot: tempRoot,
      skillsDir: path.join(tempRoot, 'skills'),
      registry: new SkillLocalRegistry({ dataDir: path.join(tempRoot, 'registry') }),
      searchIndex: new SkillSearchIndexService({
        projectRoot: tempRoot,
        skillsDir: path.join(tempRoot, 'skills'),
        skillSourcesPath: path.join(tempRoot, 'no-sources.json'),
      }),
      remoteSearch: async () => {
        throw new Error('network should not be called');
      },
    });
    const result = await discovery.discover({
      query: 'web_search',
      remote: false,
      includeWorkers: false,
      limit: 10,
    });
    expect(result.offline).toBe(true);
    expect(result.usedLlmRank).toBe(false);
    expect(result.skills.some((s) => s.id.includes('local-web') || s.name.includes('local-web'))).toBe(true);
  });

  it('optional LLM rank reorders closed candidates only', async () => {
    const discovery = new SkillWorkerDiscoveryService({
      projectRoot: tempRoot,
      skillsDir: path.join(tempRoot, 'skills'),
      registry: new SkillLocalRegistry({ dataDir: path.join(tempRoot, 'registry') }),
      searchIndex: new SkillSearchIndexService({
        projectRoot: tempRoot,
        skillsDir: path.join(tempRoot, 'skills'),
        skillSourcesPath: path.join(tempRoot, 'no-sources.json'),
      }),
      llmRank: new LlmSkillRankService({
        chat: {
          complete: async () => JSON.stringify({ orderedIds: ['local-web'] }),
        },
      }),
      remoteSearch: async () => [],
    });
    const result = await discovery.discover({
      query: 'web',
      remote: false,
      useLlm: true,
      includeWorkers: false,
      limit: 10,
    });
    expect(result.usedLlmRank).toBe(true);
    expect(result.skills[0]?.id).toBe('local-web');
  });
});
