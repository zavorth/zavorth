import fs from 'fs';
import os from 'os';
import path from 'path';
import { DemoModeService } from '../../src/services/DemoModeService';

describe('DemoModeService', () => {
  it('persists demo mode state across instances', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-demo-mode-'));
    const stateFile = path.join(tempDir, 'demo-mode-state.json');

    try {
      const service = new DemoModeService(stateFile);
      expect(service.isEnabled()).toBe(false);

      service.enable('42', 'Enabled in test.', true);

      const reloaded = new DemoModeService(stateFile);
      expect(reloaded.isEnabled()).toBe(true);
      expect(reloaded.getStatus()).toEqual(
        expect.objectContaining({
          enabled: true,
          updatedBy: '42',
          note: 'Enabled in test.',
          autoPresentationEnabled: true,
        }),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
