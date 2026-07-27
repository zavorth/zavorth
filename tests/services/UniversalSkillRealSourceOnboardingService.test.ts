import fs from 'fs';
import os from 'os';
import path from 'path';
import { UniversalSkillRealSourceOnboardingService } from '../../src/services/UniversalSkillRealSourceOnboardingService.js';

function writeSkill(root: string, input: {
  dirName: string;
  name: string;
  description: string;
  body-: string;
}): void {
  const dir = path.join(root, input.dirName);
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), [
    '---',
    `name: ${input.name}`,
    `description: ${input.description}`,
    'license: MIT',
    '---',
    '',
    `# ${input.name}`,
    '',
    input.body || input.description,
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(dir, 'references', 'notes.md'), '# Notes\n', 'utf8');
}

describe('UniversalSkillRealSourceOnboardingService Dashboard controls', () => {
  let root: string;
  let skillLibrary: string;
  let cleanSource: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-real-source-onboarding-'));
    skillLibrary = path.join(root, 'skill-library');
    cleanSource = path.join(root, 'clean-source');
    fs.mkdirSync(skillLibrary, { recursive: true });
    fs.mkdirSync(cleanSource, { recursive: true });

    // Write a mock skill-sources.json enabling workspace-imported-library
    const configDir = path.join(root, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'skill-sources.json'),
      JSON.stringify({
        version: 1,
        updatedAt: '2026-05-10T20:00:00.000Z',
        sources: [
          {
            id: 'workspace-library',
            label: 'Workspace skill library',
            kind: 'workspace',
            trust: 'trusted',
            enabled: true,
            ingestionMode: 'local-scan',
            path: 'skill-library',
            createIfMissing: true,
            ownership: 'workspace',
            registrySource: 'zavorth:local-workspace',
          },
          {
            id: 'workspace-imported-library',
            label: 'Workspace imported skill library',
            kind: 'workspace',
            trust: 'review',
            enabled: true,
            ingestionMode: 'local-scan',
            path: 'skill-library/imported',
            createIfMissing: false,
            ownership: 'curated-import',
            registrySource: 'zavorth:curated-import',
          },
        ],
      }),
      'utf8'
    );

    fs.writeFileSync(
      path.join(configDir, 'skill-allowlist.json'),
      JSON.stringify({
        version: 1,
        updatedAt: '2026-05-10T20:00:00.000Z',
        defaultPolicy: 'deny',
        allowedSourceIds: ['workspace-library', 'workspace-imported-library'],
        rules: [
          {
            sourceId: 'workspace-library',
            mode: 'all',
            reason: 'Local library.',
          },
          {
            sourceId: 'workspace-imported-library',
            mode: 'all',
            reason: 'Test: promote imported skills for bridge-ready validation.',
          },
        ],
      }),
      'utf8'
    );

    writeSkill(skillLibrary, {
      dirName: 'research-pack',
      name: 'research-pack',
      description: 'Research local documents and produce evidence notes.',
    });
    writeSkill(cleanSource, {
      dirName: 'research-pack',
      name: 'research-pack',
      description: 'Research local documents and produce evidence notes.',
    });
    writeSkill(cleanSource, {
      dirName: 'writing-pack',
      name: 'writing-pack',
      description: 'Draft concise operator updates from trusted notes.',
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('discovers real workspace sources and persists aggregate history', async () => {
    const snapshot = await new UniversalSkillRealSourceOnboardingService({
      now: () => new Date('2026-05-10T20:00:00.000Z'),
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      channel: 'telegram',
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.sources.summary.includedInQa).toBeGreaterThanOrEqual(1);
    expect(snapshot.sources.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourcePath: skillLibrary,
        selected: true,
        includedInQa: true,
      }),
    ]));
    expect(snapshot.history.persisted).toBe(true);
    expect(snapshot.history.path && fs.existsSync(snapshot.history.path)).toBe(true);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      historyContainsAggregateOnly: true,
      noExecutionPerformed: true,
      noRawSecretsSerialized: true,
    }));
  });

  it('records limited apply as a continuous baseline without executing upstream runtime', async () => {
    const snapshot = await new UniversalSkillRealSourceOnboardingService({
      now: () => new Date('2026-05-10T20:00:00.000Z'),
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: cleanSource, presetId: 'generic-skill-folder' }],
      discover: false,
      apply: true,
      allowSource: true,
      allowAllCandidates: true,
      channel: 'discord',
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.mode).toBe('apply-requested');
    expect(snapshot.qa.expansion.summary).toEqual(expect.objectContaining({
      materialized: 2,
      bridgeReady: 2,
      executionPerformed: false,
      directUpstreamRuntimeUse: false,
    }));
    expect(snapshot.history.currentEntry).toEqual(expect.objectContaining({
      materialized: 2,
      bridgeReady: 2,
    }));
    expect(snapshot.rollout.recommendedCadence).toBe('per-source-change');
  });

  it('detects regressions against previous aggregate history', async () => {
    const historyPath = path.join(root, '.zavorth', 'reports', 'history.json');
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, JSON.stringify({
      contractVersion: '2026-05-10.checkpoint-8',
      updatedAt: '2026-05-10T19:00:00.000Z',
      entries: [{
        runId: 'previous',
        generatedAt: '2026-05-10T19:00:00.000Z',
        status: 'passed',
        qaStatus: 'passed',
        candidateSourceCount: 1,
        selectedSourceCount: 1,
        includedSourceCount: 1,
        candidates: 9,
        materialized: 4,
        bridgeReady: 4,
        blockedCandidates: 0,
        denied: 0,
        recommendedMode: 'dry-run-rollout',
      }],
    }, null, 2), 'utf8');

    const snapshot = await new UniversalSkillRealSourceOnboardingService({
      now: () => new Date('2026-05-10T20:00:00.000Z'),
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: cleanSource }],
      discover: false,
      historyPath,
    });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.regression.baselineAvailable).toBe(true);
    expect(snapshot.regression.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'candidate-count-drop', severity: 'warning' }),
      expect.objectContaining({ id: 'bridge-ready-drop', severity: 'warning' }),
    ]));
    expect(snapshot.history.entries).toHaveLength(2);
  });

  it('blocks missing explicit sources instead of masking them as healthy', async () => {
    const snapshot = await new UniversalSkillRealSourceOnboardingService({
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: path.join(root, 'missing-source') }],
      discover: false,
      persistReport: false,
      persistHistory: false,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.sources.summary).toEqual(expect.objectContaining({
      selected: 1,
      includedInQa: 0,
      missingSelected: 1,
    }));
    expect(snapshot.regression.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'missing-selected-source', severity: 'critical' }),
    ]));
  });
});
