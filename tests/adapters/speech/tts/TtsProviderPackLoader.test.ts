import fs from 'fs';
import os from 'os';
import path from 'path';
import { TtsProviderPackLoader, TTS_PROVIDER_CONFIG_FILENAME } from '../../../../src/adapters/speech/tts/TtsProviderPackLoader';

function writePack(dir: string, providerId: string, config: Record<string, unknown>): void {
  const packDir = path.join(dir, providerId);
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(path.join(packDir, TTS_PROVIDER_CONFIG_FILENAME), JSON.stringify(config));
}

describe('TtsProviderPackLoader', () => {
  it('loads valid packs from the directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-pack-loader-'));
    writePack(dir, 'my-voice', {
      providerId: 'my-voice',
      transport: 'http',
      synthesizeUrl: 'https://example.com/synth',
    });
    const loader = new TtsProviderPackLoader(dir);
    const configs = loader.loadAll();
    expect(configs).toHaveLength(1);
    expect(configs[0].providerId).toBe('my-voice');
    expect(configs[0].transport).toBe('http');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips invalid packs without throwing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-pack-loader-'));
    writePack(dir, 'broken', { transport: 'telepathy' });
    const loader = new TtsProviderPackLoader(dir);
    const configs = loader.loadAll();
    expect(configs).toHaveLength(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('uses the directory name when providerId mismatches', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-pack-loader-'));
    writePack(dir, 'dir-name', {
      providerId: 'other-name',
      transport: 'http',
      synthesizeUrl: 'https://example.com',
    });
    const loader = new TtsProviderPackLoader(dir);
    const configs = loader.loadAll();
    expect(configs).toHaveLength(1);
    expect(configs[0].providerId).toBe('dir-name');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns [] when the directory does not exist', () => {
    const loader = new TtsProviderPackLoader(path.join(os.tmpdir(), 'tts-missing-pack-dir'));
    expect(loader.loadAll()).toEqual([]);
  });
});
