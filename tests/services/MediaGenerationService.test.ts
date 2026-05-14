import fs from 'fs';
import os from 'os';
import path from 'path';

import type {
  AdapterGenerationOutput,
  IMediaGenerationAdapter,
  MediaGenerationRequest,
} from '../../src/contracts/MediaGenerationContract';
import { MediaGenerationService } from '../../src/services/MediaGenerationService';

describe('MediaGenerationService', () => {
  let artifactDir: string;

  beforeEach(async () => {
    artifactDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-media-generate-'));
  });

  afterEach(async () => {
    await fs.promises.rm(artifactDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function createAdapter(outputs: AdapterGenerationOutput[]): IMediaGenerationAdapter {
    return {
      adapterId: 'fake-image-adapter',
      supportedModalities: ['image'],
      generate: jest.fn(async (_request: MediaGenerationRequest) => outputs),
    };
  }

  it('stores adapter binary output as a generated media artifact', async () => {
    const adapter = createAdapter([
      {
        data: Buffer.from('fake-png-bytes'),
        contentType: 'image/png',
        sizeBytes: 14,
        providerEvidence: {
          providerId: 'fake-image-adapter',
          modelId: 'fake-model',
          sourceUrl: 'https://provider.example/generated.png',
        },
      },
    ]);
    const service = new MediaGenerationService({ adapters: [adapter], artifactDir });

    const result = await service.generate({
      prompt: 'a clean product mockup',
      modality: 'image',
      count: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].storageRef).toContain(artifactDir);
    expect(await fs.promises.readFile(result.artifacts[0].storageRef, 'utf8')).toBe('fake-png-bytes');
    expect(result.artifacts[0].providerEvidence.sourceUrl).toBe('https://provider.example/generated.png');
  });

  it('blocks unsafe prompts before calling the adapter', async () => {
    const adapter = createAdapter([]);
    const service = new MediaGenerationService({ adapters: [adapter], artifactDir });

    const result = await service.generate({
      prompt: 'explicit unsafe prompt',
      modality: 'image',
      count: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('POLICY_BLOCKED');
    expect(adapter.generate).not.toHaveBeenCalled();
  });
});
