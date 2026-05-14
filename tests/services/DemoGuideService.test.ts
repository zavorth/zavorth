import fs from 'fs';
import os from 'os';
import path from 'path';
import { DemoGuideService } from '../../src/services/DemoGuideService';

describe('DemoGuideService', () => {
  it('persists guided demo progress across instances', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-demo-guide-'));
    const stateFile = path.join(tempDir, 'demo-guide-state.json');

    try {
      const service = new DemoGuideService(stateFile);
      expect(service.getSession('42')).toBeNull();

      service.start('42');
      service.next('42', 4);

      const reloaded = new DemoGuideService(stateFile);
      expect(reloaded.getSession('42')).toEqual(
        expect.objectContaining({
          currentIndex: 1,
          completed: false,
        }),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('marks the sequence as completed on the last step and can reset it', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-demo-guide-'));
    const stateFile = path.join(tempDir, 'demo-guide-state.json');

    try {
      const service = new DemoGuideService(stateFile);
      service.start('99');

      service.next('99', 2);
      const completed = service.next('99', 2);

      expect(completed).toEqual(
        expect.objectContaining({
          currentIndex: 1,
          completed: true,
        }),
      );
      expect(service.reset('99')).toBe(true);
      expect(service.getSession('99')).toBeNull();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
