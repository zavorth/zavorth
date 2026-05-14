import { once } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SessionManager } from '../../../../src/runtime/sessions/v2/SessionManager.js';
import { SessionRecorder } from '../../../../src/runtime/sessions/v2/SessionRecorder.js';

describe('SessionRecorder', () => {
  it('records stdin and stdout frames into an asciinema cast', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-recorder-'));
    const manager = new SessionManager('session-recorder-1', tempRoot, {
      loadNodePty: () => null,
    });
    const recorder = new SessionRecorder('session-recorder-1', tempRoot);

    recorder.startRecording(manager);
    manager.startProcess(process.execPath, [
      '-e',
      [
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => {",
        "  process.stdout.write(`echo:${chunk}`);",
        '  process.exit(0);',
        '});',
      ].join(' '),
    ]);

    manager.write('record me\n');
    await once(manager.getEvents(), 'pty:exit');
    const recordingPath = recorder.stopRecording();
    const recording = SessionRecorder.loadRecording(String(recordingPath));

    expect(recordingPath).toEqual(expect.stringContaining('.cast'));
    expect(recording?.header.version).toBe(2);
    expect(recording?.frames.some((frame) => frame[1] === 'i' && frame[2].includes('record me'))).toBe(true);
    expect(recording?.frames.some((frame) => frame[1] === 'o' && frame[2].includes('echo:record me'))).toBe(true);
  });
});
