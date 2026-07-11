import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { MemoryDraftStoreService } from '../../../src/services/MemoryDraftStoreService.js';
import { KillerMissionCatalogService } from '../../../src/services/KillerMissionCatalogService.js';
import { DailyReturnContinuityService } from '../../../src/services/DailyReturnContinuityService.js';
import { AgentSmartnessLiveService } from '../../../src/services/agent-smartness/AgentSmartnessLiveService.js';
import { buildContinuityBannerModel } from '../../../apps/zavorth-desktop/src/components/ContinuityBanner';
import {
  isDay1ReturnEligible,
  rememberDesktopSession,
  readRememberedDesktopSession,
} from '../../../apps/zavorth-desktop/src/desktop-state/continuityStorage';

describe('Value surfaces testability', () => {
  it('stores memory drafts without silent promote', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-drafts-'));
    const store = new MemoryDraftStoreService({ storePath: path.join(dir, 'drafts.json') });
    const created = store.addCandidates({
      userId: 'u1',
      candidates: [{ key: 'nome', value: 'Ada', category: 'pessoal' }],
    });
    expect(created).toHaveLength(1);
    expect(store.list('u1', 'pending')).toHaveLength(1);
    expect(store.promote(created[0].id)?.status).toBe('promoted');
    expect(store.list('u1', 'pending')).toHaveLength(0);
  });

  it('exposes three safe killer missions', () => {
    const missions = new KillerMissionCatalogService().list();
    expect(missions).toHaveLength(3);
    expect(missions.every((mission) => mission.mutatesFiles === false)).toBe(true);
  });

  it('marks live smartness blocked without credentials', async () => {
    const report = await new AgentSmartnessLiveService({
      projectRoot: process.cwd(),
      env: {},
    }).run({ live: true });
    expect(report.hermetic.ok).toBe(true);
    expect(report.live.every((entry) => entry.status === 'blocked' || entry.status === 'fail')).toBe(true);
    expect(report.live.some((entry) => entry.status === 'blocked')).toBe(true);
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
