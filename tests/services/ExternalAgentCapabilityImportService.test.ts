import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ExternalAgentCapabilityImportService } from '../../src/services/ExternalAgentCapabilityImportService.js';
import { ZavorthExternalAgentGatewayService } from '../../src/services/ZavorthExternalAgentGatewayService.js';
import { SkillSearchIndexService } from '../../src/services/SkillSearchIndexService.js';

describe('ExternalAgentCapabilityImportService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ext-cap-'));
    fs.mkdirSync(path.join(root, 'data', 'runtime'), { recursive: true });
    fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function registerProfile(
    gateway: ZavorthExternalAgentGatewayService,
    id: string,
    adapter: 'cli' | 'http' | 'acp' | 'mcp' = 'cli',
    caps: string[] = ['review', 'analyze', 'web_search'],
  ) {
    const receipt = gateway.registerProfile({
      id,
      adapter,
      command: adapter === 'cli' ? 'agent' : null,
      endpoint: adapter === 'http' || adapter === 'mcp' ? 'https://example.com/agent' : null,
      allowedCapabilities: caps,
      enableLive: true,
      approvalGranted: true,
      allowRemoteNetwork: true,
      requestedBy: 'test',
    });
    expect(receipt.status).toBe('registered');
  }

  it('lists capabilities offline from profile-declared tools (no process)', () => {
    const gateway = new ZavorthExternalAgentGatewayService({
      projectRoot: root,
      registryFile: path.join(root, 'data', 'runtime', 'external-agent-profiles.json'),
    });
    registerProfile(gateway, 'mock-cli', 'cli');

    const svc = new ExternalAgentCapabilityImportService({
      projectRoot: root,
      gateway,
    });
    const listed = svc.listCapabilities({ profileId: 'mock-cli' });
    expect(listed.ok).toBe(true);
    expect(listed.processExecuted).toBe(false);
    expect(listed.offline).toBe(true);
    expect(listed.adapter).toBe('cli');
    expect(listed.capabilities.map((c) => c.id)).toEqual(expect.arrayContaining(['review', 'analyze', 'web_search']));
  });

  it('does not import without consent', () => {
    const gateway = new ZavorthExternalAgentGatewayService({
      projectRoot: root,
      registryFile: path.join(root, 'data', 'runtime', 'external-agent-profiles.json'),
    });
    registerProfile(gateway, 'preview-agent', 'http');

    const svc = new ExternalAgentCapabilityImportService({ projectRoot: root, gateway });
    const result = svc.importCapabilities({ profileId: 'preview-agent', consent: false });
    expect(result.ok).toBe(false);
    expect(result.consentRequired).toBe(true);
    expect(result.autoImport).toBe(false);
    expect(result.receipt.status).toBe('preview');
    expect(result.receipt.processExecutedDuringImport).toBe(false);
    expect(fs.existsSync(path.join(root, 'skills', 'external-preview-agent'))).toBe(false);
  });

  it('imports with consent to SkillIR pack and appears in local search', () => {
    const gateway = new ZavorthExternalAgentGatewayService({
      projectRoot: root,
      registryFile: path.join(root, 'data', 'runtime', 'external-agent-profiles.json'),
    });
    registerProfile(gateway, 'import-me', 'mcp', ['tool_a', 'tool_b']);

    const svc = new ExternalAgentCapabilityImportService({
      projectRoot: root,
      gateway,
      fixtureCapabilities: {
        'import-me': [
          {
            id: 'tool_a',
            name: 'Tool A',
            toolName: 'tool_a',
            kind: 'tool',
            adapter: 'mcp',
            source: 'fixture',
            summary: 'fixture tool a',
          },
        ],
      },
    });

    const result = svc.importCapabilities({
      profileId: 'import-me',
      consent: true,
      skillId: 'external-import-me',
    });
    expect(result.ok).toBe(true);
    expect(result.receipt.status).toBe('applied');
    expect(result.receipt.liveInvokeStillApprovalGated).toBe(true);
    expect(result.receipt.processExecutedDuringImport).toBe(false);
    expect(result.receipt.skillIrDigest).toBeTruthy();

    const skillPath = path.join(root, 'skills', 'external-import-me');
    expect(fs.existsSync(path.join(skillPath, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillPath, 'skill.ir.json'))).toBe(true);
    expect(fs.existsSync(path.join(skillPath, 'ORIGIN.json'))).toBe(true);

    const skillMd = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf8');
    expect(skillMd).toMatch(/tool_a/);
    expect(skillMd).toMatch(/approval-gated/i);

    const index = new SkillSearchIndexService({
      projectRoot: root,
      skillsDir: path.join(root, 'skills'),
      skillSourcesPath: path.join(root, 'missing.json'),
      receiptsDir: path.join(root, 'receipts'),
    });
    const hits = index.search('tool_a', 20);
    expect(
      hits.some(
        (h) =>
          h.id === 'external-import-me' ||
          h.tools.includes('tool_a') ||
          (h.sourcePath && h.sourcePath.includes('external-import-me')),
      ),
    ).toBe(true);
  });

  it('gateway wrappers listCapabilities + importCapabilities', () => {
    const gateway = new ZavorthExternalAgentGatewayService({
      projectRoot: root,
      registryFile: path.join(root, 'data', 'runtime', 'external-agent-profiles.json'),
    });
    registerProfile(gateway, 'wrap-cli', 'cli', ['ping']);

    const listed = gateway.listCapabilities({ profileId: 'wrap-cli' });
    expect(listed.ok).toBe(true);
    expect(listed.capabilities.some((c) => c.id === 'ping')).toBe(true);

    const imported = gateway.importCapabilities({ profileId: 'wrap-cli', consent: true });
    expect(imported.ok).toBe(true);
    expect(imported.receipt.skillId).toMatch(/external-wrap-cli/);
  });

  it('reads capabilities file when present', () => {
    const gateway = new ZavorthExternalAgentGatewayService({
      projectRoot: root,
      registryFile: path.join(root, 'data', 'runtime', 'external-agent-profiles.json'),
    });
    registerProfile(gateway, 'file-caps', 'acp', ['base']);

    const capsFile = path.join(root, 'caps.json');
    fs.writeFileSync(
      capsFile,
      JSON.stringify({
        capabilities: [{ id: 'file_tool', name: 'From File', kind: 'tool', summary: 'from json' }],
      }),
      'utf8',
    );

    const svc = new ExternalAgentCapabilityImportService({ projectRoot: root, gateway });
    const listed = svc.listCapabilities({
      profileId: 'file-caps',
      capabilitiesFile: capsFile,
    });
    expect(listed.capabilities.some((c) => c.id === 'file_tool')).toBe(true);
    expect(listed.capabilities.some((c) => c.id === 'base')).toBe(true);
    expect(listed.processExecuted).toBe(false);
  });
});
