import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthHomePathService } from '../../src/services/ZavorthHomePathService.js';

describe('ZavorthHomePathService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-home-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('honors explicit home over env and fallback while resolving isolated paths', () => {
    const explicit = path.join(root, 'explicit-home');
    const envHome = path.join(root, 'env-home');
    const service = new ZavorthHomePathService({
      projectRoot: root,
      explicitHome: explicit,
      env: { ZAVORTH_HOME: envHome },
      now: () => new Date('2026-05-31T12:00:00.000Z'),
    });

    const snapshot = service.resolveSnapshot();

    expect(snapshot.source).toBe('explicit');
    expect(snapshot.root).toBe(path.resolve(explicit));
    expect(snapshot.isolated).toBe(true);
    expect(snapshot.resolvedPaths.dataDir).toBe(path.join(explicit, 'data'));
    expect(snapshot.resolvedPaths.dbPath).toBe(path.join(explicit, 'data', 'zavorth.db'));
    expect(snapshot.safety.preventsPathTraversal).toBe(true);
  });

  it('previews migration without writes and applies only with approval id', () => {
    const home = path.join(root, 'home');
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'secret-token.json'), '{"token":"abc"}', 'utf8');

    const service = new ZavorthHomePathService({
      projectRoot: root,
      env: { ZAVORTH_HOME: home },
      now: () => new Date('2026-05-31T12:00:00.000Z'),
    });

    const preview = service.buildMigrationPreview();
    const blocked = service.applyMigration();
    const applied = service.applyMigration({ approvalId: 'approval-home-1' });

    expect(preview.migration.status).toBe('preview');
    expect(preview.migration.entries.some((entry) => entry.redactedSource.includes('secret-token'))).toBe(false);
    expect(fs.existsSync(path.join(home, 'data', 'secret-token.json'))).toBe(true);
    expect(blocked.migration.status).toBe('blocked');
    expect(applied.migration.status).toBe('applied');
    expect(applied.migration.approvalId).toBe('approval-home-1');
  });

  it('rolls back copied migration data only with approval id', () => {
    const home = path.join(root, 'home');
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'state.json'), '{"ok":true}', 'utf8');

    const service = new ZavorthHomePathService({
      projectRoot: root,
      env: { ZAVORTH_HOME: home },
    });

    service.applyMigration({ approvalId: 'approval-home-apply' });
    const blocked = service.rollbackMigration();
    const rolledBack = service.rollbackMigration({ approvalId: 'approval-home-rollback' });

    expect(blocked.migration.status).toBe('blocked');
    expect(rolledBack.migration.status).toBe('rolled_back');
    expect(fs.existsSync(path.join(home, 'data', 'state.json'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'data', 'state.json'))).toBe(true);
  });

  it('exposes daily-use commands for setup, switch, migration and rollback', () => {
    const home = path.join(root, 'daily-home');
    const snapshot = new ZavorthHomePathService({
      projectRoot: root,
      explicitHome: home,
      env: {},
    }).resolveSnapshot();

    expect(snapshot.dailyUse.setupPrompt).toContain('Where should Zavorth store');
    expect(snapshot.dailyUse.statusCommand).toBe('zavorth home status');
    expect(snapshot.dailyUse.switchCommand).toContain('zavorth home switch --home');
    expect(snapshot.dailyUse.migrateApplyCommand).toContain('--approval-id');
    expect(snapshot.dailyUse.rollbackCommand).toContain('--rollback');
  });

  it('falls back to project root for compatibility when no home is configured', () => {
    const snapshot = new ZavorthHomePathService({
      projectRoot: root,
      env: {},
    }).resolveSnapshot();

    expect(snapshot.source).toBe('compat');
    expect(snapshot.root).toBe(path.resolve(root));
    expect(snapshot.isolated).toBe(false);
    expect(snapshot.safety.compatibleFallback).toBe(true);
  });
});
