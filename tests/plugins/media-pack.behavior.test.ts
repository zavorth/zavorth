import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

function createMockCtx(workspace: string, permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const specialized: string[] = [];
  return {
    capabilities,
    specialized,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      registerImageGenProvider() {
        specialized.push('image_gen');
      },
      registerTtsProvider() {
        specialized.push('tts');
      },
      registerTranscriptionProvider() {
        specialized.push('transcription');
      },
      registerVideoGenProvider() {
        specialized.push('video_gen');
      },
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return workspace;
      },
      async requestPermission() {
        return permission;
      },
      emit() {},
    },
  };
}

describe('Group 4 media pack', () => {
  const tempRoots: string[] = [];
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function tempWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-media-w4-'));
    tempRoots.push(root);
    return root;
  }

  it('media-image-gen status and soft-fail generate without key', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'media-image-gen/index.js'));
    const mock = createMockCtx(root, false);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('media.image.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    const gen = await mock.capabilities.get('media.image.generate')!({
      input: { prompt: 'a red cube' },
    });
    expect(gen.output.ok).toBe(false);
  });

  it('media-vision status does not leak keys', async () => {
    process.env.OPENAI_API_KEY = 'sk-vision-secret-leak-test';
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'media-vision/index.js'));
    const mock = createMockCtx(root);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('media.vision.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    expect(JSON.stringify(status.output)).not.toContain('sk-vision-secret-leak-test');
  });

  it('media-tts soft-fails without key', async () => {
    delete process.env.OPENAI_API_KEY;
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'media-tts/index.js'));
    const mock = createMockCtx(root, false);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('media.tts.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    const synth = await mock.capabilities.get('media.tts.synthesize')!({
      input: { text: 'hello capability group four' },
    });
    expect(synth.output.ok).toBe(false);
  });

  it('media-transcription rejects path outside workspace', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'media-transcription/index.js'));
    const mock = createMockCtx(root, true);
    mod.register(mock.ctx);
    const result = await mock.capabilities.get('media.transcription.transcribe')!({
      input: { path: '..\\..\\Windows\\system.ini' },
    });
    expect(result.output.ok).toBe(false);
  });

  it('media-video-gen does not fake success without API config', async () => {
    delete process.env.VIDEO_GEN_API_KEY;
    delete process.env.VIDEO_GEN_BASE_URL;
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'media-video-gen/index.js'));
    const mock = createMockCtx(root, true);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('media.video.status')!({ input: {} });
    expect(status.output.ok).toBeDefined();
    const gen = await mock.capabilities.get('media.video.generate')!({
      input: { prompt: 'a flying car' },
    });
    expect(gen.output.ok).toBe(false);
    expect(String(gen.output.message || gen.output.setup || '')).toBeTruthy();
  });
});
