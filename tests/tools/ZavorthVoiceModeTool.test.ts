import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthVoiceModeTool } from '../../src/tools/ZavorthVoiceModeTool';

describe('ZavorthVoiceModeTool', () => {
  let tool: ZavorthVoiceModeTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-test-'));
    tool = new ZavorthVoiceModeTool({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_voice_mode');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('starts a voice session', async () => {
    const result = await tool.execute({ action: 'start_session', mode: 'manual', language: 'pt-BR' });
    expect(result).toContain('Voice session created');
    expect(result).toContain('manual');
    expect(result).toContain('pt-BR');
  });

  it('starts a wake word session', async () => {
    const result = await tool.execute({ action: 'start_session', mode: 'wake_word', wake_word: 'jarvis' });
    expect(result).toContain('wake_word');
    expect(result).toContain('jarvis');
  });

  it('lists sessions', async () => {
    await tool.execute({ action: 'start_session', mode: 'manual' });
    await tool.execute({ action: 'start_session', mode: 'continuous' });
    const result = await tool.execute({ action: 'list_sessions' });
    expect(result).toContain('2');
  });

  it('gets session status', async () => {
    const start = await tool.execute({ action: 'start_session', mode: 'manual' });
    const idMatch = start.match(/ID: (voice_\w+)/);
    expect(idMatch).toBeTruthy();
    const result = await tool.execute({ action: 'status', session_id: idMatch![1] });
    expect(result).toContain('manual');
    expect(result).toContain('idle');
  });

  it('sets mode on session', async () => {
    const start = await tool.execute({ action: 'start_session', mode: 'manual' });
    const idMatch = start.match(/ID: (voice_\w+)/);
    const result = await tool.execute({
      action: 'set_mode',
      session_id: idMatch![1],
      mode: 'continuous',
    });
    expect(result).toContain('continuous');
  });

  it('returns error for missing session_id', async () => {
    const result = await tool.execute({ action: 'status' });
    expect(result).toContain('Error');
    expect(result).toContain('session_id');
  });

  it('returns error for invalid mode', async () => {
    const start = await tool.execute({ action: 'start_session', mode: 'manual' });
    const idMatch = start.match(/ID: (voice_\w+)/);
    const result = await tool.execute({
      action: 'set_mode',
      session_id: idMatch![1],
      mode: 'telepathy',
    });
    expect(result).toContain('Error');
  });

  it('lists backends', async () => {
    const result = await tool.execute({ action: 'list_backends' });
    expect(result).toContain('Available voice backends');
  });
});
