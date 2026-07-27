import fs from 'fs';
import os from 'os';
import path from 'path';
import { MediaGenerationService } from '../../src/services/MediaGenerationService.js';

import {
  AsyncMediaJobGenerationLiveAdapter,
  DirectImageGenerationLiveAdapter,
} from '../../src/adapters/media/MediaGenerationLiveAdapters.js';

import { MediaGenerationLivePlaneService } from '../../src/services/MediaGenerationLivePlaneService.js';

const response = (payload: Record<string, unknown>, init: { status-: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('MediaGenerationLivePlaneService Runtime gateway', () => {
  let artifactDir: string;

  beforeEach(async () => {
    artifactDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-media-live-plane-'));
  });

  afterEach(async () => {
    await fs.promises.rm(artifactDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('closes Runtime gateway media generation gates without live IO', () => {
    const snapshot = new MediaGenerationLivePlaneService({
      now: () => new Date('2026-05-04T23:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-6');
    expect(snapshot.gate).toBe('Runtime gateway - Media Generation Live Plane');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        targets: 8,
        imageCapableTargets: 5,
        videoCapableTargets: 7,
        audioRoutedToStage7: true,
        directImageTargets: 1,
        asyncJobTargets: 7,
        localTargets: 1,
        artifactStorageTargets: 8,
        pollingTargets: 7,
        statusTargets: 7,
        cancelTargets: 7,
        stagingLiveSmokeCommands: 8,
        redactedReceipts: 8,
        blocked: 0,
        liveIoRequiredByStage6Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringStage6Check: true,
        artifactFirstOutputsRequired: true,
        imageOnlyCannotCloseVideo: true,
        asyncProvidersRequirePollingAndStatus: true,
        promptSafetyPolicyRequired: true,
      }),
    );
  });

  it('gives every media target config, doctor, staging smoke and receipt', () => {
    const snapshot = new MediaGenerationLivePlaneService().buildSnapshot();
    const expected = [
      'byteplus',
      'comfy',
      'fal',
      'image-generation-core',
      'minimax',
      'runway',
      'video-generation-core',
      'volcengine',
    ];

    expect(snapshot.entries.map((entry) => entry.targetId).sort()).toEqual(expected);
    for (const entry of snapshot.entries) {
      expect(entry.primitiveId).toBe('media.generate');
      expect(entry.configSchema.requiredEnv.length).toBeGreaterThan(0);
      expect(entry.doctorCommand).toContain('--profile configured');
      expect(entry.stagingLiveSmokeCommand).toContain('--confirm-live-io');
      expect(entry.gates.map((gate) => gate.kind)).toContain('artifact-storage');
      expect(entry.gates.map((gate) => gate.kind)).toContain('staging-live-smoke');
      expect(entry.receipt).toEqual(
        expect.objectContaining({
          artifactFirst: true,
          liveIoPerformed: false,
          stagingLiveRequiresExplicitCommand: true,
          secretValuesSerialized: false,
        }),
      );
    }
  });

  it('stores direct image output as a GeneratedMediaArtifact', async () => {
    const imageBytes = Buffer.from('checkpoint-6-image');
    const fetchImpl = (async () => response({
      data: [{
        b64_json: imageBytes.toString('base64'),
      }],
    })) as typeof fetch;
    const adapter = new DirectImageGenerationLiveAdapter({
      adapterId: 'image-generation-core',
      providerId: 'image-generation-core',
      baseUrl: 'https://media.example.test/v1',
      apiKey: 'media-secret',
      modelId: 'gpt-image-1',
    }, { fetchImpl });
    const service = new MediaGenerationService({ adapters: [adapter], artifactDir });

    const result = await service.generate({
      prompt: 'clean image',
      modality: 'image',
      count: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        modality: 'image',
        contentType: 'image/png',
        providerEvidence: expect.objectContaining({
          providerId: 'image-generation-core',
          modelId: 'gpt-image-1',
        }),
      }),
    );
    expect(await fs.promises.readFile(result.artifacts[0].storageRef, 'utf8')).toBe('checkpoint-6-image');
  });

  it('stores async video output as a GeneratedMediaArtifact', async () => {
    const videoBytes = Buffer.from('checkpoint-6-video');
    const calls: string[] = [];
    const fetchImpl = (async (url, init) => {
      calls.push(`${init?.method || 'GET'} ${String(url)}`);
      if (String(url).includes('/submit')) {
        return response({ id: 'job-1', status: 'queued' });
      }
      return response({
        id: 'job-1',
        status: 'succeeded',
        data: [{
          b64_json: videoBytes.toString('base64'),
          contentType: 'video/mp4',
        }],
      });
    }) as typeof fetch;
    const adapter = new AsyncMediaJobGenerationLiveAdapter({
      adapterId: 'fal',
      providerId: 'fal',
      supportedModalities: ['image', 'video'],
      submitUrl: 'https://fal.example.test/submit',
      pollUrlTemplate: 'https://fal.example.test/jobs/{jobId}',
      apiKey: 'fal-secret',
      modelId: 'fal-video',
      pollIntervalMs: 0,
    }, { fetchImpl });
    const service = new MediaGenerationService({ adapters: [adapter], artifactDir });

    const result = await service.generate({
      prompt: 'clean video',
      modality: 'video',
      count: 1,
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      'POST https://fal.example.test/submit',
      'GET https://fal.example.test/jobs/job-1',
    ]);
    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        modality: 'video',
        contentType: 'video/mp4',
      }),
    );
    expect(await fs.promises.readFile(result.artifacts[0].storageRef, 'utf8')).toBe('checkpoint-6-video');
  });

  it('exposes job status and cancellation receipts', async () => {
    const fetchImpl = (async (url, init) => {
      if ((init?.method || 'GET') === 'POST' && String(url).endsWith('/cancel')) {
        return response({ ok: true });
      }
      return response({ id: 'job-2', status: 'running' });
    }) as typeof fetch;
    const adapter = new AsyncMediaJobGenerationLiveAdapter({
      adapterId: 'runway',
      providerId: 'runway',
      supportedModalities: ['video'],
      submitUrl: 'https://runway.example.test/submit',
      pollUrlTemplate: 'https://runway.example.test/jobs/{jobId}',
      apiKey: 'runway-secret',
      modelId: 'runway-gen4',
    }, { fetchImpl, now: () => new Date('2026-05-04T23:01:00.000Z') });

    await expect(adapter.getJobStatus('job-2')).resolves.toEqual(
      expect.objectContaining({
        providerId: 'runway',
        jobId: 'job-2',
        status: 'running',
        liveIo: true,
        secretValuesSerialized: false,
      }),
    );
    await expect(adapter.cancelJob('job-2')).resolves.toEqual(
      expect.objectContaining({
        providerId: 'runway',
        jobId: 'job-2',
        status: 'cancel-requested',
        liveIo: true,
        secretValuesSerialized: false,
      }),
    );
  });
});
