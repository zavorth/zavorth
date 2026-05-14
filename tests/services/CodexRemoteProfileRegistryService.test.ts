import fs from 'fs';
import path from 'path';
import os from 'os';
import { CodexRemoteProfileRegistryService } from '../../src/services/CodexRemoteProfileRegistryService';
import { config } from '../../src/config/index.js';

describe('CodexRemoteProfileRegistryService', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-codex-remote-profiles-'));
  const stateFilePath = path.join(tempDir, 'codex-remote-profiles.json');

  afterEach(() => {
    try {
      fs.rmSync(stateFilePath, { force: true });
    } catch {
      // noop
    }
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  });

  it('builds the default profile from the host Codex CLI config', () => {
    const service = new CodexRemoteProfileRegistryService({
      stateFilePath,
      now: () => new Date('2026-04-07T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.activeProfileId).toBe('default');
    expect(snapshot.health).toEqual(
      expect.objectContaining({
        status: 'healthy',
        activeProfileId: 'default',
        profileCount: 0,
      }),
    );
    expect(snapshot.readiness).toEqual(
      expect.objectContaining({
        ready: true,
        status: 'ready',
        resolvedProfileId: 'default',
        recommendedAction: 'none',
      }),
    );
    expect(snapshot.profiles[0]).toEqual(
      expect.objectContaining({
        id: 'default',
        label: 'Default Codex',
        codexCliPath: config.codexCliPath,
        enabled: true,
        active: true,
      }),
    );
  });

  it('persists and resolves a stored active profile', () => {
    fs.writeFileSync(
      stateFilePath,
      JSON.stringify(
        {
          activeProfileId: 'work',
          profiles: [
            {
              id: 'work',
              label: 'Work Codex',
              description: 'Conta de trabalho',
              codexCliPath: 'C:\\Codex\\work\\codex.exe',
              codexHome: 'C:\\Users\\ermys\\.codex-work',
              workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
              enabled: true,
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const service = new CodexRemoteProfileRegistryService({
      stateFilePath,
      now: () => new Date('2026-04-07T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();
    const profile = service.resolveExecutionProfile();

    expect(snapshot.activeProfileId).toBe('work');
    expect(profile).toEqual(
      expect.objectContaining({
        id: 'work',
        label: 'Work Codex',
        codexHome: 'C:\\Users\\ermys\\.codex-work',
        active: true,
        source: 'stored',
      }),
    );
  });

  it('supports safe profile upsert, list, select, and delete helpers', () => {
    const service = new CodexRemoteProfileRegistryService({
      stateFilePath,
      now: () => new Date('2026-04-07T12:00:00.000Z'),
    });

    const upserted = service.upsertProfile({
      id: 'work',
      label: 'Work Codex',
      description: 'Conta de trabalho',
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      enabled: true,
    });

    expect(upserted).toEqual(
      expect.objectContaining({
        id: 'work',
        label: 'Work Codex',
        enabled: true,
        source: 'stored',
      }),
    );
    expect(service.getProfile('work')).toEqual(
      expect.objectContaining({
        id: 'work',
        label: 'Work Codex',
      }),
    );
    expect(service.listStoredProfiles()).toHaveLength(1);
    expect(service.listProfiles().map((profile) => profile.id)).toEqual(['default', 'work']);

    const selected = service.selectProfile('work');
    expect(selected.active).toBe(true);

    const deleted = service.deleteProfile('work');
    expect(deleted).toBe(true);
    expect(service.getProfile('work')).toBeNull();
    expect(service.listStoredProfiles()).toHaveLength(0);
    expect(service.buildSnapshot().activeProfileId).toBe('default');
  });

  it('reports health and readiness metadata for invalid persisted state', () => {
    fs.writeFileSync(
      stateFilePath,
      JSON.stringify(
        {
          activeProfileId: 'missing-profile',
          profiles: [
            {
              id: 'work',
              label: 'Work Codex',
              enabled: true,
            },
            {
              id: 'work',
              label: 'Duplicate Work Codex',
              enabled: false,
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const service = new CodexRemoteProfileRegistryService({
      stateFilePath,
      now: () => new Date('2026-04-07T12:00:00.000Z'),
    });

    const health = service.buildHealthSnapshot();
    const readiness = service.buildReadinessSnapshot('missing-profile');

    expect(health.status).toBe('degraded');
    expect(health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'profile-duplicate',
        }),
        expect.objectContaining({
          code: 'active-profile-missing',
          profileId: 'missing-profile',
        }),
      ]),
    );
    expect(readiness.ready).toBe(false);
    expect(readiness.status).toBe('degraded');
    expect(readiness.recommendedAction).toBe('select-profile');
  });
});
