import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SourceSurfaceLedgerDocument, SourceSurfaceLedgerEntry } from '../../src/contracts/SourceSurfaceLedgerContract.js';
import { SourceSurfaceLedgerService } from '../../src/services/SourceSurfaceLedgerService.js';
import { SourceSurfaceScannerService } from '../../src/services/SourceSurfaceScannerService.js';

describe('SourceSurfaceLedgerService Phase 0', () => {
  const now = () => new Date('2026-05-05T12:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let ledgerPath: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-source-ledger-'));
    sourceRoot = path.join(tempRoot, 'source');
    fs.mkdirSync(sourceRoot, { recursive: true });
    createFixtureSource(sourceRoot);
    ledgerPath = path.join(tempRoot, 'ledger.json');
    fs.writeFileSync(ledgerPath, JSON.stringify(createFixtureLedger(sourceRoot, tempRoot), null, 2));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('loads, validates and summarizes a surface ledger', () => {
    const service = new SourceSurfaceLedgerService({
      now,
      zavorthRoot: tempRoot,
      ledgerPath,
      sourceRoot,
    });
    const ledger = service.loadLedger();
    const issues = service.validateLedger(ledger);
    const summary = service.summarizeEntries(ledger.entries);

    expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
    expect(summary.total).toBe(20);
    expect(summary.byDecision).toEqual(
      expect.objectContaining({
        implemented: 1,
        replaced: 16,
        waived: 3,
        rejected: 0,
      }),
    );
    expect(summary.byCategory).toEqual(
      expect.objectContaining({
        native_app: 1,
        internal_package: 1,
        src_module: 1,
        runtime_dependency: 1,
      }),
    );
  });

  it('scans the Source checkout into ledger-compatible surfaces', () => {
    const scan = new SourceSurfaceScannerService().scan(sourceRoot);
    const paths = scan.discovered.map((surface) => `${surface.category}:${surface.sourcePath}`);

    expect(paths).toEqual(expect.arrayContaining([
      'root_directory:apps',
      'root_file:package.json',
      'native_app:apps/android',
      'internal_package:packages/sdk',
      'src_module:src/agents',
      'src_singleton_file:src/index.ts',
      'script_group:scripts/static-boundary-quality',
      'support_surface:qa/scenarios/agents',
      'dependency_patch:patches/@agentclientprotocol__claude-agent-acp@0.31.4.patch',
      'github_workflow:.github/workflows/ci.yml',
      'skill:skills/slack',
      'runtime_dependency:package.json#@anthropic-ai/sdk',
    ]));
    expect(scan.ignored).toContain('node_modules');
  });

  it('emits a passing receipt when every discovered surface has a decision', () => {
    const service = new SourceSurfaceLedgerService({
      now,
      zavorthRoot: tempRoot,
      ledgerPath,
      sourceRoot,
    });

    const receipt = service.buildReceipt();

    expect(receipt.status).toBe('passed');
    expect(receipt.contractVersion).toBe('2026-05-05.phase-0');
    expect(receipt.phase).toBe(0);
    expect(receipt.summary.total).toBe(20);
    expect(receipt.summary.unclassifiedSurfaces).toBe(0);
    expect(receipt.summary.validationErrors).toBe(0);
    expect(receipt.policy).toEqual(
      expect.objectContaining({
        noLiveProviderCalls: true,
        noLiveChannelSends: true,
        noFilesystemWritesToSource: true,
        failOnUnclassifiedSurfaces: true,
      }),
    );
    expect(receipt.commands.nextPhase).toBe('Phase 1 - Plugin OS And Package SDK Absorption');
  });

  it('fails the receipt when a new app or important runtime dependency is unclassified', () => {
    fs.mkdirSync(path.join(sourceRoot, 'apps', 'watchos'), { recursive: true });
    const packageJsonPath = path.join(sourceRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      dependencies: Record<string, string>;
    };
    packageJson.dependencies['@agentclientprotocol/claude-agent-acp'] = '0.1.0';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    const receipt = new SourceSurfaceLedgerService({
      now,
      zavorthRoot: tempRoot,
      ledgerPath,
      sourceRoot,
    }).buildReceipt();

    expect(receipt.status).toBe('failed');
    expect(receipt.summary.unclassifiedSurfaces).toBe(2);
    expect(receipt.drift.unclassified.map((item) => item.sourcePath)).toEqual(expect.arrayContaining([
      'apps/watchos',
      'package.json#@agentclientprotocol/claude-agent-acp',
    ]));
  });

  it('formats an operator report with drift and next phase context', () => {
    const service = new SourceSurfaceLedgerService({
      now,
      zavorthRoot: tempRoot,
      ledgerPath,
      sourceRoot,
    });
    const text = service.formatReceiptText();

    expect(text).toContain('Zavorth Source Surface Ledger - Phase 0');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Entries: 20');
    expect(text).toContain('Next: Phase 1 - Plugin OS And Package SDK Absorption');
  });
});

