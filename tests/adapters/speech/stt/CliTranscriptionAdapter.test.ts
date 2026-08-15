import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { CliTranscriptionAdapter } from '../../../../src/adapters/speech/stt/transports/CliTranscriptionAdapter';
import { sttProviderConfigSchema } from '../../../../src/adapters/speech/stt/SttProviderConfigSchema';

function fakeChildProcess(stdout: string, code = 0): ChildProcess & EventEmitter {
  const child = new EventEmitter() as ChildProcess & EventEmitter;
  const stdoutEmitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();
  stdoutEmitter.setEncoding = jest.fn();
  stderrEmitter.setEncoding = jest.fn();
  (child as unknown as { stdout?: EventEmitter }).stdout = stdoutEmitter;
  (child as unknown as { stderr?: EventEmitter }).stderr = stderrEmitter;
  child.kill = jest.fn() as unknown as ChildProcess['kill'];
  setTimeout(() => {
    stdoutEmitter.emit('data', stdout);
    child.emit('close', code);
  }, 5);
  return child;
}

function makeSpawn(stdout = 'plain text transcript', code = 0) {
  return jest.fn().mockImplementation(() => fakeChildProcess(stdout, code));
}

const audio = Buffer.from([9, 8, 7, 6]);

describe('CliTranscriptionAdapter', () => {
  it('runs the command and returns stdout as the transcript', async () => {
    const spawnImpl = makeSpawn('hello from cli');
    const config = sttProviderConfigSchema.parse({
      providerId: 'whisper.cpp',
      transport: 'cli',
      command: 'whisper',
      args: ['{audio}', '--output_format', 'txt'],
      transcriptPath: 'text',
    });
    const adapter = new CliTranscriptionAdapter(config, { spawn: spawnImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/wav' });
    expect(output.text).toBe('hello from cli');
    expect(output.providerEvidence.providerId).toBe('whisper.cpp');
    expect(spawnImpl).toHaveBeenCalled();
  });

  it('parses JSON output through the configured transcriptPath', async () => {
    const spawnImpl = makeSpawn(JSON.stringify({ result: 'json transcript' }));
    const config = sttProviderConfigSchema.parse({
      providerId: 'cli-json',
      transport: 'cli',
      command: 'some-stt-cli',
      transcriptPath: 'result',
    });
    const adapter = new CliTranscriptionAdapter(config, { spawn: spawnImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/mpeg' });
    expect(output.text).toBe('json transcript');
  });

  it('throws when the command exits non-zero', async () => {
    const spawnImpl = makeSpawn('', 1);
    const config = sttProviderConfigSchema.parse({
      providerId: 'cli-fail',
      transport: 'cli',
      command: 'broken-stt',
    });
    const adapter = new CliTranscriptionAdapter(config, { spawn: spawnImpl });
    await expect(
      adapter.transcribe({ audio, contentType: 'audio/mpeg' }),
    ).rejects.toThrow('exited with 1');
  });

  it('throws when the transcript is empty', async () => {
    const spawnImpl = makeSpawn('  ');
    const config = sttProviderConfigSchema.parse({
      providerId: 'cli-empty',
      transport: 'cli',
      command: 'empty-stt',
    });
    const adapter = new CliTranscriptionAdapter(config, { spawn: spawnImpl });
    await expect(
      adapter.transcribe({ audio, contentType: 'audio/mpeg' }),
    ).rejects.toThrow('empty transcript');
  });

  it('cleans up the temp audio file after transcription', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-cli-test-'));
    const spawnImpl = makeSpawn('done');
    const config = sttProviderConfigSchema.parse({
      providerId: 'cli-clean',
      transport: 'cli',
      command: 'stt-cli',
    });
    const adapter = new CliTranscriptionAdapter(config, { spawn: spawnImpl, tempDir });
    await adapter.transcribe({ audio, contentType: 'audio/wav' });
    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(0);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses wordTimestampArgs and extracts segments and words from JSON output', async () => {
    const json = JSON.stringify({
      transcription: [
        { timestamps: { from: 0, to: 520 }, text: 'hello' },
        { timestamps: { from: 520, to: 1100 }, text: 'world' },
      ],
    });
    const spawnImpl = makeSpawn(json);
    const config = sttProviderConfigSchema.parse({
      providerId: 'whisper.cpp',
      transport: 'cli',
      command: 'whisper',
      args: ['{audio}', '--output_format', 'txt'],
      wordTimestampArgs: ['{audio}', '--output_format', 'json'],
      segmentsPath: 'transcription',
      timeUnit: 'milliseconds',
    });
    const adapter = new CliTranscriptionAdapter(config, { spawn: spawnImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/wav', wordTimestamps: true });
    expect(output.text).toBe('hello world');
    expect(output.segments).toHaveLength(2);
    expect(output.segments[0].startMs).toBe(0);
    expect(output.segments[0].endMs).toBe(520);
    expect(output.segments[1].startMs).toBe(520);
    expect(output.segments[1].endMs).toBe(1100);

    const callArgs = spawnImpl.mock.calls[0] as [string, string[]];
    expect(callArgs[1]).toContain('--output_format');
    expect(callArgs[1]).toContain('json');
    expect(callArgs[1]).not.toContain('txt');
  });

  it('keeps plain txt output when word timestamps are not requested', async () => {
    const spawnImpl = makeSpawn('plain transcript');
    const config = sttProviderConfigSchema.parse({
      providerId: 'whisper.cpp',
      transport: 'cli',
      command: 'whisper',
      args: ['{audio}', '--output_format', 'txt'],
      wordTimestampArgs: ['{audio}', '--output_format', 'json'],
      segmentsPath: 'transcription',
      timeUnit: 'milliseconds',
    });
    const adapter = new CliTranscriptionAdapter(config, { spawn: spawnImpl });
    const output = await adapter.transcribe({ audio, contentType: 'audio/wav' });
    expect(output.text).toBe('plain transcript');
    const callArgs = spawnImpl.mock.calls[0] as [string, string[]];
    expect(callArgs[1]).toContain('txt');
    expect(callArgs[1]).not.toContain('json');
  });
});
