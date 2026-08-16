import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { CliSynthesisAdapter } from '../../../../src/adapters/speech/tts/transports/CliSynthesisAdapter';
import { ttsProviderConfigSchema } from '../../../../src/adapters/speech/tts/TtsProviderConfigSchema';

function fakeChildProcess(code = 0): ChildProcess & EventEmitter {
  const child = new EventEmitter() as ChildProcess & EventEmitter;
  const stderrEmitter = new EventEmitter();
  stderrEmitter.setEncoding = jest.fn();
  (child as unknown as { stderr?: EventEmitter }).stderr = stderrEmitter;
  child.kill = jest.fn() as unknown as ChildProcess['kill'];
  setTimeout(() => {
    child.emit('close', code);
  }, 5);
  return child;
}

const WAV_BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

describe('CliSynthesisAdapter', () => {
  it('runs the platform command and returns the produced audio file', async () => {
    const spawnImpl = jest.fn().mockImplementation((_cmd: string, args: string[]) => {
      const child = fakeChildProcess(0);
      const outputIndex = args.indexOf('-o');
      const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
      setTimeout(() => {
        if (outputPath) fs.writeFileSync(outputPath, WAV_BYTES);
      }, 2);
      return child;
    });
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-cli-test-'));
    const config = ttsProviderConfigSchema.parse({
      providerId: 'local',
      transport: 'cli',
      command: 'say',
      args: ['-o', '{output}', '{text}'],
      outputFormat: 'wav',
      responseContentType: 'audio/wav',
      rateMode: 'multiply',
      rateBase: 175,
    });
    const adapter = new CliSynthesisAdapter(config, { spawn: spawnImpl, tempDir });
    const output = await adapter.synthesize({ text: 'hello world', speed: 1.0 });
    expect(output.format).toBe('wav');
    expect(output.contentType).toBe('audio/wav');
    expect(output.audio.equals(WAV_BYTES)).toBe(true);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes a textFile placeholder and passes it to a script-style command', async () => {
    const spawnImpl = jest.fn().mockImplementation(() => fakeChildProcess(1));
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-cli-test-'));
    const config = ttsProviderConfigSchema.parse({
      providerId: 'win',
      transport: 'cli',
      command: 'powershell',
      args: ['-Command', "Write-Host (Get-Content '{textFile}')"],
      outputFormat: 'wav',
      rateMode: 'delta',
      rateBase: 10,
    });
    const adapter = new CliSynthesisAdapter(config, { spawn: spawnImpl, tempDir });
    await expect(adapter.synthesize({ text: "it's a test", speed: 1.5 })).rejects.toThrow('exited');
    const [cmd, args] = spawnImpl.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('powershell');
    const script = args.join(' ');
    expect(script).toContain('.txt');
    expect(script).not.toContain("it's a test");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('injects voiceArgs before the text arg when a voice is requested', async () => {
    const spawnImpl = jest.fn().mockImplementation(() => fakeChildProcess(1));
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-cli-test-'));
    const config = ttsProviderConfigSchema.parse({
      providerId: 'local',
      transport: 'cli',
      command: 'say',
      args: ['-o', '{output}', '{text}'],
      platformCommands: {
        win32: { command: 'powershell', args: ['-o', '{output}', '{text}'], voiceArgs: ['-v', '{voice}'], rateMode: 'multiply', rateBase: 200 },
      },
      outputFormat: 'wav',
      rateMode: 'multiply',
      rateBase: 175,
    });
    const adapter = new CliSynthesisAdapter(config, { spawn: spawnImpl, tempDir });
    await expect(adapter.synthesize({ text: 'hi', voiceId: 'Samantha' })).rejects.toThrow('exited');
    const [, args] = spawnImpl.mock.calls[0] as [string, string[]];
    expect(args).toContain('-v');
    expect(args).toContain('Samantha');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws when the command exits non-zero with stderr context', async () => {
    const spawnImpl = jest.fn().mockImplementation(() => {
      const child = fakeChildProcess(1);
      setTimeout(() => {
        (child as unknown as { stderr?: EventEmitter }).stderr?.emit('data', 'boom');
      }, 1);
      return child;
    });
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-cli-test-'));
    const config = ttsProviderConfigSchema.parse({
      providerId: 'local',
      transport: 'cli',
      command: 'say',
      args: ['{text}'],
    });
    const adapter = new CliSynthesisAdapter(config, { spawn: spawnImpl, tempDir });
    await expect(adapter.synthesize({ text: 'x' })).rejects.toThrow('exited with 1');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
