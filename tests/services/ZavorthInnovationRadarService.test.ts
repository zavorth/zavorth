import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

import { ZavorthInnovationRadarService } from '../../src/services/ZavorthInnovationRadarService.js';

describe('ZavorthInnovationRadarService', () => {
  it('detects new market signals, recognizes known capabilities and persists only an observational report', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-innovation-radar-'));
    const home = path.join(root, 'home');
    const service = new ZavorthInnovationRadarService({
      projectRoot: root,
      env: { ZAVORTH_HOME: home },
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });
    const snapshot = await service.run({
      signals: [
        {
          sourceId: 'release-notes-a',
          title: 'Telegram',
          summary: 'Channel editing improvements.',
          category: 'channels',
        },
        {
          sourceId: 'release-notes-b',
          title: 'Trajectory-aware autonomous verifier',
          summary: 'A new agent verifier reviews long-running task trajectories without installing tools. token=secret-value',
          category: 'agent-runtime',
          tags: ['trajectory', 'verifier'],
        },
      ],
    });

    expect(snapshot.surface).toBe('innovation-radar');
    expect(snapshot.summary.newCandidates).toBe(1);
    expect(snapshot.summary.knownCandidates).toBe(1);
    expect(snapshot.safety).toMatchObject({
      observationOnly: true,
      noCapabilityRegistered: true,
      noCapabilityInstalled: true,
      noToolExposed: true,
      noLiveActivation: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(snapshot.reportFile).toBe(path.join(home, 'runtime', 'innovation-radar-last.json'));
    expect(fs.existsSync(snapshot.reportFile || '')).toBe(true);
  });

  it('reads allowlisted HTTPS feeds and blocks non-allowlisted or query-bearing feeds', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      signals: [{
        sourceId: 'feed-a',
        title: 'Temporal lattice quorum analyzer',
        summary: 'Correlates quasar epochs through merkle time windows.',
        category: 'security',
      }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const service = new ZavorthInnovationRadarService({
      projectRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-innovation-feed-')),
      env: {},
      fetchImpl,
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });
    const snapshot = await service.run({
      feedUrls: [
        'https://radar.example.com/signals.json',
        'https://blocked.example.com/signals.json',
        'https://radar.example.com/private.json?token=secret-value',
      ],
      allowedHosts: ['radar.example.com'],
      persist: false,
    });

    expect(snapshot.summary.sourcesRead).toBe(1);
    expect(snapshot.summary.sourcesBlocked).toBe(2);
    expect(snapshot.summary.newCandidates).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(snapshot.reportFile).toBeNull();
  });
});
