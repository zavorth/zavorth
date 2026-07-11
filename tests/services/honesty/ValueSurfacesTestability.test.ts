import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { MemoryDraftStoreService } from '../../../src/services/MemoryDraftStoreService.js';
import { MemoryService } from '../../../src/services/MemoryService.js';
import { KillerMissionCatalogService } from '../../../src/services/KillerMissionCatalogService.js';
import { DailyReturnContinuityService } from '../../../src/services/DailyReturnContinuityService.js';
import { AgentSmartnessLiveService } from '../../../src/services/agent-smartness/AgentSmartnessLiveService.js';
import { buildContinuityBannerModel } from '../../../apps/zavorth-desktop/src/components/ContinuityBanner';
import {
  isDay1ReturnEligible,
  rememberDesktopSession,
  readRememberedDesktopSession,
} from '../../../apps/zavorth-desktop/src/desktop-state/continuityStorage';
import { Database } from '../../../src/storage/Database.js';
import { config } from '../../../src/config/index.js';

describe('Value surfaces testability', () => {
  it('keeps provider selection copy neutral across control-shell mirrors', () => {
    const mirrors = [
      'apps/zavorth-control-vite-shell/public/scripts/pages.js',
      'assets/zavorth-control/scripts/pages.js',
      'assets/command-center/scripts/pages.js',
      'src/zavorth-control/public/zavorth-control-vite-shell/scripts/pages.js',
      'src/ai-gateway/public/zavorth-control-vite-shell/scripts/pages.js',
    ];

    for (const relativePath of mirrors) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
      expect(source).not.toContain('Auto / Gemini');
      expect(source).not.toContain('Show Gemini provider');
      expect(source).toContain('Configured route');
    }
  });

  it('stores memory drafts without silent promote and blocks cross-user promote', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-drafts-'));
    const store = new MemoryDraftStoreService({ storePath: path.join(dir, 'drafts.json') });
    const created = store.addCandidates({
      userId: 'u1',
      candidates: [{ key: 'nome', value: 'Ada', category: 'pessoal' }],
    });
    expect(created).toHaveLength(1);
    expect(store.list('u1', 'pending')).toHaveLength(1);
    expect(store.promote(created[0].id, { actorUserId: 'other' })).toBeNull();
    expect(store.list('u1', 'pending')).toHaveLength(1);
    expect(store.promote(created[0].id, { actorUserId: 'u1' })?.status).toBe('promoted');
    expect(store.list('u1', 'pending')).toHaveLength(0);
  });

  it('routes draft promote through MemoryService.promoteMemoryDraft', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mdraft-svc-'));
    const originalDbPath = config.dbPath;
    const originalDbEncryptionKey = config.dbEncryptionKey;
    (config as any).dbPath = path.join(dir, 'memory.db');
    (config as any).dbEncryptionKey = 'value-draft-test-key';
    try {
      ((Database as any).instance as Database | null)?.close?.();
      (Database as any).instance = null;
      const store = new MemoryDraftStoreService({ storePath: path.join(dir, 'drafts.json') });
      const memory = new MemoryService({ draftStore: store });
      const extract = await memory.autoExtract(
        'u-honest',
        'Meu nome e Ada e prefiro dark mode.',
        'Ok.',
      );
      expect(extract.mode).toBe('draft-only');
      expect(extract.persisted).toBe(false);
      const draft = memory.listMemoryDrafts('u-honest')[0];
      expect(draft).toBeTruthy();
      expect(await memory.recall('u-honest', draft.key)).toBeNull();
      const promoted = await memory.promoteMemoryDraft(draft.id, { actorUserId: 'u-honest' });
      expect(promoted?.status).toBe('promoted');
      expect(await memory.recall('u-honest', draft.key)).toBeTruthy();
      await memory.forget('u-honest', draft.key).catch(() => false);
    } finally {
      ((Database as any).instance as Database | null)?.close?.();
      (Database as any).instance = null;
      (config as any).dbPath = originalDbPath;
      (config as any).dbEncryptionKey = originalDbEncryptionKey;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exposes three safe killer missions', () => {
    const missions = new KillerMissionCatalogService().list();
    expect(missions).toHaveLength(3);
    expect(missions.every((mission) => mission.mutatesFiles === false)).toBe(true);
  });

  it('marks live smartness blocked without credentials and never fakes multi-step pass', async () => {
    const report = await new AgentSmartnessLiveService({
      projectRoot: process.cwd(),
      env: {},
    }).run({ live: true });
    expect(report.hermeticOk).toBe(true);
    expect(report.liveOk).toBe(false);
    expect(report.multiStepOk).toBe(false);
    expect(report.claimsLiveIntelligence).toBe(false);
    expect(report.live.every((entry) => entry.status === 'blocked' || entry.status === 'fail')).toBe(true);
    expect(report.live.some((entry) => entry.status === 'blocked')).toBe(true);
    const multi = report.live.find((entry) => entry.id === 'live.multi-step.tool-plan');
    expect(multi?.status).not.toBe('pass');
  });

  it('builds desktop continuity banner models', () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    };
    rememberDesktopSession({ id: 'sess-1', title: 'Yesterday work' }, fakeStorage);
    const remembered = readRememberedDesktopSession(fakeStorage);
    expect(remembered.id).toBe('sess-1');
    const model = buildContinuityBannerModel({
      pendingApprovals: 0,
      providerReady: true,
      lastSessionId: remembered.id,
      lastSessionTitle: remembered.title,
      day1ReturnEligible: true,
    });
    expect(model?.kind).toBe('continue-session');
    expect(isDay1ReturnEligible('2026-07-10T09:00:00.000Z', '2026-07-11T10:00:00.000Z')).toBe(true);
    expect(new DailyReturnContinuityService().buildSnapshot({
      previousOpenAt: '2026-07-10T09:00:00.000Z',
      currentOpenAt: '2026-07-11T10:00:00.000Z',
      providerReady: true,
      sessions: [{ id: 's1', updatedAt: '2026-07-10T20:00:00.000Z' }],
    }).day1ReturnEligible).toBe(true);
  });
});
