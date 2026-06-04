import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

import type { ZavorthInnovationRadarSnapshot } from '../../src/contracts/ZavorthInnovationRadarContract.js';
import { ZavorthCapabilityCandidateRegistryService } from '../../src/services/ZavorthCapabilityCandidateRegistryService.js';
import { ZavorthInnovationRadarService } from '../../src/services/ZavorthInnovationRadarService.js';

describe('ZavorthCapabilityCandidateRegistryService', () => {
  it('registers only explicit new radar candidates and keeps the registry non-executing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-candidate-registry-'));
    const now = () => new Date('2026-06-02T12:00:00.000Z');
    const radar = await buildRadar(root, now);
    const service = new ZavorthCapabilityCandidateRegistryService({
      projectRoot: root,
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      now,
    });

    const snapshot = service.register({ radar, allNew: true, actor: 'jest' });

    expect(snapshot.surface).toBe('capability-candidate-registry');
    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.summary.observed).toBe(1);
    expect(snapshot.candidates[0]?.title).toBe('Trajectory-aware autonomous verifier');
    expect(snapshot.safety).toMatchObject({
      registrationExplicitOnly: true,
      knownCapabilitiesRejected: true,
      noPrototypeCreated: true,
      noCapabilityInstalled: true,
      noToolExposed: true,
      noLiveActivation: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(fs.existsSync(snapshot.storeFile)).toBe(true);
  });

  it('deduplicates radar evidence and enforces safe status transitions', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-candidate-dedupe-'));
    const now = () => new Date('2026-06-02T12:00:00.000Z');
    const radar = await buildRadar(root, now);
    const service = new ZavorthCapabilityCandidateRegistryService({
      projectRoot: root,
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      now,
    });
    const first = service.register({ radar, allNew: true, actor: 'jest' });
    const duplicate = service.register({ radar, allNew: true, actor: 'jest' });
    const id = first.candidates[0]?.id || '';
    const blocked = service.transition({ candidateId: id, to: 'prototype_ready', actor: 'jest' });
    const reviewed = service.transition({ candidateId: id, to: 'reviewed', actor: 'jest' });
    const ready = service.transition({ candidateId: id, to: 'prototype_ready', actor: 'jest' });

    expect(duplicate.summary.total).toBe(1);
    expect(duplicate.candidates[0]?.evidence).toHaveLength(1);
    expect(blocked.receipts.at(-1)?.status).toBe('blocked');
    expect(reviewed.candidates[0]?.status).toBe('reviewed');
    expect(ready.candidates[0]?.status).toBe('prototype_ready');
    expect(ready.candidates[0]?.nextSafeAction).toContain('sandbox prototype');
  });

  it('can register a selected candidate id without importing the full radar set', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-candidate-select-'));
    const now = () => new Date('2026-06-02T12:00:00.000Z');
    const radar = await new ZavorthInnovationRadarService({
      projectRoot: root,
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      now,
    }).run({
      signals: [
        { sourceId: 'a', title: 'Alpha native validator', summary: 'New alpha validation.', category: 'security' },
        { sourceId: 'b', title: 'Beta native compressor', summary: 'New beta compression.', category: 'memory' },
      ],
      persist: false,
    });
    const service = new ZavorthCapabilityCandidateRegistryService({
      projectRoot: root,
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      now,
    });
    const selectedId = radar.candidates.find((candidate) => candidate.title.includes('Beta'))?.id || '';
    const snapshot = service.register({ radar, candidateIds: [selectedId], actor: 'jest' });

    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.candidates[0]?.radarCandidateId).toBe(selectedId);
    expect(snapshot.candidates[0]?.title).toContain('Beta');
  });
});

async function buildRadar(root: string, now: () => Date): Promise<ZavorthInnovationRadarSnapshot> {
  return new ZavorthInnovationRadarService({
    projectRoot: root,
    env: { ZAVORTH_HOME: path.join(root, 'home') },
    now,
  }).run({
    signals: [
      {
        sourceId: 'known',
        title: 'Telegram',
        summary: 'Known channel signal.',
        category: 'channels',
      },
      {
        sourceId: 'new',
        title: 'Trajectory-aware autonomous verifier',
        summary: 'Reviews long-running task trajectories. token=secret-value',
        category: 'agent-runtime',
        tags: ['trajectory', 'verifier'],
      },
    ],
    persist: false,
  });
}
