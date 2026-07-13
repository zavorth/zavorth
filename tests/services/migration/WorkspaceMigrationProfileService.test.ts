import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION,
} from '../../../src/contracts/migration/WorkspaceMigrationProfileContract.js';
import { WorkspaceMigrationProfileService } from '../../../src/services/migration/WorkspaceMigrationProfileService.js';
import { UniversalWorkspaceImportService } from '../../../src/services/UniversalWorkspaceImportService.js';

/**
 * Brand-agnostic fixtures — profile ids are only auto | agent-home | unknown.
 * Layout markers (IDENTITY/AGENTS/skills/memory) are structural, not product brands.
 */
function writeAgentHomeFixture(root: string, options: { withSecrets?: boolean } = {}): string {
  const home = path.join(root, `agent-home-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(path.join(home, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(home, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(home, 'AGENTS.md'), '# Agents\n', 'utf8');
  fs.writeFileSync(path.join(home, 'IDENTITY.md'), '# Identity\n', 'utf8');
  fs.writeFileSync(path.join(home, 'memory', 'notes.md'), 'notes\n', 'utf8');
  fs.writeFileSync(path.join(home, 'skills', 'README.md'), 'skill pack\n', 'utf8');
  if (options.withSecrets) {
    fs.writeFileSync(
      path.join(home, '.env'),
      'api_key=secret123\nTOKEN=should-never-appear-in-report\n',
      'utf8',
    );
  }
  return home;
}

describe('WorkspaceMigrationProfileService', () => {
  const fixedNow = () => new Date('2026-07-11T15:00:00.000Z');
  let service: WorkspaceMigrationProfileService;
  let tempRoot: string;
  const homes: string[] = [];

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-migration-'));
    service = new WorkspaceMigrationProfileService({
      projectRoot: tempRoot,
      now: fixedNow,
    });
  });

  afterEach(() => {
    for (const home of homes.splice(0)) {
      try {
        fs.rmSync(home, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function fixture(withSecrets = false): string {
    const home = writeAgentHomeFixture(tempRoot, { withSecrets });
    homes.push(home);
    return home;
  }

  it('detects structural agent-home from AGENTS.md + skills + memory', () => {
    const home = fixture();
    const result = service.detectProfile(home);
    expect(result.profileId).toBe('agent-home');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.signals.some((s) => s.id === 'agents_md' && s.present)).toBe(true);
    expect(result.signals.some((s) => s.id === 'skills_dir' && s.present)).toBe(true);
    expect(result.signals.some((s) => s.id === 'memory_dir' && s.present)).toBe(true);
  });

  it('falls back to agent-home or unknown for partial identity layout', () => {
    const home = path.join(tempRoot, 'partial');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'IDENTITY.md'), '# Identity\n', 'utf8');
    homes.push(home);

    const result = service.detectProfile(home);
    expect(['agent-home', 'unknown']).toContain(result.profileId);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.signals.some((s) => s.id === 'identity_md' && s.present)).toBe(true);
  });

  it('report never includes raw secret content from .env fixtures', () => {
    const home = fixture(true);
    const envRaw = fs.readFileSync(path.join(home, '.env'), 'utf8');
    expect(envRaw).toContain('secret123');

    const report = service.buildReport({ sourcePath: home, profile: 'auto' });
    const serialized = JSON.stringify(report);
    const markdown = service.toMarkdown(report);

    expect(serialized).not.toContain('secret123');
    expect(serialized).not.toContain('should-never-appear-in-report');
    expect(markdown).not.toContain('secret123');
    expect(markdown).not.toContain('api_key=secret123');
    expect(report.secretLikePresent).toBe(true);
    expect(report.findings.some((f) => f.secretLike)).toBe(true);
    expect(
      report.findings.some(
        (f) => f.id === 'dotenv-present' || f.id === 'secret-like-items',
      ),
    ).toBe(true);
  });

  it('buildReport dry-run uses preview structural import snapshot', () => {
    const home = fixture();
    const report = service.buildReport({ sourcePath: home, profile: 'generic' });

    expect(report.contractVersion).toBe(WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION);
    expect(report.profileId).toBe('agent-home');
    expect(report.detectedProfileId).toBe('agent-home');
    expect(report.safeToPreview).toBe(true);
    expect(report.applyBlockedWithoutConsent).toBe(true);
    expect(report.itemCounts.total).toBeGreaterThan(0);
    expect(report.summaryBullets.some((b) => /preview/i.test(b))).toBe(true);

    const importer = new UniversalWorkspaceImportService({
      projectRoot: tempRoot,
      now: fixedNow,
    });
    const snap = importer.buildSnapshot({ sourcePath: home, apply: false });
    expect(snap.status).toBe('preview-only');
    expect(snap.summary.copied).toBe(0);
  });

  it('toProofEventInput never embeds secret values', () => {
    const home = fixture(true);
    const report = service.buildReport({ sourcePath: home, profile: 'agent-home' });
    const event = service.toProofEventInput(report);
    const raw = JSON.stringify(event);

    expect(raw).not.toContain('secret123');
    expect(event.metadata?.secretLikePresent).toBe(true);
    expect(event.kind === 'system' || event.kind === 'marketplace').toBe(true);
    expect(event.source).toBe('workspace-migration-profile');
  });

  it('toMarkdown includes profile and next action', () => {
    const home = fixture();
    const report = service.buildReport({ sourcePath: home, profile: 'auto' });
    const md = service.toMarkdown(report);
    expect(md).toContain('# Workspace Migration Report');
    expect(md).toMatch(/agent-home|unknown/);
    expect(md).toContain('Next:');
  });

  it('does not invent files — missing path yields unknown', () => {
    const missing = path.join(os.tmpdir(), `zavorth-missing-home-${Date.now()}`);
    const result = service.detectProfile(missing);
    expect(result.profileId).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('forced profile agent-home matches detection without mismatch finding', () => {
    const home = fixture();
    const report = service.buildReport({ sourcePath: home, profile: 'agent-home' });

    expect(report.profileId).toBe('agent-home');
    expect(report.detectedProfileId).toBe('agent-home');
    expect(report.findings.some((f) => f.id === 'forced-profile-mismatch')).toBe(false);
    expect(report.safeToPreview).toBe(true);
    expect(report.applyBlockedWithoutConsent).toBe(true);
  });

  it('buildReport never applies / remains dry-run even with secret-like present', () => {
    const home = fixture(true);
    const report = service.buildReport({ sourcePath: home, profile: 'auto' });
    expect(report.applyBlockedWithoutConsent).toBe(true);
    expect(report.safeToPreview).toBe(true);
    const body = JSON.stringify(report) + service.toMarkdown(report);
    expect(body).not.toContain('secret123');
    expect(body).not.toContain('should-never-appear-in-report');
  });
});
