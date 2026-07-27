/**
 * import / link hub intents and help.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  formatImportHelp,
  formatLinkHelp,
  resolveImportIntent,
  resolveLinkIntent,
} from './stubs/ImportLinkCli.js';
import { DeepHomeImportPlannerService } from '../services/import/DeepHomeImportPlannerService.js';
import { PeerLinkSurfaceService } from '../services/peer/PeerLinkSurfaceService.js';
import { PeerToolMirrorService } from '../services/peer/PeerToolMirrorService.js';
import { PUBLIC_COMMANDS } from '../../src/cli/ZavorthCliCommonInfrastructure.js';

describe('import hub intents', () => {
  it('exposes import and link on public commands', () => {
    expect(PUBLIC_COMMANDS).toEqual(expect.arrayContaining(['connect', 'learn']));
    expect(PUBLIC_COMMANDS).not.toContain('migrate');
  });

  it('shows import help', () => {
    expect(resolveImportIntent([]).kind).toBe('help');
    expect(resolveImportIntent(['--help']).kind).toBe('help');
    const help = formatImportHelp();
    expect(help).toContain('zavorth import home');
    expect(help).toContain('zavorth import pack');
    expect(help).toContain('zavorth import skills');
    expect(help).toContain('zavorth link');
  });

  it('routes import home with smart flag', () => {
    const intent = resolveImportIntent(['home', 'C:/tmp/agent', '--smart', '--json']);
    expect(intent.kind).toBe('home');
    if (intent.kind === 'home') {
      expect(intent.path).toContain('agent');
      expect(intent.smart).toBe(true);
      expect(intent.json).toBe(true);
    }
  });

  it('routes import pack and skills', () => {
    expect(resolveImportIntent(['pack', './other']).kind).toBe('pack');
    const skills = resolveImportIntent(['skills', 'peer-1', '--consent']);
    expect(skills.kind).toBe('skills');
    if (skills.kind === 'skills') {
      expect(skills.linkId).toBe('peer-1');
    }
  });
});

describe('link hub intents', () => {
  it('shows link help', () => {
    expect(resolveLinkIntent([]).kind).toBe('help');
    const help = formatLinkHelp();
    expect(help).toContain('zavorth link open');
    expect(help).toContain('zavorth link use');
    expect(help).toContain('zavorth link ask');
    expect(help).toMatch(/mediated full surface access|Mediated access/i);
  });

  it('routes open / use / ask / sync', () => {
    const open = resolveLinkIntent(['open', 'peer-a', '--live', '--approve']);
    expect(open.kind).toBe('open');
    if (open.kind === 'open') {
      expect(open.linkId).toBe('peer-a');
      expect(open.live).toBe(true);
      expect(open.approve).toBe(true);
    }

    const use = resolveLinkIntent(['use', 'peer-a', 'search', '--approve']);
    expect(use.kind).toBe('use');
    if (use.kind === 'use') {
      expect(use.linkId).toBe('peer-a');
      expect(use.toolName).toBe('search');
      expect(use.approve).toBe(true);
    }

    const ask = resolveLinkIntent(['ask', 'peer-a', 'list', 'files', '--approve']);
    expect(ask.kind).toBe('ask');
    if (ask.kind === 'ask') {
      expect(ask.linkId).toBe('peer-a');
      expect(ask.prompt).toContain('list');
      expect(ask.approve).toBe(true);
    }

    const sync = resolveLinkIntent(['sync', 'peer-a', '--mirror', '--consent', '--live', '--approve']);
    expect(sync.kind).toBe('sync');
    if (sync.kind === 'sync') {
      expect(sync.mirror).toBe(true);
      expect(sync.consent).toBe(true);
      expect(sync.live).toBe(true);
      expect(sync.approve).toBe(true);
    }
  });

  it('routes find and add', () => {
    expect(resolveLinkIntent(['find', '--path', 'x']).kind).toBe('find');
    expect(resolveLinkIntent(['add', '--id', 'x']).kind).toBe('add');
    expect(resolveLinkIntent(['list']).kind).toBe('list');
  });
});

describe('DeepHomeImportPlannerService', () => {
  it('classifies structural agent-home layout without LLM', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-import-home-'));
    try {
      fs.writeFileSync(path.join(root, 'SOUL.md'), '# soul\n');
      fs.writeFileSync(path.join(root, 'IDENTITY.md'), '# id\n');
      fs.mkdirSync(path.join(root, 'skills', 'demo'), { recursive: true });
      fs.writeFileSync(path.join(root, 'skills', 'demo', 'SKILL.md'), '# skill\n');
      fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
      fs.writeFileSync(path.join(root, 'memory', 'notes.md'), 'note\n');
      fs.writeFileSync(path.join(root, 'mcp.json'), '{}\n');
      fs.writeFileSync(path.join(root, 'config.yaml'), 'x: 1\n');
      fs.writeFileSync(path.join(root, 'mystery.bin.txt'), 'unknown blob\n');

      const planner = new DeepHomeImportPlannerService();
      const plan = await planner.buildPlan({ sourcePath: root, smart: false });
      expect(plan.summary.total).toBeGreaterThan(5);
      expect(plan.summary.identity).toBeGreaterThanOrEqual(1);
      expect(plan.summary.skill).toBeGreaterThanOrEqual(1);
      expect(plan.summary.memory).toBeGreaterThanOrEqual(1);
      expect(plan.summary.mcp).toBeGreaterThanOrEqual(1);
      expect(plan.llmUsed).toBe(false);
      expect(plan.ontology).toContain('skill');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('optional LLM reclassifies unknowns via closed ontology', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-import-llm-'));
    try {
      fs.writeFileSync(path.join(root, 'weird-notes.txt'), 'user likes dark mode\n');
      const planner = new DeepHomeImportPlannerService();
      const provider = {
        chat: async () => ({
          content: JSON.stringify([
            { path: 'weird-notes.txt', kind: 'memory', confidence: 0.9, reason: 'personal notes' },
          ]),
        }),
      };
      const plan = await planner.buildPlan({
        sourcePath: root,
        smart: true,
        provider: provider as any,
      });
      const item = plan.items.find((i) => i.relativePath === 'weird-notes.txt');
      expect(item?.kind).toBe('memory');
      expect(item?.source).toBe('llm');
      expect(plan.llmUsed).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('PeerToolMirrorService', () => {
  it('writes and loads mirror tool definitions under project root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-peer-mirror-'));
    try {
      const mirror = new PeerToolMirrorService({ projectRoot: root });
      const record = mirror.writeMirror({
        generatedAt: new Date().toISOString(),
        linkId: 'peer-x',
        label: 'Peer X',
        adapter: 'mcp',
        status: 'enabled',
        liveExecutionEnabled: true,
        surface: {
          tools: [{ name: 'search', summary: 'Search', risk: 'low', schema: null, source: 'profile' }],
          skills: ['search'],
          plugins: [],
          resources: [],
        },
        modes: { ask: true, use: true, mirror: true },
        safety: {
          approvalPerInvoke: true,
          isolation: 'local',
          network: 'disabled',
          mediatedFullAccess: true,
          rawOsTakeover: false,
        },
        findings: [],
      });
      expect(record.tools[0]?.executionBackend).toBe('peer:peer-x');
      const defs = mirror.loadAllToolDefinitions();
      expect(defs.some((t) => t.name.includes('search'))).toBe(true);
      const reg = new Map();
      const merged = mirror.mergeIntoRegistry(reg);
      expect(merged.added.length).toBeGreaterThan(0);
      expect(reg.size).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('PeerLinkSurfaceService', () => {
  it('open missing link returns findings without crash', () => {
    const service = new PeerLinkSurfaceService({
      gateway: {
        buildRegistrySnapshot: () => ({
          profiles: [],
          summary: { total: 0 },
        }),
        listCapabilities: () => ({ capabilities: [], findings: [] }),
      } as any,
    });
    const snap = service.open('missing-peer');
    expect(snap.status).toBe('missing');
    expect(snap.safety.mediatedFullAccess).toBe(true);
    expect(snap.safety.rawOsTakeover).toBe(false);
    expect(snap.findings.join(' ')).toMatch(/not found/i);
  });

  it('use without approval returns approval-required', async () => {
    const service = new PeerLinkSurfaceService({
      gateway: {
        buildRegistrySnapshot: () => ({
          profiles: [
            {
              id: 'peer-1',
              label: 'Peer',
              adapter: 'cli',
              status: 'enabled',
              liveExecutionEnabled: true,
              allowedCapabilities: ['search'],
              isolation: { kind: 'local-supervised', strongBoundary: false, network: 'disabled' },
            },
          ],
        }),
        listCapabilities: () => ({ capabilities: [], findings: [] }),
        invoke: async () => ({ status: 'completed', outputText: 'ok', execution: {} }),
      } as any,
    });
    const result = await service.use({
      linkId: 'peer-1',
      toolName: 'search',
      approvalGranted: false,
    });
    expect(result.status).toBe('approval-required');
    expect(result.live).toBe(false);
  });

  it('renderOpenText includes next commands', () => {
    const service = new PeerLinkSurfaceService({
      gateway: {
        buildRegistrySnapshot: () => ({
          profiles: [
            {
              id: 'peer-1',
              label: 'Peer',
              adapter: 'mcp',
              status: 'enabled',
              liveExecutionEnabled: true,
              allowedCapabilities: ['alpha'],
              isolation: { kind: 'local-supervised', strongBoundary: false, network: 'local-only' },
            },
          ],
        }),
        listCapabilities: () => ({
          capabilities: [
            { id: 'alpha', name: 'Alpha', toolName: 'alpha', summary: 'A', source: 'profile-declared', adapter: 'mcp' },
          ],
          findings: [],
        }),
      } as any,
    });
    const text = service.renderOpenText(service.open('peer-1'));
    expect(text).toContain('link use peer-1');
    expect(text).toContain('link ask peer-1');
    expect(text).toContain('import skills peer-1');
  });
});
