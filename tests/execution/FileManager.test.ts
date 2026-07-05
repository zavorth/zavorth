import { FileManager } from '../../src/execution/FileManager';

describe('FileManager', () => {
  describe('Static methods exist', () => {
    it('should have readSafe method', () => {
      expect(typeof FileManager.readSafe).toBe('function');
    });

    it('should have writeSafe method', () => {
      expect(typeof FileManager.writeSafe).toBe('function');
    });

    it('should have deleteSafe method', () => {
      expect(typeof FileManager.deleteSafe).toBe('function');
    });

    it('should have listSafe method', () => {
      expect(typeof FileManager.listSafe).toBe('function');
    });
  });

  describe('Path traversal prevention', () => {
    it('should prevent ../ attacks on readSafe', () => {
      expect(() => FileManager.readSafe('/tmp', '../../../etc/passwd')).toThrow();
    });

    it('should prevent ../ attacks on writeSafe', () => {
      expect(() => FileManager.writeSafe('/tmp', '../../../etc/test', 'data')).toThrow();
    });

    it('should prevent absolute path attacks', () => {
      expect(() => FileManager.writeSafe('/tmp', '/etc/test', 'data')).toThrow();
    });

    it('should prevent directory traversal on listSafe', () => {
      expect(() => FileManager.listSafe('/tmp', '../../../etc')).toThrow();
    });
  });
});
