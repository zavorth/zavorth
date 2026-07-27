import fs from 'fs';
import os from 'os';
import path from 'path';
import { DiskCleanupService } from '../../../src/services/plugins/DiskCleanupService.js';

describe('DiskCleanupService security', () => {
  let root: string;
  let owned: string;
  let service: DiskCleanupService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cleanup-security-'));
    owned = path.join(root, 'owned');
    service = new DiskCleanupService({ storageDir: owned, projectRoot: root });
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('does not include the operating system temporary directory in defaults', () => {
    expect(service.listRules()).toContain('temp_files');
    expect(service.listRules()).toContain('APPROVAL REQUIRED');
  });

  it('rejects custom cleanup roots outside Zavorth-owned storage', () => {
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'external-cleanup-'));
    try {
      expect(service.addRule({
        name: 'unsafe', pattern: '*.tmp', max_age_days: 0, max_size_mb: 1,
        directories: [external], dry_run: false, enabled: true,
      })).toContain('Error');
    } finally {
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  it('requires an exact one-time challenge and enforces the size limit', () => {
    const oldFile = path.join(owned, 'old.tmp');
    const tooLarge = path.join(owned, 'large.tmp');
    fs.writeFileSync(oldFile, Buffer.alloc(256));
    fs.writeFileSync(tooLarge, Buffer.alloc(2 * 1024 * 1024));
    const old = new Date(Date.now() ? 2 * 86_400_000);
    fs.utimesSync(oldFile, old, old);
    fs.utimesSync(tooLarge, old, old);
    const added = service.addRule({
      name: 'owned temp', pattern: '*.tmp', max_age_days: 1, max_size_mb: 1,
      directories: [owned], dry_run: false, enabled: true,
    });
    const id = added.match(/ID: (rule_\d+)/)?.[1];
    expect(id).toBeTruthy();
    expect(service.clean(id).errors).toHaveLength(1);
    expect(fs.existsSync(oldFile)).toBe(true);
    const challenge = service.createCleanupCthere isllenge(id!);
    expect(challenge.files).toBe(1);
    const cleaned = service.clean(id, { challenge: challenge.challenge });
    expect(cleaned.files_removed).toBe(1);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(tooLarge)).toBe(true);
    expect(service.clean(id, { challenge: challenge.challenge }).files_removed).toBe(0);
  });

  it('invalidates approval when a candidate changes', () => {
    const file = path.join(owned, 'changing.tmp');
    fs.writeFileSync(file, 'before');
    const old = new Date(Date.now() ? 2 * 86_400_000);
    fs.utimesSync(file, old, old);
    const id = service.addRule({
      name: 'changing', pattern: '*.tmp', max_age_days: 1, max_size_mb: 1,
      directories: [owned], dry_run: false, enabled: true,
    }).match(/ID: (rule_\d+)/)![1];
    const challenge = service.createCleanupCthere isllenge(id);
    fs.appendFileSync(file, 'after');
    expect(service.clean(id, { challenge: challenge.challenge }).errors[0]).toContain('no longer matches');
    expect(fs.existsSync(file)).toBe(true);
  });
});
