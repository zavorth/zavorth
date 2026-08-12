import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthExternalAgentMigrationPackService } from '../../src/services/ZavorthExternalAgentMigrationPackService.js';

describe('ZavorthExternalAgentMigrationPackService', () => {
  it('asks for a user hint and never scans automatically', () => {
    const service = createService();
    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('needs-user-hint');
    expect(snapshot.onboarding.inspection.performed).toBe(false);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      dryRunDefault: true,
      noDotEnvRead: true,
      noRuntimeExecution: true,
      noNetworkProbe: true,
    }));
    expect(snapshot.receipt.guarantees.noExternalProcessStarted).toBe(true);
  });

  it('builds a dry-run migration plan from a consented folder', () => {
    const fixture = createFixture();
    const snapshot = createService().buildSnapshot({
      pathHint: fixture,
      consent: true,
      preset: 'full',
    });

    expect(snapshot.status).toBe('preview-ready');
    expect(snapshot.summary.skills).toBeGreaterThanOrEqual(1);
    expect(snapshot.summary.memory).toBeGreaterThanOrEqual(1);
    expect(snapshot.summary.persona).toBeGreaterThanOrEqual(1);
    expect(snapshot.summary.assetsWritten).toBe(0);
    expect(snapshot.assets.every((asset) => asset.status === 'planned' || asset.status === 'skipped')).toBe(true);
    expect(snapshot.registrationReceipts).toEqual([]);
  });

  it('blocks apply without an approval id', () => {
    const fixture = createFixture();
    const snapshot = createService().buildSnapshot({
      pathHint: fixture,
      consent: true,
      preset: 'full',
      apply: true,
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.summary.assetsWritten).toBe(0);
    expect(snapshot.rollback.available).toBe(false);
  });

  it('writes only approved migration drafts under the target root', () => {
    const fixture = createFixture();
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-migration-project-'));
    const targetRoot = path.join(projectRoot, 'data', 'migration-target');
    const snapshot = createService(projectRoot).buildSnapshot({
      pathHint: fixture,
      consent: true,
      preset: 'full',
      apply: true,
      approvalId: 'appr-migrate-1',
      targetRoot,
    });

    expect(['migrated', 'partial']).toContain(snapshot.status);
    expect(snapshot.summary.assetsWritten).toBeGreaterThan(0);
    expect(snapshot.rollback.available).toBe(true);
    expect(snapshot.rollback.affectedPaths.every((entry) => path.resolve(entry).startsWith(path.resolve(targetRoot)))).toBe(true);
    expect(snapshot.rollback.affectedPaths.some((entry) => fs.existsSync(entry))).toBe(true);
  });

  it('does not read dot env or serialize secret-like provider values', () => {
    const fixture = createFixture();
    fs.writeFileSync(path.join(fixture, '.env'), 'API_KEY=sk-live-secret-should-not-appear\n', 'utf8');
    fs.writeFileSync(path.join(fixture, 'provider-config.md'), 'API_KEY=sk-secret-like-value-123456789\n', 'utf8');

    const snapshot = createService().buildSnapshot({
      pathHint: fixture,
      consent: true,
      preset: 'full',
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.summary.skippedSecrets).toBeGreaterThanOrEqual(1);
    expect(serialized).not.toContain('sk-live-secret-should-not-appear');
    expect(serialized).not.toContain('sk-secret-like-value-123456789');
    expect(snapshot.assets.find((asset) => asset.sourcePath?.includes('.env'))).toBeUndefined();
    expect(snapshot.receipt.guarantees.rawSecretsSerialized).toBe(false);
  });

  it('can register the discovered candidate as a governed arm without invoking it', () => {
    const fixture = createFixture();
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-migration-register-project-'));
    const snapshot = createService(projectRoot).buildSnapshot({
      pathHint: fixture,
      consent: true,
      preset: 'capabilities',
      apply: true,
      approvalId: 'appr-register-1',
      registerAsArm: true,
      enableLive: false,
    });

    expect(snapshot.registrationReceipts).toHaveLength(1);
    expect(snapshot.registrationReceipts[0]).toEqual(expect.objectContaining({
      status: 'registered',
      execution: expect.objectContaining({
        adapterInvoked: false,
        liveExecutionPerformed: false,
      }),
      safety: expect.objectContaining({
        approvalRequired: true,
        profileOnlyNoDefaultBinding: true,
      }),
    }));
  });
});

function createService(projectRoot?: string): ZavorthExternalAgentMigrationPackService {
  return new ZavorthExternalAgentMigrationPackService({
    now: () => new Date('2026-05-18T13:00:00.000Z'),
    projectRoot: projectRoot || fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-migration-project-')),
  });
}

function createFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-migration-fixture-'));
  fs.mkdirSync(path.join(root, 'skills', 'writer'), { recursive: true });
  fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(root, 'agent'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'fixture-agent-runtime',
    keywords: ['agent', 'acp'],
    scripts: { start: 'node server.js' },
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'SOUL.md'), '# Persona\nUse concise answers.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'memory', 'MEMORY.md'), '# Memory\nUser prefers explicit approvals.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'skills', 'writer', 'SKILL.md'), '# Writer\nDraft clean docs.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'agent', 'run_agent.py'), 'print("agent fixture")\n', 'utf8');
  fs.writeFileSync(path.join(root, 'messaging-telegram.json'), '{"enabled":false}\n', 'utf8');
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Workspace instructions\nReview before action.\n', 'utf8');
  return root;
}
