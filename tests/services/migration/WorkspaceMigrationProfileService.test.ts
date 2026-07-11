import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION,
} from '../../../src/contracts/migration/WorkspaceMigrationProfileContract.js';
import { WorkspaceMigrationProfileService } from '../../../src/services/migration/WorkspaceMigrationProfileService.js';
import { UniversalWorkspaceImportService } from '../../../src/services/UniversalWorkspaceImportService.js';

const FIXTURES = path.resolve(__dirname, '../../fixtures/migration-homes');

function fixture(name: 'openclaw-like' | 'hermes-like' | 'generic'): string {
  return path.join(FIXTURES, name);
}

describe('WorkspaceMigrationProfileService', () => {
  const fixedNow = () => new Date('2026-07-11T15:00:00.000Z');
  let service: WorkspaceMigrationProfileService;

  beforeEach(() => {
    service = new WorkspaceMigrationProfileService({
      projectRoot: os.tmpdir(),
      now: fixedNow,
    });
  });

  it('detects openclaw-like homes', () => {
    const home = fixture('openclaw-like');
    expect(fs.existsSync(path.join(home, '.openclaw'))).toBe(true);

    const result = service.detectProfile(home);
    expect(result.profileId).toBe('openclaw-home');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.signals.some((s) => s.id === 'openclaw_dot_dir' && s.present)).toBe(true);
  });

  it('detects hermes-like homes', () => {
    const home = fixture('hermes-like');
    expect(fs.existsSync(path.join(home, '.hermes'))).toBe(true);

    const result = service.detectProfile(home);
    expect(result.profileId).toBe('hermes-home');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.signals.some((s) => s.id === 'hermes_dot_dir' && s.present)).toBe(true);
  });

  it('falls back to generic-agent-home for identity + memory layout', () => {
    const home = fixture('generic');
    const result = service.detectProfile(home);
    expect(result.profileId).toBe('generic-agent-home');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.signals.some((s) => s.id === 'generic_identity_md' && s.present)).toBe(true);
    expect(result.signals.some((s) => s.id === 'generic_memory_dir' && s.present)).toBe(true);
  });

  it('report never includes raw secret content from .env fixtures', () => {
    const home = fixture('openclaw-like');
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
    // presence-only findings
    expect(
      report.findings.some(
        (f) => f.id === 'dotenv-present' || f.id === 'secret-like-items',
      ),
    ).toBe(true);
  });

  it('buildReport dry-run uses preview structural import snapshot', () => {
    const home = fixture('generic');
    const report = service.buildReport({ sourcePath: home, profile: 'generic' });

    expect(report.contractVersion).toBe(WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION);
    expect(report.profileId).toBe('generic-agent-home');
    expect(report.detectedProfileId).toBe('generic-agent-home');
    expect(report.safeToPreview).toBe(true);
    expect(report.applyBlockedWithoutConsent).toBe(true);
    expect(report.itemCounts.total).toBeGreaterThan(0);
    expect(report.summaryBullets.some((b) => /preview/i.test(b))).toBe(true);

    // Underlying structural import remains preview-only when not applying
    const importer = new UniversalWorkspaceImportService({
      projectRoot: os.tmpdir(),
      now: fixedNow,
    });
    const snap = importer.buildSnapshot({ sourcePath: home, apply: false });
    expect(snap.status).toBe('preview-only');
    expect(snap.summary.copied).toBe(0);
  });

  it('toProofEventInput never embeds secret values', () => {
    const home = fixture('openclaw-like');
    const report = service.buildReport({ sourcePath: home, profile: 'openclaw-home' });
    const event = service.toProofEventInput(report);
    const raw = JSON.stringify(event);

    expect(raw).not.toContain('secret123');
    expect(event.metadata?.secretLikePresent).toBe(true);
    expect(event.kind === 'system' || event.kind === 'marketplace').toBe(true);
    expect(event.source).toBe('workspace-migration-profile');
  });

  it('toMarkdown includes profile and next action', () => {
    const home = fixture('hermes-like');
    const report = service.buildReport({ sourcePath: home, profile: 'auto' });
    const md = service.toMarkdown(report);
    expect(md).toContain('# Workspace Migration Report');
    expect(md).toContain('hermes-home');
    expect(md).toContain('Next:');
  });

  it('does not invent files — missing path yields unknown', () => {
    const missing = path.join(os.tmpdir(), `zavorth-missing-home-${Date.now()}`);
    const result = service.detectProfile(missing);
    expect(result.profileId).toBe('unknown');
    expect(result.confidence).toBe(0);
  });
});
