import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

import { ZavorthCapabilityCandidateRegistryService } from '../../src/services/ZavorthCapabilityCandidateRegistryService.js';
import { ZavorthCapabilityPrototypeSandboxService } from '../../src/services/ZavorthCapabilityPrototypeSandboxService.js';
import { ZavorthInnovationRadarService } from '../../src/services/ZavorthInnovationRadarService.js';

describe('ZavorthCapabilityPrototypeSandboxService', () => {
  it('creates preview-only sandbox artifacts only for prototype_ready candidates', async () => {
    const runtime = await buildReadyCandidateRuntime();
    const service = new ZavorthCapabilityPrototypeSandboxService(runtime);
    const snapshot = service.prototype({ allReady: true, actor: 'jest' });
    const prototype = snapshot.prototypes[0];

    expect(snapshot.surface).toBe('capability-prototype-sandbox');
    expect(snapshot.summary.prototypes).toBe(1);
    expect(prototype?.candidateId).toBe(runtime.readyCandidateId);
    expect(prototype?.status).toBe('simulated');
    expect(prototype?.sandboxReceipt.backend).toBe('preview-only');
    expect(prototype?.sandboxReceipt.safety.previewOnlyFallback).toBe(true);
    expect(prototype?.workspaceDir.startsWith(path.join(runtime.home, 'runtime', 'capability-prototypes'))).toBe(true);
    expect(fs.existsSync(path.join(prototype?.workspaceDir || '', 'prototype-manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(prototype?.workspaceDir || '', 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(prototype?.workspaceDir || '', 'sandbox-receipt.json'))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(snapshot.safety).toMatchObject({
      prototypeReadyCandidatesOnly: true,
      sandboxWorkspaceOnly: true,
      hostWorkspaceUntouched: true,
      noCapabilityInstalled: true,
      noToolExposed: true,
      noLiveActivation: true,
    });
  });

  it('is idempotent and records skipped receipts for existing prototypes', async () => {
    const runtime = await buildReadyCandidateRuntime();
    const service = new ZavorthCapabilityPrototypeSandboxService(runtime);
    const first = service.prototype({ allReady: true, actor: 'jest' });
    const second = service.prototype({ allReady: true, actor: 'jest' });

    expect(first.summary.prototypes).toBe(1);
    expect(second.summary.prototypes).toBe(1);
    expect(second.receipts.at(-1)?.status).toBe('skipped');
    expect(second.receipts.at(-1)?.prototypeId).toBe(first.prototypes[0]?.id);
  });

  it('does not prototype observed or reviewed candidates', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-prototype-not-ready-'));
    const home = path.join(root, 'home');
    const now = () => new Date('2026-06-02T12:00:00.000Z');
    const env = { ZAVORTH_HOME: home };
    const radar = await new ZavorthInnovationRadarService({ projectRoot: root, env, now }).run({
      signals: [{ sourceId: 'new', title: 'Interstellar reef mapping engine', summary: 'Maps coral nebula lattices for imaginary observatories.', category: 'unknown' }],
      persist: false,
    });
    const registry = new ZavorthCapabilityCandidateRegistryService({ projectRoot: root, env, now });
    const candidates = registry.register({ radar, allNew: true, actor: 'jest' });
    const service = new ZavorthCapabilityPrototypeSandboxService({ projectRoot: root, env, now });
    const snapshot = service.prototype({ allReady: true, actor: 'jest' });

    expect(candidates.summary.observed).toBe(1);
    expect(snapshot.summary.prototypes).toBe(0);
    expect(snapshot.receipts.at(-1)?.status).toBe('skipped');
  });
});

async function buildReadyCandidateRuntime(): Promise<{
  projectRoot: string;
  env: Record<string, string>;
  now: () => Date;
  home: string;
  readyCandidateId: string;
}> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-prototype-ready-'));
  const home = path.join(root, 'home');
  const now = () => new Date('2026-06-02T12:00:00.000Z');
  const env = { ZAVORTH_HOME: home };
  const radar = await new ZavorthInnovationRadarService({ projectRoot: root, env, now }).run({
    signals: [
      { sourceId: 'known', title: 'Telegram', summary: 'Known channel.', category: 'channels' },
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
  const registry = new ZavorthCapabilityCandidateRegistryService({ projectRoot: root, env, now });
  const registered = registry.register({ radar, allNew: true, actor: 'jest' });
  const candidateId = registered.candidates[0]?.id || '';
  registry.transition({ candidateId, to: 'reviewed', actor: 'jest' });
  const ready = registry.transition({ candidateId, to: 'prototype_ready', actor: 'jest' });
  return {
    projectRoot: root,
    env,
    now,
    home,
    readyCandidateId: ready.candidates[0]?.id || '',
  };
}
