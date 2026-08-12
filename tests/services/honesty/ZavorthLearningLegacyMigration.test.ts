import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  migrateLegacyLearningPreferencesToKnownUsers,
  readLegacyHostLearningPreferences,
} from '../../../src/services/ZavorthLearningLegacyMigration.js';
import { getProductSurfaceRuntime } from '../../../src/services/ZavorthProductSurfaceRuntimeService.js';
import { ZavorthLearningRuntimeHubService } from '../../../src/services/ZavorthLearningRuntimeHubService.js';
import { setLearningRuntimeMode } from '../../../src/services/ZavorthLearningRuntimePolicy.js';

jest.mock('../../../src/config/index.js', () => ({
  config: {
    allowedUserIds: ['op-111', 'op-222'],
    whatsappAllowedChatIds: ['wa-chat-1'],
    zavorthBridgePreferencesFile: path.join(os.tmpdir(), 'bridge-prefs-placeholder.json'),
    zavorthBridgePreferredModelDefault: null,
  },
}));

describe('ZavorthLearningLegacyMigration honesty', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-legacy-mig-'));
    setLearningRuntimeMode('autonomous', { projectRoot: tempDir, userId: 'local-user' });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('mass-migrates host-global prefs to all known operators', () => {
    const legacyPath = path.join(tempDir, 'data', 'runtime', 'learning', 'trusted-preferences.json');
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(legacyPath, `${JSON.stringify({
      version: 1,
      preferences: [{
        id: 'pref-legacy-1',
        summary: 'prefiro respostas curtas legadas',
        createdAt: new Date().toISOString(),
      }],
    }, null, 2)}\n`, 'utf8');

    const result = migrateLegacyLearningPreferencesToKnownUsers({
      projectRoot: tempDir,
      force: true,
    });

    expect(result.legacyCount).toBe(1);
    expect(result.migratedUsers).toEqual(expect.arrayContaining(['local-user', 'op-111', 'op-222', 'wa-chat-1']));
    expect(readLegacyHostLearningPreferences(tempDir)?.preferences?.length).toBe(1);

    for (const userId of ['local-user', 'op-111', 'op-222', 'wa-chat-1']) {
      const hub = new ZavorthLearningRuntimeHubService({ projectRoot: tempDir, userId });
      expect(hub.listLearned().some((item) => item.summary.includes('legadas'))).toBe(true);
    }

    // idempotent
    const second = migrateLegacyLearningPreferencesToKnownUsers({ projectRoot: tempDir });
    expect(second.alreadyDone).toBe(true);
  });

  it('product surface triggers migration and injects for telegram/whatsapp users', async () => {
    const legacyPath = path.join(tempDir, 'data', 'runtime', 'learning', 'trusted-preferences.json');
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(legacyPath, `${JSON.stringify({
      version: 1,
      preferences: [{
        id: 'pref-legacy-2',
        summary: 'prefiro bullets do legado',
        createdAt: new Date().toISOString(),
      }],
    }, null, 2)}\n`, 'utf8');

    const runtime = getProductSurfaceRuntime(tempDir);
    const injectTg = runtime.formatInjectBlocks({ userId: 'op-111' });
    expect(injectTg).toContain('prefiro bullets do legado');
    expect(injectTg).toContain('<learned_preferences');

    const injectWa = runtime.formatInjectBlocks({ userId: 'wa-chat-1' });
    expect(injectWa).toContain('prefiro bullets do legado');

    // telegram write gate: explicit allow
    const write = await runtime.recordSuccessfulTurn({
      surface: 'telegram',
      userId: 'op-111',
      chatId: 'op-111',
      userMessage: 'ok',
      assistantText: 'ok',
      allowLearningWrite: true,
    });
    expect(write.mode).toBeDefined();

    // whatsapp non-allowlisted chat skips durable write
    const blocked = await runtime.recordSuccessfulTurn({
      surface: 'whatsapp',
      userId: 'stranger',
      chatId: 'not-allowed',
      userMessage: 'oi',
      assistantText: 'ola',
      allowLearningWrite: null,
    });
    expect(blocked.mode).toBe('skipped-no-write-permission');

    // whatsapp allowlisted chat may write path
    const allowed = await runtime.recordSuccessfulTurn({
      surface: 'whatsapp',
      userId: 'wa-chat-1',
      chatId: 'wa-chat-1',
      userMessage: 'oi',
      assistantText: 'ola',
      allowLearningWrite: null,
    });
    expect(allowed.mode).not.toBe('skipped-no-write-permission');
  });
});
