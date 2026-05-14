import fs from 'fs';
import os from 'os';
import path from 'path';
import { ModeManager, OperationalMode } from '../../src/security/OperationalMode';

describe('ModeManager', () => {
  it('persists the selected mode between instances', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-mode-'));
    const stateFile = path.join(tempDir, 'mode.json');

    const first = new ModeManager(OperationalMode.WORKSPACE, stateFile);
    first.setMode(OperationalMode.PRIVILEGED);

    const second = new ModeManager(OperationalMode.WORKSPACE, stateFile);
    expect(second.getMode()).toBe(OperationalMode.PRIVILEGED);

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
});
