import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthLearnSkillService } from '../../../src/services/ZavorthLearnSkillService.js';

function makeTempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('ZavorthLearnSkillService', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempRoot('zavorth-learn-skill-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('previews a local skill path without applying', async () => {
    const skillDir = path.join(root, 'pack');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: demo-learn\ndescription: demo learn skill\n---\n\n# Demo learn\n',
      'utf8',
    );

    const service = new ZavorthLearnSkillService({ projectRoot: root });
    const snap = await service.learn({
      source: skillDir,
      apply: false,
    });

    expect(snap.contractVersion).toBe('zavorth-learn-skill/1');
    expect(snap.status).toBe('preview');
    expect(snap.safety.quarantineRequired).toBe(true);
    expect(snap.safety.applyRequiresConsentOrApproval).toBe(true);
    expect(snap.fabric.summary.skills).toBeGreaterThanOrEqual(1);
    expect(snap.fabric.summary.materialized).toBe(0);
    expect(snap.commands.preview).toContain('learn-skill');
  });

  it('requires consent/approval before apply', async () => {
    const skillDir = path.join(root, 'pack');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: need-consent\ndescription: x\n---\n\n# X\n', 'utf8');

    const service = new ZavorthLearnSkillService({ projectRoot: root });
    const snap = await service.learn({
      source: skillDir,
      apply: true,
      consent: false,
    });

    expect(snap.status).toBe('approval-required');
    expect(snap.fabric.apply).toBe(false);
    expect(snap.fabric.summary.materialized).toBe(0);
  });

  it('blocks empty source', async () => {
    const service = new ZavorthLearnSkillService({ projectRoot: root });
    const snap = await service.learn({ source: '' });
    expect(snap.status).toBe('blocked');
  });

  it('does not live-extract URL without confirm flag', async () => {
    const service = new ZavorthLearnSkillService({
      projectRoot: root,
      searchFetch: {
        fetchAndExtract: jest.fn(async () => {
          throw new Error('should not be called');
        }),
      },
      fabric: {
        buildSnapshot: jest.fn(async () => ({
          contractVersion: 'zavorth-universal-capability-fabric/v1',
          generatedAt: '2026-07-12T00:00:00.000Z',
          status: 'preview-only',
          apply: false,
          source: {
            raw: 'https://example.com/skill',
            kind: 'https-url',
            label: 'example',
            resolvedLocalPath: path.join(root, 'stage'),
            remoteUrl: 'https://example.com/skill',
            contentHash: 'abc',
          },
          candidates: [{
            id: 'skill:example:0',
            kind: 'skill',
            name: 'example',
            title: 'skill · example',
            description: 'demo',
            relativeEntry: 'SKILL.md',
            trustState: 'quarantined',
            risk: 'low',
            reasons: ['skill-marker'],
            tags: ['skill'],
            executableCodeDetected: false,
            instructionOnly: true,
            targetDirHint: path.join(root, 'q'),
          }],
          issues: [],
          receipts: [],
          summary: {
            sources: 1,
            candidates: 1,
            skills: 1,
            plugins: 0,
            mcp: 0,
            unknown: 0,
            highRisk: 0,
            executableCode: 0,
            materialized: 0,
            denied: 0,
            heldForApproval: 1,
          },
          policy: {
            previewBeforeMutate: true,
            approvalRequiredForEnable: true,
            executablePluginsHigherTrust: true,
            mcpStartsDisabled: true,
            instructionSkillsDefault: true,
            catalogIsNotLive: true,
            rawSecretsSerialized: false,
            brandAgnostic: true,
          },
          quarantineRoot: path.join(root, '.zavorth', 'capability-quarantine'),
          narrative: {
            headline: 'preview',
            operatorSummary: 'ok',
            nextSafeAction: 'review',
          },
        })),
      },
    });

    const snap = await service.learn({
      source: 'https://example.com/skill',
      confirmLiveNetwork: false,
    });

    expect(snap.extract.performed).toBe(false);
    expect(snap.extract.reason).toMatch(/confirm-live-network/i);
    expect(snap.status).toBe('preview');
  });
});
