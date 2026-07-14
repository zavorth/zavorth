import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SkillWorkerDiscoveryService } from '../../src/services/SkillWorkerDiscoveryService.js';
import { SkillLocalRegistry } from '../../src/skills/marketplace/SkillLocalRegistry.js';
import { WorkerMeshService } from '../../src/services/WorkerMeshService.js';
import { ZavorthExternalAgentGatewayService } from '../../src/services/ZavorthExternalAgentGatewayService.js';

describe('W6 SkillWorkerDiscoveryService', () => {
  let tempRoot: string;
  let projectRoot: string;
  let skillsDir: string;
  let dataDir: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-discover-'));
    projectRoot = path.join(tempRoot, 'proj');
    skillsDir = path.join(projectRoot, 'skills');
    dataDir = path.join(projectRoot, 'data', 'runtime', 'skill-marketplace');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    // Workspace skill
    const skillA = path.join(skillsDir, 'pr-review');
    fs.mkdirSync(skillA, { recursive: true });
    fs.writeFileSync(path.join(skillA, 'SKILL.md'), '# PR review\n', 'utf8');
    fs.writeFileSync(
      path.join(skillA, 'manifest.json'),
      JSON.stringify({
        name: 'pr-review',
        version: '1.0.0',
        description: 'Review pull requests and ship checklist',
        author: 'zavorth-test',
        category: 'devops',
        tags: ['pr', 'review', 'git'],
      }),
      'utf8',
    );

    // package bin candidate
    const app = path.join(projectRoot, 'apps', 'mycli');
    fs.mkdirSync(app, { recursive: true });
    fs.writeFileSync(
      path.join(app, 'package.json'),
      JSON.stringify({ name: 'mycli', bin: { mycli: './bin.js' }, description: 'sample cli' }),
      'utf8',
    );
    fs.writeFileSync(path.join(app, 'AGENTS.md'), '# agents\n', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function makeService(remoteImpl?: (q: string) => Promise<Array<{
    fullName: string;
    description: string;
    url: string;
    stars: number;
    updatedAt: string;
  }>>) {
    const registry = new SkillLocalRegistry({ dataDir });
    registry.addEntry(
      {
        name: 'web-search-helper',
        version: '0.1.0',
        description: 'Helpers for web search workflows',
        author: 'zavorth-core',
        category: 'research',
        tags: ['web', 'search'],
        checksum: 'sha256:abc',
      } as never,
      'local',
      null,
    );
    registry.markInstalled('web-search-helper');

    const gateway = new ZavorthExternalAgentGatewayService({
      projectRoot,
      registryFile: path.join(projectRoot, 'data', 'runtime', 'external-agent-profiles.json'),
    });
    const mesh = new WorkerMeshService({ projectRoot, gateway });

    return new SkillWorkerDiscoveryService({
      projectRoot,
      skillsDir,
      registry,
      mesh,
      remoteSearch: remoteImpl,
    });
  }

  it('finds local workspace skills offline by capability query', async () => {
    const svc = makeService(async () => {
      throw new Error('network should not be called');
    });
    const result = await svc.discover({
      query: 'PR review',
      remote: false,
      includeWorkers: true,
      scanWorkspace: true,
    });
    expect(result.offline).toBe(true);
    expect(result.skills.some((s) => s.id === 'pr-review' || s.name.includes('pr-review'))).toBe(true);
    expect(result.formatText()).toMatch(/PR review|pr-review/i);
  });

  it('ranks installed registry skills for web search query', async () => {
    const svc = makeService(async () => []);
    const result = await svc.discover({ query: 'web search', remote: false });
    expect(result.skills.some((s) => s.id === 'web-search-helper' && s.installed)).toBe(true);
  });

  it('detects install-from-URL in free text', async () => {
    const svc = makeService(async () => []);
    const result = await svc.discover({
      query: 'please install https://github.com/acme/skill-pack later',
      remote: false,
    });
    expect(result.urlInstall.detected).toBe(true);
    expect(result.urlInstall.source).toMatch(/github.com\/acme\/skill-pack/);
    expect(result.skills[0]?.source).toBe('url');
  });

  it('awaits remote results when remote=true (injectable)', async () => {
    const svc = makeService(async (q) => {
      expect(q).toMatch(/memory/i);
      return [
        {
          fullName: 'acme/memory-skill',
          description: 'memory tools',
          url: 'https://github.com/acme/memory-skill',
          stars: 42,
          updatedAt: '2026-01-01',
        },
      ];
    });
    const result = await svc.discover({ query: 'memory', remote: true });
    expect(result.offline).toBe(false);
    expect(result.skills.some((s) => s.source === 'remote' && s.sourceUrl?.includes('memory-skill'))).toBe(true);
  });

  it('suggests worker candidates without brand labels', async () => {
    const svc = makeService(async () => []);
    const result = await svc.discover({
      query: 'cli',
      remote: false,
      includeWorkers: true,
      scanWorkspace: true,
    });
    expect(result.workers.length).toBeGreaterThan(0);
    const labels = result.workers.map((w) => w.label).join(' ');
    expect(labels).toMatch(/CLI worker|Agent project|MCP worker/);
    expect(result.workers.every((w) => w.registerPreview.includes('preview') || w.registerPreview.includes('register'))).toBe(true);
  });

  it('includes journey hint in formatText', async () => {
    const svc = makeService(async () => []);
    const text = (await svc.discover({ query: 'x', remote: false })).formatText();
    expect(text).toMatch(/Journeys/i);
    expect(text).toMatch(/preview/i);
  });
});
