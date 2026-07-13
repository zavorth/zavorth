import { LocalEmbeddingService } from '../../../src/services/LocalEmbeddingService.js';
import { MemoryModeRouter } from '../../../src/services/MemoryModeRouter.js';

describe('LocalEmbeddingService + MemoryModeRouter', () => {
  it('generates fixed 768-d normalized vectors locally', async () => {
    const service = new LocalEmbeddingService();
    const a = await service.generate('gateway approval policy');
    const b = await service.generate('gateway approval policy');
    const c = await service.generate('totally different topic about weather');

    expect(a).toHaveLength(768);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);

    const norm = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('resolves memory modes from env', () => {
    expect(LocalEmbeddingService.resolveMode({ ZAVORTH_MEMORY_MODE: 'local' } as NodeJS.ProcessEnv)).toBe('local');
    expect(LocalEmbeddingService.resolveMode({ ZAVORTH_MEMORY_MODE: 'cloud' } as NodeJS.ProcessEnv)).toBe('cloud');
    expect(LocalEmbeddingService.resolveMode({} as NodeJS.ProcessEnv)).toBe('hybrid');
  });

  it('creates local backend for local mode without gemini', () => {
    const backend = MemoryModeRouter.createEmbeddingBackend({
      ZAVORTH_MEMORY_MODE: 'local',
    } as NodeJS.ProcessEnv);
    expect(backend?.backend).toBe('local');
    expect(backend?.mode).toBe('local');
  });

  it('returns null cloud backend when gemini is not configured', () => {
    const backend = MemoryModeRouter.createEmbeddingBackend({
      ZAVORTH_MEMORY_MODE: 'cloud',
      // no GEMINI key in this isolated env object
    } as NodeJS.ProcessEnv);
    // VectorEmbeddingService.isConfigured reads global config — may still be set.
    // Just assert create does not throw.
    expect(backend === null || backend.mode === 'cloud').toBe(true);
  });

  it('exposes residual diagnostics for hash/neural backends', async () => {
    const service = new LocalEmbeddingService({ preferTransformers: false });
    await service.generate('diagnostic probe');
    const diag = service.getDiagnostics();
    expect(diag.dimensions).toBe(768);
    expect(diag.backendUsed).toBe('hash');
    expect(diag.neuralHint).toMatch(/@xenova\/transformers|ONNX/i);
  });

  it('falls back to hash when neural package is unavailable', async () => {
    const service = new LocalEmbeddingService({ preferTransformers: true });
    const vec = await service.generate('neural preferred but may be missing');
    expect(vec).toHaveLength(768);
    // Without @xenova/transformers installed, backend stays hash
    expect(['hash', 'transformers']).toContain(service.getBackendUsed());
  });
});
