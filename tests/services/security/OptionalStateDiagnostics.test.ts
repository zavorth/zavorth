import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { logger } from '../../../src/logger.js';
import { GoalPlaneService } from '../../../src/services/GoalPlaneService.js';
import { TaskPlaneService } from '../../../src/services/TaskPlaneService.js';
import { VoiceWakeRuntimeService } from '../../../src/services/VoiceWakeRuntimeService.js';
import { checkFirecrackerBinary } from '../../../src/services/sandbox/firecracker-runtime/FirecrackerSandboxEnvironment.js';

describe('optional runtime state diagnostics', () => {
  let root: string;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-optional-state-'));
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('treats missing optional task, goal, and voice state as empty without parse warnings', () => {
    expect(new TaskPlaneService({ storePath: path.join(root, 'task.json') }).snapshot().items).toHaveLength(0);
    expect(new GoalPlaneService({ storePath: path.join(root, 'goal.json') }).snapshot().summary.total).toBe(0);
    expect(new VoiceWakeRuntimeService({ stateFile: path.join(root, 'voice.json') }).status().mode).toBe('off');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps malformed existing JSON observable', () => {
    for (const name of ['task.json', 'goal.json', 'voice.json']) fs.writeFileSync(path.join(root, name), '{broken', 'utf8');
    new TaskPlaneService({ storePath: path.join(root, 'task.json') }).snapshot();
    new GoalPlaneService({ storePath: path.join(root, 'goal.json') }).snapshot();
    new VoiceWakeRuntimeService({ stateFile: path.join(root, 'voice.json') }).status();
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[Task Plane] JSON parse failed',
      '[Goal Plane] JSON parse failed',
      '[Voice Wake Runtime] JSON parse failed',
    ]);
  });

  it('treats an unavailable Firecracker binary as unavailable rather than process failure', () => {
    expect(checkFirecrackerBinary(path.join(root, 'missing-firecracker-binary'))).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
