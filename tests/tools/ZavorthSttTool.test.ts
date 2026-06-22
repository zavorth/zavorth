import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSttTool } from '../../src/tools/ZavorthSttTool';

describe('ZavorthSttTool', () => {
  let tool: ZavorthSttTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-test-'));
    tool = new ZavorthSttTool({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_stt');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });

  it('returns error for transcribe without audio_path', async () => {
    const result = await tool.execute({ action: 'transcribe' });
    expect(result).toContain('Erro');
    expect(result).toContain('audio_path');
  });

  it('returns error for non-existent audio file', async () => {
    const result = await tool.execute({ action: 'transcribe', audio_path: '/nonexistent/audio.mp3' });
    expect(result).toContain('Erro');
    expect(result).toContain('nao encontrado');
  });

  it('returns error for unsupported audio format', async () => {
    const filePath = path.join(tempDir, 'test.xyz');
    fs.writeFileSync(filePath, 'fake audio');
    const result = await tool.execute({ action: 'transcribe', audio_path: filePath });
    expect(result).toContain('Erro');
    expect(result).toContain('nao suportado');
  });

  it('returns error for oversized audio file', async () => {
    const filePath = path.join(tempDir, 'huge.mp3');
    const buffer = Buffer.alloc(26 * 1024 * 1024);
    fs.writeFileSync(filePath, buffer);
    const result = await tool.execute({ action: 'transcribe', audio_path: filePath });
    expect(result).toContain('Erro');
    expect(result).toContain('25MB');
  });

  it('lists backends', async () => {
    const result = await tool.execute({ action: 'list_backends' });
    expect(result).toContain('Backends');
    expect(result).toContain('whisper');
    expect(result).toContain('deepgram');
    expect(result).toContain('gemini');
    expect(result).toContain('azure');
    expect(result).toContain('local');
  });

  it('sets default backend', async () => {
    const result = await tool.execute({ action: 'set_default', backend: 'deepgram' });
    expect(result).toContain('deepgram');
  });

  it('returns error for invalid backend', async () => {
    const result = await tool.execute({ action: 'set_default', backend: 'invalid' });
    expect(result).toContain('Erro');
  });

  it('returns error for detect_language without audio', async () => {
    const result = await tool.execute({ action: 'detect_language' });
    expect(result).toContain('Erro');
  });
});
