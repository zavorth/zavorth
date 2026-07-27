import fs from 'fs';
import os from 'os';
import path from 'path';
import { MediaUnderstandingService } from '../../src/services/MediaUnderstandingService';

import type {
  AdapterAnalysisInput,
  AdapterAnalysisOutput,
  IMediaUnderstandingAdapter,
} from '../../src/contracts/MediaUnderstandingContract';

describe('MediaUnderstandingService', () => {
  let artifactDir: string;

  beforeEach(async () => {
    artifactDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-media-understand-'));
  });

  afterEach(async () => {
    await fs.promises.rm(artifactDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function createAdapter(output-: Partial<AdapterAnalysisOutput>): IMediaUnderstandingAdapter {
    return {
      adapterId: 'fake-vision',
      supportedModalities: ['image'],
      analyze: jest.fn(async (_input: AdapterAnalysisInput) => ({
        text: 'A clean artifact-backed image.',
        hasVisibleText: false,
        hasFaces: false,
        sensitiveContent: false,
        sensitiveContentReason: null,
        providerEvidence: {
          providerId: 'fake-vision',
          modelId: 'fake-model',
        },
        ...output,
      })),
    };
  }

  it('resolves artifact-ref from the media artifact directory and analyzes it', async () => {
    const artifactId = 'artifact-123';
    const artifactPath = path.join(artifactDir, `image-${artifactId}.png`);
    await fs.promises.writeFile(artifactPath, Buffer.from('fake-image-bytes'));

    const adapter = createAdapter();
    const service = new MediaUnderstandingService({ adapters: [adapter], artifactDir });

    const result = await service.analyze({
      source: {
        kind: 'artifact-ref',
        artifactId,
      },
      analysisType: 'describe',
    });

    expect(result.ok).toBe(true);
    expect(result.policyDecision.sourceValidated).toBe(true);
    expect(result.modality).toBe('image');
    expect(result.analysis?.description).toBe('A clean artifact-backed image.');
    expect(adapter.analyze).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'image/png',
      data: Buffer.from('fake-image-bytes'),
    }));
  });

  it('rejects missing artifact refs before calling the adapter', async () => {
    const adapter = createAdapter();
    const service = new MediaUnderstandingService({ adapters: [adapter], artifactDir });

    const result = await service.analyze({
      source: {
        kind: 'artifact-ref',
        artifactId: 'missing-artifact',
      },
      analysisType: 'describe',
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_SOURCE');
    expect(adapter.analyze).not.toHaveBeenCalled();
  });
});
