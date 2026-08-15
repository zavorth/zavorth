import fs from 'fs';
import os from 'os';
import path from 'path';
import { SttProviderPackLoader } from '../../../../src/adapters/speech/stt/SttProviderPackLoader';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stt-packs-test-'));
}

describe('SttProviderPackLoader', () => {
  it('returns an empty list when the directory does not exist', () => {
    const loader = new SttProviderPackLoader(path.join(os.tmpdir(), 'no-such-stt-dir-xyz'));
    expect(loader.loadAll()).toEqual([]);
  });

  it('returns an empty list for an empty directory', () => {
    const dir = tempDir();
    const loader = new SttProviderPackLoader(dir);
    expect(loader.loadAll()).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads valid packs and applies the directory name as providerId', () => {
    const dir = tempDir();
    const packDir = path.join(dir, 'custom-provider');
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(
      path.join(packDir, 'provider.json'),
      JSON.stringify({
        providerId: 'whatever',
        transport: 'http',
        transcribeUrl: 'https://api.example.com/v1/transcribe',
        requestStyle: 'json-base64',
        apiKeyEnvVar: 'CUSTOM_API_KEY',
      }),
      'utf8',
    );

    const loader = new SttProviderPackLoader(dir);
    const configs = loader.loadAll();
    expect(configs).toHaveLength(1);
    expect(configs[0].providerId).toBe('custom-provider');
    expect(configs[0].transport).toBe('http');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips invalid packs with a warning and loads the valid ones', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const dir = tempDir();

    const brokenDir = path.join(dir, 'broken');
    fs.mkdirSync(brokenDir, { recursive: true });
    fs.writeFileSync(path.join(brokenDir, 'provider.json'), '{ not valid json', 'utf8');

    const goodDir = path.join(dir, 'good');
    fs.mkdirSync(goodDir, { recursive: true });
    fs.writeFileSync(
      path.join(goodDir, 'provider.json'),
      JSON.stringify({
        providerId: 'good',
        transport: 'sdk',
        sdkModule: 'acme-stt',
        factoryFunction: 'createClient',
      }),
      'utf8',
    );

    const loader = new SttProviderPackLoader(dir);
    const configs = loader.loadAll();
    expect(configs).toHaveLength(1);
    expect(configs[0].providerId).toBe('good');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips directories without a provider.json file', () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'no-config'), { recursive: true });
    const loader = new SttProviderPackLoader(dir);
    expect(loader.loadAll()).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
