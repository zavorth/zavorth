import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthBridgePreferenceStore } from '../../../src/agents/ZavorthBridgePreferenceStore.js';

jest.mock('../../../src/config/index.js', () => {
  const temp = path.join(os.tmpdir(), `zavorth-bridge-cfg-${process.pid}`);
  return {
    config: {
      zavorthBridgePreferencesFile: path.join(temp, 'host-bridge-prefs.json'),
      zavorthBridgePreferredModelDefault: null,
    },
  };
});

describe('ZavorthBridgePreferenceStore honesty', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-bridge-prefs-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('isolates bridge prefs per userId', async () => {
    const store = new ZavorthBridgePreferenceStore({ projectRoot: tempDir });
    await store.forUser('user-a').setPreferredModel('gemini-a');
    await store.forUser('user-b').setPreferredModel('gemini-b');
    await store.forUser('user-a').setEchoMode(true);
    await store.forUser('user-b').setEchoMode(false);

    expect(await store.forUser('user-a').getPreferredModel()).toBe('gemini-a');
    expect(await store.forUser('user-b').getPreferredModel()).toBe('gemini-b');
    expect(await store.forUser('user-a').isEchoModeActive()).toBe(true);
    expect(await store.forUser('user-b').isEchoModeActive()).toBe(false);

    const pathA = path.join(tempDir, 'data', 'runtime', 'bridge', 'users', 'user-a', 'preferences.json');
    const pathB = path.join(tempDir, 'data', 'runtime', 'bridge', 'users', 'user-b', 'preferences.json');
    expect(fs.existsSync(pathA)).toBe(true);
    expect(fs.existsSync(pathB)).toBe(true);
  });
});
