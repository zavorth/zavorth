import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthSkillLifecycleService } from '../../src/services/ZavorthSkillLifecycleService.js';

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-lifecycle-'));
}

describe('ZavorthSkillLifecycleService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a governed candidate with scan, sandbox smoke and approval receipt without materializing it', () => {
    const root = makeRoot();
    const lifecycle = new ZavorthSkillLifecycleService({
      projectRoot: root,
      now: () => new Date('2026-06-11T12:00:00.000Z'),
    });

    const snapshot = lifecycle.createCandidate({
      skillId: 'release-helper',
      name: 'Release Helper',
      summary: 'Prepares release notes from local repository evidence.',
      source: { kind: 'official', ref: 'release-helper' },
      dependencies: ['missing-dep-for-zavorth-test'],
      writeDraft: true,
    });

    expect(snapshot.lifecycleId).toMatch(/^skill-life-/u);
    expect(snapshot.skillId).toBe('release-helper');
    expect(snapshot.state).toBe('approval');
    expect(snapshot.scanResult.status).toBe('passed');
    expect(snapshot.sandboxSmokeResult.status).toBe('passed');
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.materializedPath).toBeNull();
    expect(snapshot.receipts.map((receipt) => receipt.action)).toEqual([
      'skill.lifecycle.draft',
      'skill.lifecycle.quarantine',
      'skill.lifecycle.scan',
      'skill.lifecycle.sandbox_smoke',
      'skill.install.candidate',
    ]);
    expect(fs.existsSync(path.join(root, '.zavorth', 'skills', 'quarantine', 'release-helper', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'skill-library', 'native', 'release-helper'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'node_modules', 'missing-dep-for-zavorth-test'))).toBe(false);
  });

  it('materializes only with an approval id and enables only after materialization', () => {
    const root = makeRoot();
    const lifecycle = new ZavorthSkillLifecycleService({
      projectRoot: root,
      now: () => new Date('2026-06-11T12:00:00.000Z'),
    });

    lifecycle.createCandidate({
      skillId: 'release-helper',
      name: 'Release Helper',
      summary: 'Prepares release notes from local repository evidence.',
      source: { kind: 'official', ref: 'release-helper' },
      writeDraft: true,
    });

    expect(lifecycle.canEnable('release-helper').ok).toBe(false);
    expect(lifecycle.canEnable('release-helper').reason).toContain('not materialized');
    expect(() => lifecycle.materialize('release-helper')).toThrow(/approval id/u);

    const materialized = lifecycle.materialize('release-helper', { approvalId: 'approval-123' });
    expect(materialized.state).toBe('materialize');
    expect(materialized.materializedPath).toContain(path.join('skill-library', 'native', 'release-helper'));

    const enabled = lifecycle.markEnabled('release-helper');
    expect(enabled.state).toBe('enable');
    expect(enabled.enabled).toBe(true);
    expect(lifecycle.canEnable('release-helper').ok).toBe(true);
  });
});
