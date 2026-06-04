import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

import { ZavorthCapabilityAdapterDraftService } from '../../src/services/ZavorthCapabilityAdapterDraftService.js';
import { ZavorthCapabilityAdapterVerificationService } from '../../src/services/ZavorthCapabilityAdapterVerificationService.js';
import { ZavorthCapabilityCandidateRegistryService } from '../../src/services/ZavorthCapabilityCandidateRegistryService.js';
import { ZavorthCapabilityPrototypeSandboxService } from '../../src/services/ZavorthCapabilityPrototypeSandboxService.js';
import { ZavorthInnovationRadarService } from '../../src/services/ZavorthInnovationRadarService.js';

describe('ZavorthCapabilityAdapterVerificationService', () => {
  it('verifies a draft-ready adapter with deterministic eval, local canary and security checks', async () => {
    const runtime = await buildAdapterRuntime();
    const service = new ZavorthCapabilityAdapterVerificationService(runtime);
    const snapshot = service.verify({ allAdapters: true, actor: 'jest' });
    const verification = snapshot.verifications[0];

    expect(snapshot.surface).toBe('capability-adapter-verification');
    expect(snapshot.summary.verifications).toBe(1);
    expect(verification?.status).toBe('verified');
    expect(verification?.checks.some((entry) => entry.kind === 'eval')).toBe(true);
    expect(verification?.checks.some((entry) => entry.kind === 'canary')).toBe(true);
    expect(verification?.checks.some((entry) => entry.kind === 'security')).toBe(true);
    expect(verification?.score.blocked).toBe(0);
    expect(verification?.artifacts.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'verification-report',
      'eval-report',
      'canary-report',
      'security-report',
    ]));
    expect(fs.existsSync(path.join(verification?.workspaceDir || '', 'verification-report.json'))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(snapshot.safety).toMatchObject({
      draftReadyAdaptersOnly: true,
      deterministicEvalOnly: true,
      localCanaryOnly: true,
      securityChecksRequired: true,
      noNetworkUsed: true,
      noActionHarnessExposure: true,
      noLiveActivation: true,
    });
  });

  it('is idempotent for an existing adapter verification', async () => {
    const runtime = await buildAdapterRuntime();
    const service = new ZavorthCapabilityAdapterVerificationService(runtime);
    const first = service.verify({ allAdapters: true, actor: 'jest' });
    const second = service.verify({ allAdapters: true, actor: 'jest' });

    expect(first.summary.verifications).toBe(1);
    expect(second.summary.verifications).toBe(1);
    expect(second.receipts.at(-1)?.status).toBe('skipped');
    expect(second.receipts.at(-1)?.verificationId).toBe(first.verifications[0]?.id);
  });

  it('blocks verification when a generated adapter artifact was modified with raw secret content', async () => {
    const runtime = await buildAdapterRuntime();
    const adapterSnapshot = new ZavorthCapabilityAdapterDraftService(runtime).snapshot();
    const adapter = adapterSnapshot.adapters[0];
    const manifest = adapter?.artifacts.find((entry) => entry.kind === 'adapter-manifest');
    expect(manifest).toBeDefined();
    fs.appendFileSync(manifest?.path || '', '\ntoken=secret-value\n', 'utf8');

    const service = new ZavorthCapabilityAdapterVerificationService(runtime);
    const snapshot = service.verify({ allAdapters: true, actor: 'jest' });
    const verification = snapshot.verifications[0];

    expect(verification?.status).toBe('blocked');
    expect(verification?.checks.some((entry) => entry.id === 'security.raw-secret-scan' && entry.status === 'blocked')).toBe(true);
    expect(verification?.checks.some((entry) => entry.id === 'eval.artifact.adapter-manifest' && entry.status === 'blocked')).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
  });

  it('does not verify adapters when no draft-ready adapter is selected', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-verification-empty-'));
    const service = new ZavorthCapabilityAdapterVerificationService({
      projectRoot: root,
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });
    const snapshot = service.verify({ allAdapters: true, actor: 'jest' });

    expect(snapshot.summary.verifications).toBe(0);
    expect(snapshot.receipts.at(-1)?.status).toBe('skipped');
  });
});

async function buildAdapterRuntime(): Promise<{
  projectRoot: string;
  env: Record<string, string>;
  now: () => Date;
}> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-adapter-verification-'));
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
  new ZavorthCapabilityAdapterDraftService({ projectRoot: root, env, now }).draft({
    allPrototypes: true,
    actor: 'jest',
  });
  return { projectRoot: root, env, now };
}
