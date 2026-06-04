import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

import { ZavorthCapabilityAdapterDraftService } from '../../src/services/ZavorthCapabilityAdapterDraftService.js';
import { ZavorthCapabilityCandidateRegistryService } from '../../src/services/ZavorthCapabilityCandidateRegistryService.js';
import { ZavorthCapabilityPrototypeSandboxService } from '../../src/services/ZavorthCapabilityPrototypeSandboxService.js';
import { ZavorthInnovationRadarService } from '../../src/services/ZavorthInnovationRadarService.js';

describe('ZavorthCapabilityAdapterDraftService', () => {
  it('creates a disabled Zavorth-native adapter draft from a simulated prototype', async () => {
    const runtime = await buildPrototypeRuntime();
    const service = new ZavorthCapabilityAdapterDraftService(runtime);
    const snapshot = service.draft({ allPrototypes: true, actor: 'jest' });
    const adapter = snapshot.adapters[0];

    expect(snapshot.surface).toBe('capability-adapter-draft');
    expect(snapshot.summary.adapters).toBe(1);
    expect(adapter?.status).toBe('draft_ready');
    expect(adapter?.adapterKind).toBe('provider-adapter');
    expect(adapter?.manifest.defaultEnabled).toBe(false);
    expect(adapter?.manifest.liveAllowedByDefault).toBe(false);
    expect(adapter?.manifest.networkAccess).toBe('allowlist');
    expect(adapter?.manifest.requiredSecrets[0]).toContain('env:ZAVORTH_');
    expect(adapter?.manifest.approvalRequiredFor).toEqual(expect.arrayContaining(['activate-live', 'network-access']));
    expect(adapter?.lab.status).toBe('passed');
    expect(adapter?.artifacts.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'adapter-manifest',
      'adapter-policy',
      'adapter-tests',
      'capability-lab-report',
    ]));
    expect(fs.existsSync(path.join(adapter?.workspaceDir || '', 'adapter-manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(adapter?.workspaceDir || '', 'adapter-policy.json'))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(snapshot.safety).toMatchObject({
      simulatedPrototypesOnly: true,
      adapterDraftOnly: true,
      capabilityLabRequired: true,
      defaultEnabledFalse: true,
      liveAllowedByDefaultFalse: true,
      noCapabilityInstalled: true,
      noToolExposed: true,
      noLiveActivation: true,
    });
  });

  it('is idempotent for an existing adapter draft', async () => {
    const runtime = await buildPrototypeRuntime();
    const service = new ZavorthCapabilityAdapterDraftService(runtime);
    const first = service.draft({ allPrototypes: true, actor: 'jest' });
    const second = service.draft({ allPrototypes: true, actor: 'jest' });

    expect(first.summary.adapters).toBe(1);
    expect(second.summary.adapters).toBe(1);
    expect(second.receipts.at(-1)?.status).toBe('skipped');
    expect(second.receipts.at(-1)?.adapterDraftId).toBe(first.adapters[0]?.id);
  });

  it('does not draft adapters when no simulated prototypes are selected', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-adapter-empty-'));
    const service = new ZavorthCapabilityAdapterDraftService({
      projectRoot: root,
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });
    const snapshot = service.draft({ allPrototypes: true, actor: 'jest' });

    expect(snapshot.summary.adapters).toBe(0);
    expect(snapshot.receipts.at(-1)?.status).toBe('skipped');
  });
});

async function buildPrototypeRuntime(): Promise<{
  projectRoot: string;
  env: Record<string, string>;
  now: () => Date;
}> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-adapter-draft-'));
  const home = path.join(root, 'home');
  const now = () => new Date('2026-06-02T12:00:00.000Z');
  const env = { ZAVORTH_HOME: home };
  const radar = await new ZavorthInnovationRadarService({ projectRoot: root, env, now }).run({
    signals: [{
      sourceId: 'new',
      title: 'Zephyr quartz conduit',
      summary: 'Unlisted endpoint family for orbital planning. token=secret-value',
      category: 'providers',
      tags: ['zephyr', 'quartz'],
    }],
    persist: false,
  });
  const registry = new ZavorthCapabilityCandidateRegistryService({ projectRoot: root, env, now });
  const registered = registry.register({ radar, allNew: true, actor: 'jest' });
  const candidateId = registered.candidates[0]?.id || '';
  registry.transition({ candidateId, to: 'reviewed', actor: 'jest' });
  registry.transition({ candidateId, to: 'prototype_ready', actor: 'jest' });
  new ZavorthCapabilityPrototypeSandboxService({ projectRoot: root, env, now }).prototype({
    allReady: true,
    actor: 'jest',
  });
  return { projectRoot: root, env, now };
}
