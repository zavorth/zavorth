import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildLearnedKnowledgeAdvanced,
  writeDreamLastPreview,
  readDreamLastPreview,
  scanVaultInventory,
} from '../../../src/services/learned-knowledge/index.js';

describe('LearnedKnowledgeAdvanced', () => {
  let tmp: string;
  const prevVault = process.env.MNEMOS_VAULT_DIR;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-advanced-'));
    delete process.env.MNEMOS_VAULT_DIR;
    delete process.env.ZAVORTH_MNEMOS_VAULT;
    delete process.env.ZAVORTH_MNEMOS_VAULT_DIR;
  });

  afterEach(() => {
    if (prevVault === undefined) delete process.env.MNEMOS_VAULT_DIR;
    else process.env.MNEMOS_VAULT_DIR = prevVault;
    delete process.env.ZAVORTH_MNEMOS_VAULT;
    delete process.env.ZAVORTH_MNEMOS_VAULT_DIR;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('reports vault missing and dream preview always available', () => {
    const status = buildLearnedKnowledgeAdvanced({ projectRoot: tmp });
    expect(status.fileIndex.available).toBe(false);
    expect(status.fileIndex.vaultPath).toBeNull();
    expect(status.fileIndex.fileCount).toBeNull();
    expect(status.fileIndex.dockerConsentPath).toMatch(/enable_mnemos|PlanMnemosScope|mnemos_vault|plan_mnemos/i);
    expect(status.fileIndex.cli).toBeTruthy();
    expect(status.fileIndex.summary).toMatch(/not found|enable_mnemos|vault/i);
    expect(status.fileIndex.setupHint).toBeTruthy();

    expect(status.dreamCycle.available).toBe(true);
    expect(status.dreamCycle.previewOnly).toBe(true);
    expect(status.dreamCycle.cli).toMatch(/knowledge consolidate/);
    expect(status.dreamCycle.slash).toMatch(/consolidate/);
    expect(status.dreamCycle.schedulerCli).toMatch(/mnemos:dream-cycle/);
    expect(status.dreamCycle.lastRunAt).toBeNull();
    expect(status.dreamCycle.nextEligibleHint).toBeTruthy();
    expect(status.preferenceSpineNote).toMatch(/Workflows|spine|preference/i);
  });

  it('detects vault and reports file metrics', () => {
    const vault = path.join(tmp, 'data', 'mnemos_vault');
    fs.mkdirSync(vault, { recursive: true });
    fs.writeFileSync(path.join(vault, 'note.txt'), 'hello vault', 'utf8');
    fs.mkdirSync(path.join(vault, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(vault, 'nested', 'a.md'), '# a', 'utf8');

    const inv = scanVaultInventory(vault);
    expect(inv.fileCount).toBeGreaterThanOrEqual(2);
    expect(inv.directoryCount).toBeGreaterThanOrEqual(1);
    expect(inv.lastModifiedAt).toBeTruthy();

    const status = buildLearnedKnowledgeAdvanced({ projectRoot: tmp });
    expect(status.fileIndex.available).toBe(true);
    // Public path is project-relative (no absolute host path leak).
    expect(status.fileIndex.vaultPath).toBe('data/mnemos_vault');
    expect(status.fileIndex.fileCount).toBeGreaterThanOrEqual(2);
    expect(status.fileIndex.summary).toMatch(/present|file/i);
    expect(status.fileIndex.summary).not.toMatch(/^[A-Za-z]:\\/);
  });

  it('prefers MNEMOS_VAULT_DIR when it exists (public path sanitized)', () => {
    const custom = path.join(tmp, 'custom-vault');
    fs.mkdirSync(custom, { recursive: true });
    process.env.MNEMOS_VAULT_DIR = custom;
    const status = buildLearnedKnowledgeAdvanced({ projectRoot: tmp });
    expect(status.fileIndex.available).toBe(true);
    expect(status.fileIndex.vaultPath).toBe('custom-vault');
  });

  it('does not leak absolute paths for vault outside project root', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-vault-out-'));
    fs.writeFileSync(path.join(outside, 'x.txt'), 'x', 'utf8');
    process.env.MNEMOS_VAULT_DIR = outside;
    const status = buildLearnedKnowledgeAdvanced({ projectRoot: tmp });
    expect(status.fileIndex.available).toBe(true);
    expect(status.fileIndex.vaultPath).toMatch(/^\(external\)\//);
    expect(status.fileIndex.vaultPath).not.toContain(outside);
    try {
      fs.rmSync(outside, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('surfaces dream last-run from preview receipt', () => {
    writeDreamLastPreview(tmp, {
      generatedAt: '2026-07-01T12:00:00.000Z',
      candidateCount: 3,
      quarantineCount: 1,
      actionCount: 2,
      dreamStatus: 'needs-review',
    });
    const read = readDreamLastPreview(tmp);
    expect(read?.candidateCount).toBe(3);
    expect(read?.mode).toBe('preview');

    const status = buildLearnedKnowledgeAdvanced({ projectRoot: tmp });
    expect(status.dreamCycle.lastRunAt).toBe('2026-07-01T12:00:00.000Z');
    expect(status.dreamCycle.lastCandidateCount).toBe(3);
    expect(status.dreamCycle.lastQuarantineCount).toBe(1);
    expect(status.dreamCycle.lastStatus).toBe('needs-review');
    expect(status.dreamCycle.lastRunMode).toBe('preview');
    expect(status.dreamCycle.summary).toMatch(/last preview|candidates=3/i);
  });

  it('mentions wiki absence in dream summary when missing', () => {
    const status = buildLearnedKnowledgeAdvanced({ projectRoot: tmp });
    expect(status.dreamCycle.summary).toMatch(/preview|wiki/i);
  });
});
