import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { LocalVoiceDictation } from '../../src/voice/LocalVoiceDictation';

function createFakeChild() {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = jest.fn();
  child.stderr.setEncoding = jest.fn();
  child.kill = jest.fn(() => {
    child.emit('close', 0);
  });
  return child;
}

describe('LocalVoiceDictation', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('fails with a clear error when the whisper binary is not provisioned', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-voice-missing-binary-'));
    tempDirs.push(root);
    const modelPath = path.join(root, 'ggml-tiny.bin');
    fs.writeFileSync(modelPath, 'model', 'utf8');

    const dictation = new LocalVoiceDictation({
      modelPath,
      binaryPath: path.join(root, 'missing-whisper.exe'),
      tempDir: root,
    });

    await expect(dictation.transcribeBuffer(Buffer.from('RIFF'))).rejects.toThrow(
      /ZAVORTH_WHISPER_BINARY|Binary do whisper local/,
    );
  });

  it('fails with a clear error when the whisper model is not provisioned', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-voice-missing-model-'));
    tempDirs.push(root);
    const binaryPath = path.join(root, 'whisper-cli.exe');
    fs.writeFileSync(binaryPath, 'binary', 'utf8');

    const dictation = new LocalVoiceDictation({
      modelPath: path.join(root, 'ggml-tiny.bin'),
      binaryPath,
      tempDir: root,
    });

    await expect(dictation.transcribeBuffer(Buffer.from('RIFF'))).rejects.toThrow(
      /ZAVORTH_WHISPER_MODEL_PATH|Whisper model not found/,
    );
  });

  it('runs whisper locally and returns the generated transcript', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-voice-success-'));
    tempDirs.push(root);
    const binaryPath = path.join(root, 'whisper-cli.exe');
    const modelPath = path.join(root, 'ggml-tiny.bin');
    fs.writeFileSync(binaryPath, 'binary', 'utf8');
    fs.writeFileSync(modelPath, 'model', 'utf8');

    const spawn = jest.fn((command: string, args: string[]) => {
      const child = createFakeChild();
      process.nextTick(() => {
        const outputBase = String(args[args.indexOf('-of') + 1] || '').trim();
        fs.writeFileSync(`${outputBase}.txt`, 'ola zavorth\n', 'utf8');
        child.emit('close', 0);
      });
      return child;
    }) as any;

    const dictation = new LocalVoiceDictation({
      modelPath,
      binaryPath,
      tempDir: root,
    }, {
      spawn,
    });

    const transcript = await dictation.transcribeBuffer(Buffer.from('RIFF?.TRACK', 'utf8'));

    expect(transcript).toBe('ola zavorth');
    expect(spawn).toHaveBeenCalled();
  });

  it('requires an explicit external microphone worker for continuous recording', async () => {
    const dictation = new LocalVoiceDictation();

    await expect(
      dictation.startContinuousMicrophoneRecord(() => undefined),
    ).rejects.toThrow(/ZAVORTH_VOICE_MIC_COMMAND|Captura continua de voz/);
  });

  it('streams transcript lines from an external microphone worker and stops cleanly', async () => {
    const child = createFakeChild();
    const spawn = jest.fn(() => {
      process.nextTick(() => {
        child.stdout.emit('data', 'linthere is 1\nlinthere is 2\n');
      });
      return child;
    }) as any;
    const transcripts: string[] = [];
    const dictation = new LocalVoiceDictation({
      microphoneCommand: 'voice-worker',
      microphoneArgs: ['--stream'],
    }, {
      spawn,
    });

    await dictation.startContinuousMicrophoneRecord((text) => {
      transcripts.push(text);
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    dictation.stopRecording();

    expect(spawn).toHaveBeenCalledWith('voice-worker', ['--stream'], expect.any(Object));
    expect(transcripts).toEqual(['linthere is 1', 'linthere is 2']);
    expect(child.kill).toHaveBeenCalled();
  });
});
