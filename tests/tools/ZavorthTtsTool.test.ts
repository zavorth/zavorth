import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthTtsTool } from '../../src/tools/ZavorthTtsTool';

describe('ZavorthTtsTool', () => {
  let tool: ZavorthTtsTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-test-'));
    tool = new ZavorthTtsTool({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_tts');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('returns error for speak without text', async () => {
    const result = await tool.execute({ action: 'speak' });
    expect(result).toContain('Error');
    expect(result).toContain('text');
  });

  it('rejects text over 10000 characters', async () => {
    const result = await tool.execute({ action: 'speak', text: 'A'.repeat(10001) });
    expect(result).toContain('Error');
    expect(result).toContain('10.000');
  });

  it('lists backends', async () => {
    const result = await tool.execute({ action: 'list_backends' });
    expect(result).toContain('Backends');
    expect(result).toContain('local');
    expect(result).toContain('azure');
    expect(result).toContain('elevenlabs');
  });

  it('lists voices for local backend', async () => {
    const result = await tool.execute({ action: 'list_voices', backend: 'local' });
    expect(result).toContain('Voices');
  });

  it('lists voices for azure backend', async () => {
    const result = await tool.execute({ action: 'list_voices', backend: 'azure' });
    expect(result).toContain('Antonio');
    expect(result).toContain('Francisca');
  });

  it('lists voices for elevenlabs backend', async () => {
    const result = await tool.execute({ action: 'list_voices', backend: 'elevenlabs' });
    expect(result).toContain('Rachel');
  });

  it('sets default backend', async () => {
    const result = await tool.execute({ action: 'set_default', backend: 'azure' });
    expect(result).toContain('azure');
  });

  it('returns error for invalid backend on set_default', async () => {
    const result = await tool.execute({ action: 'set_default', backend: 'nonexistent' });
    expect(result).toContain('Error');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'sing' });
    expect(result).toContain('Error');
  });
});
