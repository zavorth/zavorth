import fs from 'fs';
import os from 'os';
import path from 'path';
import { OperatorModeService } from '../../src/services/OperatorModeService';

describe('OperatorModeService', () => {
  it('persists operator mode state across instances', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-operator-mode-'));
    const stateFile = path.join(tempDir, 'operator-mode-state.json');

    try {
      const service = new OperatorModeService(stateFile);
      expect(service.isEnabled()).toBe(false);

      service.enable('42', 'Ativado em teste.');

      const reloaded = new OperatorModeService(stateFile);
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
