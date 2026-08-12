import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

import { ZavorthActionGateway } from '../../src/runtime/actions/ZavorthActionGateway.js';
import { ZavorthCapabilityActionExposureService } from '../../src/services/ZavorthCapabilityActionExposureService.js';
import { ZavorthCapabilityAdapterDraftService } from '../../src/services/ZavorthCapabilityAdapterDraftService.js';
import { ZavorthCapabilityAdapterVerificationService } from '../../src/services/ZavorthCapabilityAdapterVerificationService.js';
import { ZavorthCapabilityCandidateRegistryService } from '../../src/services/ZavorthCapabilityCandidateRegistryService.js';
import { ZavorthCapabilityPrototypeSandboxService } from '../../src/services/ZavorthCapabilityPrototypeSandboxService.js';
import { ZavorthInnovationRadarService } from '../../src/services/ZavorthInnovationRadarService.js';

describe('ZavorthCapabilityActionExposureService', () => {
  it('previews verified capability action exposure without writing the exposure store', async () => {
    const runtime = await buildVerifiedRuntime();
    const service = new ZavorthCapabilityActionExposureService(runtime);
    const preview = service.preview({ allVerified: true, actor: 'jest' });

    expect(preview.selected).toBe(1);
    expect(preview.plannedActions[0]?.actionId).toMatch(/^capability\.candidate\./);
    expect(preview.plannedActions[0]?.requiresPreview).toBe(true);
    expect(preview.plannedActions[0]?.requiresApproval).toBe(true);
    expect(fs.existsSync(path.join(runtime.projectRoot, 'runtime', 'capability-action-exposures.json'))).toBe(false);
  });

  it('exposes only verified adapter candidates as governed Action Harness candidates', async () => {
    const runtime = await buildVerifiedRuntime();
    const service = new ZavorthCapabilityActionExposureService(runtime);
    const snapshot = service.expose({ allVerified: true, actor: 'jest' });
    const exposure = snapshot.exposures[0];

    expect(snapshot.surface).toBe('capability-action-exposure');
    expect(snapshot.summary.exposures).toBe(1);
    expect(exposure?.status).toBe('exposed');
    expect(exposure?.manifest.liveActivationAllowed).toBe(false);
    expect(exposure?.manifest.toolExecutionAllowed).toBe(false);
    expect(exposure?.artifacts.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'action-manifest',
      'action-policy',
      'source-verification',
    ]));
    expect(fs.existsSync(path.join(exposure?.workspaceDir || '', 'action-manifest.json'))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(snapshot.safety).toMatchObject({
      verifiedAdaptersOnly: true,
      actionHarnessOnly: true,
      previewRequired: true,
      approvalRequired: true,
      noToolExecution: true,
      noLiveActivation: true,
      noNetworkUsed: true,
    });
  });

  it('is visible through the Action Harness lookup but blocks live execution', async () => {
    const runtime = await buildVerifiedRuntime();
    const exposure = new ZavorthCapabilityActionExposureService(runtime).expose({ allVerified: true, actor: 'jest' }).exposures[0];
    const gateway = new ZavorthActionGateway({ root: runtime.projectRoot });

    const lookup = gateway.lookup({ query: 'Zephyr quartz conduit', limit: 5 });
    expect(lookup.map((entry) => entry.actionId)).toContain(exposure?.actionId);

    const preview = await gateway.preview(exposure?.actionId || '');
    expect(preview.status).toBe('preview');
    expect(preview.summary).toContain('not live-activated');

    const apply = await gateway.apply(exposure?.actionId || '', {}, {
      trustedOperatorConfirmation: true,
      actorId: 'operator',
      sourceSurface: 'test',
    });
    expect(apply.status).toBe('blocked');
    expect(apply.summary).toContain('cannot execute yet');
  });

  it('does not expose blocked verification records', async () => {
    const runtime = await buildDraftRuntime();
    const adapterSnapshot = new ZavorthCapabilityAdapterDraftService(runtime).snapshot();
    const adapter = adapterSnapshot.adapters[0];
    const manifest = adapter?.artifacts.find((entry) => entry.kind === 'adapter-manifest');
    fs.appendFileSync(manifest?.path || '', '\ntoken=secret-value\n', 'utf8');
    new ZavorthCapabilityAdapterVerificationService(runtime).verify({ allAdapters: true, actor: 'jest' });

    const service = new ZavorthCapabilityActionExposureService(runtime);
    const snapshot = service.expose({ allVerified: true, actor: 'jest' });

    expect(snapshot.summary.exposures).toBe(0);
    expect(snapshot.receipts.at(-1)?.status).toBe('skipped');
  });

  it('routes exposure through the canonical Action Harness action', async () => {
    const runtime = await buildVerifiedRuntime();
    const gateway = new ZavorthActionGateway({ root: runtime.projectRoot });

    const preview = await gateway.preview('capabilities.verified.expose', { allVerified: true });
    expect(preview.status).toBe('preview');
    expect((preview.data?.preview as { selected?: number } | undefined)?.selected).toBe(1);

    const applied = await gateway.apply('capabilities.verified.expose', { allVerified: true }, {
      trustedOperatorConfirmation: true,
      actorId: 'operator',
      sourceSurface: 'test',
    });
    expect(applied.status).toBe('applied');
    expect((applied.data?.snapshot as { summary?: { exposures?: number } } | undefined)?.summary?.exposures).toBe(1);
  });
});

async function buildVerifiedRuntime(): Promise<{
  projectRoot: string;
  env: Record<string, string | undefined>;
  now: () => Date;
}> {
  const runtime = await buildDraftRuntime();
  new ZavorthCapabilityAdapterVerificationService(runtime).verify({
    allAdapters: true,
    actor: 'jest',
  });
  return runtime;
}

async function buildDraftRuntime(): Promise<{
  projectRoot: string;
  env: Record<string, string | undefined>;
  now: () => Date;
}> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-action-exposure-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'capability-action-exposure-test' }));
  const now = () => new Date('2026-06-02T12:00:00.000Z');
  const env: Record<string, string | undefined> = {};
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
