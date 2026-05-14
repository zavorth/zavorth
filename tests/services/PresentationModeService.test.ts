import fs from 'fs';
import os from 'os';
import path from 'path';
import { PresentationModeService } from '../../src/services/PresentationModeService';

describe('PresentationModeService', () => {
  it('persists presentation mode state across instances', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-presentation-mode-'));
    const stateFile = path.join(tempDir, 'presentation-mode-state.json');

    try {
      const service = new PresentationModeService(stateFile);
      expect(service.isEnabled()).toBe(false);

      service.enable('42', 'Ativado em teste.');

      const reloaded = new PresentationModeService(stateFile);
      expect(reloaded.isEnabled()).toBe(true);
      expect(reloaded.getStatus()).toEqual(
        expect.objectContaining({
          enabled: true,
          updatedBy: '42',
          note: 'Ativado em teste.',
        }),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