function createFixtureSource(sourceRoot: string): void {
  for (const directory of [
    'apps/android',
    'packages/sdk',
    'src/agents',
    'scripts',
    'qa/scenarios/agents',
    'patches',
    '.github/workflows',
    'skills/slack',
    'node_modules/cache',
  ]) {
    fs.mkdirSync(path.join(sourceRoot, directory), { recursive: true });
  }

  fs.writeFileSync(path.join(sourceRoot, 'src', 'agents', 'index.ts'), 'export {};\n');
  fs.writeFileSync(path.join(sourceRoot, 'src', 'index.ts'), 'export {};\n');
  fs.writeFileSync(path.join(sourceRoot, 'scripts', 'check-architecture-smells.mjs'), 'export {};\n');
  fs.writeFileSync(path.join(sourceRoot, 'qa', 'scenarios', 'agents', 'scenario.yml'), 'name: agents\n');
  fs.writeFileSync(path.join(sourceRoot, 'patches', '@agentclientprotocol__claude-agent-acp@0.31.4.patch'), 'patch\n');
  fs.writeFileSync(path.join(sourceRoot, '.github', 'workflows', 'ci.yml'), 'name: ci\n');
  fs.writeFileSync(path.join(sourceRoot, 'skills', 'slack', 'SKILL.md'), '# Slack\n');
  fs.writeFileSync(path.join(sourceRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@anthropic-ai/sdk': '0.1.0',
      '@slack/types': '2.0.0',
    },
  }, null, 2));
}

function createFixtureLedger(sourceRoot: string, zavorthRoot: string): SourceSurfaceLedgerDocument {
  const entries: SourceSurfaceLedgerEntry[] = [
    entry(1, 'root_directory', 'apps', 'replaced', 'P0', true),
    entry(2, 'root_directory', 'packages', 'replaced', 'P0', false),
    entry(3, 'root_directory', 'src', 'replaced', 'P0', false),
    entry(4, 'root_directory', 'scripts', 'replaced', 'P1', false),
    entry(5, 'root_directory', 'qa', 'replaced', 'P1', false),
    entry(6, 'root_directory', 'patches', 'waived', 'P0', true),
    entry(7, 'root_directory', '.github', 'waived', 'P0', true),
    entry(8, 'root_directory', 'skills', 'waived', 'P1', true),
    entry(9, 'root_file', 'package.json', 'replaced', 'P1', false),
    entry(10, 'native_app', 'apps/android', 'replaced', 'P0', true),
    entry(11, 'internal_package', 'packages/sdk', 'replaced', 'P0', false),
    entry(12, 'src_module', 'src/agents', 'replaced', 'P0', false),
    entry(13, 'src_singleton_file', 'src/index.ts', 'replaced', 'P1', false),
    entry(14, 'script_group', 'scripts/static-boundary-quality', 'replaced', 'P1', false),
    entry(15, 'support_surface', 'qa', 'replaced', 'P1', false),
    entry(16, 'support_surface', 'qa/scenarios/agents', 'replaced', 'P1', false),
    entry(17, 'dependency_patch', 'patches/@agentclientprotocol__claude-agent-acp@0.31.4.patch', 'replaced', 'P0', true),
    entry(18, 'github_workflow', '.github/workflows/ci.yml', 'replaced', 'P1', false),
    entry(19, 'skill', 'skills/slack', 'replaced', 'P2', false),
    entry(20, 'runtime_dependency', 'package.json#@anthropic-ai/sdk', 'implemented', 'P1', false),
  ];

  return {
    schemaVersion: 1,
    generatedAt: '2026-05-05T00:00:00.000Z',
    title: 'fixture ledger',
    privacy: 'private',
    sourceRoot,
    zavorthRoot,
    sourceReports: [],
    decisionEnum: ['implemented', 'replaced', 'waived', 'rejected'],
    decisionSemantics: {
      implemented: 'implemented',
      replaced: 'replaced',
      waived: 'waived',
      rejected: 'rejected',
    },
    summary: {
      total: entries.length,
      byDecision: {
        implemented: 1,
        replaced: 16,
        waived: 3,
        rejected: 0,
      },
      byCategory: {
        root_directory: 8,
        root_file: 1,
        native_app: 1,
        internal_package: 1,
        src_module: 1,
        src_singleton_file: 1,
        script_group: 1,
        support_surface: 2,
        dependency_patch: 1,
        github_workflow: 1,
        skill: 1,
        runtime_dependency: 1,
      },
      byPriority: {
        P0: 9,
        P1: 10,
        P2: 1,
      },
      ownerDecisionRequired: 6,
      provisional: 19,
    },
    entries,
  };
}

function entry(
  ordinal: number,
  category: SourceSurfaceLedgerEntry['category'],
  sourcePath: string,
  decision: SourceSurfaceLedgerEntry['decision'],
  priority: SourceSurfaceLedgerEntry['priority'],
  ownerDecisionRequired: boolean,
): SourceSurfaceLedgerEntry {
  return {
    id: `fixture-${String(ordinal).padStart(4, '0')}`,
    ordinal,
    category,
    sourcePath,
    item: sourcePath.split('/').at(-1) || sourcePath,
    decision,
    decisionFinality: decision === 'implemented' ? 'final' : 'provisional',
    ownerDecisionRequired,
    priority,
    coverageStatus: decision === 'implemented' ? 'already_implemented' : 'partial',
    zavorthDisposition: 'fixture disposition',
    zavorthEvidence: [],
    sourceEvidence: [],
    notes: '',
  };
}
