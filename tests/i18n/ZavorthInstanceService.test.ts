import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  getInstanceName,
  resolveInstanceHome,
  getDefaultInstanceHome,
  instanceExists,
  listInstances,
  createInstance,
  deleteInstance,
  getInstancePath,
} from '../../src/services/ZavorthInstanceService.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-instance-test-'));
}

describe('ZavorthInstanceService', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getInstanceName', () => {
    it('should return default when env is empty', () => {
      expect(getInstanceName({})).toBe('default');
      expect(getInstanceName({ ZAVORTH_INSTANCE: '' })).toBe('default');
      expect(getInstanceName({ ZAVORTH_INSTANCE: '  ' })).toBe('default');
    });

    it('should normalize to lowercase', () => {
      expect(getInstanceName({ ZAVORTH_INSTANCE: 'Work' })).toBe('work');
      expect(getInstanceName({ ZAVORTH_INSTANCE: 'MY-PROFILE' })).toBe('my-profile');
    });

    it('should strip invalid characters', () => {
      expect(getInstanceName({ ZAVORTH_INSTANCE: 'my profile!' })).toBe('myprofile');
      expect(getInstanceName({ ZAVORTH_INSTANCE: 'test@#$' })).toBe('test');
    });

    it('should truncate to 64 chars', () => {
      const long = 'a'.repeat(100);
      expect(getInstanceName({ ZAVORTH_INSTANCE: long })).toHaveLength(64);
    });

    it('should return default for default value', () => {
      expect(getInstanceName({ ZAVORTH_INSTANCE: 'default' })).toBe('default');
    });
  });

  describe('resolveInstanceHome', () => {
    it('should return base home for default instance', () => {
      expect(resolveInstanceHome(tmpDir, 'default')).toBe(tmpDir);
    });

    it('should return instances subdirectory for named instance', () => {
      const result = resolveInstanceHome(tmpDir, 'work');
      expect(result).toBe(path.join(tmpDir, 'instances', 'work'));
    });

    it('should handle absolute paths', () => {
      const base = path.resolve('/some/path');
      expect(resolveInstanceHome(base, 'test')).toBe(path.join(base, 'instances', 'test'));
    });
  });

  describe('getDefaultInstanceHome', () => {
    it('should return resolved base path', () => {
      expect(getDefaultInstanceHome(tmpDir)).toBe(tmpDir);
    });
  });

  describe('instanceExists', () => {
    it('should always return true for default', () => {
      expect(instanceExists(tmpDir, 'default')).toBe(true);
    });

    it('should return false for non-existent instance', () => {
      expect(instanceExists(tmpDir, 'nonexistent')).toBe(false);
    });

    it('should return true after creating instance', () => {
      createInstance(tmpDir, 'work');
      expect(instanceExists(tmpDir, 'work')).toBe(true);
    });
  });

  describe('listInstances', () => {
    it('should always include default', () => {
      const instances = listInstances(tmpDir);
      expect(instances).toHaveLength(1);
      expect(instances[0].name).toBe('default');
    });

    it('should list created instances', () => {
      createInstance(tmpDir, 'work');
      createInstance(tmpDir, 'personal');
      const instances = listInstances(tmpDir);
      const names = instances.map((i) => i.name);
      expect(names).toContain('default');
      expect(names).toContain('work');
      expect(names).toContain('personal');
    });
  });

  describe('createInstance', () => {
    it('should create instance directory and subdirectories', () => {
      const info = createInstance(tmpDir, 'work');
      expect(info.name).toBe('work');
      expect(info.exists).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', 'data'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', 'data', 'runtime'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', 'data', 'memory'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', '.zavorth'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', 'memory'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', 'credentials'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', 'logs'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', 'tmp'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'instances', 'work', 'config'))).toBe(true);
    });

    it('should create instance files', () => {
      createInstance(tmpDir, 'work');
      const base = path.join(tmpDir, 'instances', 'work');
      expect(fs.existsSync(path.join(base, 'MEMORY.md'))).toBe(true);
      expect(fs.existsSync(path.join(base, 'IDENTITY.md'))).toBe(true);
      expect(fs.existsSync(path.join(base, 'SOUL.md'))).toBe(true);
      expect(fs.existsSync(path.join(base, 'USER.md'))).toBe(true);
    });

    it('should create metadata file', () => {
      createInstance(tmpDir, 'work');
      const metaPath = path.join(tmpDir, 'instances', 'work', '.instance-meta.json');
      expect(fs.existsSync(metaPath)).toBe(true);
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      expect(meta.name).toBe('work');
      expect(meta.createdAt).toBeDefined();
    });

    it('should throw for default instance', () => {
      expect(() => createInstance(tmpDir, 'default')).toThrow('Cannot create the default instance');
    });

    it('should throw for duplicate instance', () => {
      createInstance(tmpDir, 'work');
      expect(() => createInstance(tmpDir, 'work')).toThrow('already exists');
    });

    it('should throw for invalid name', () => {
      expect(() => createInstance(tmpDir, '')).toThrow('Invalid instance name');
      expect(() => createInstance(tmpDir, 'UPPER')).toThrow('Invalid instance name');
      expect(() => createInstance(tmpDir, 'has space')).toThrow('Invalid instance name');
    });
  });

  describe('deleteInstance', () => {
    it('should delete instance', () => {
      createInstance(tmpDir, 'work');
      expect(instanceExists(tmpDir, 'work')).toBe(true);
      deleteInstance(tmpDir, 'work');
      expect(instanceExists(tmpDir, 'work')).toBe(false);
    });

    it('should throw for default instance', () => {
      expect(() => deleteInstance(tmpDir, 'default')).toThrow('Cannot delete the default instance');
    });

    it('should throw for non-existent instance', () => {
      expect(() => deleteInstance(tmpDir, 'nonexistent')).toThrow('does not exist');
    });
  });

  describe('getInstancePath', () => {
    it('should resolve path within instance', () => {
      createInstance(tmpDir, 'work');
      const result = getInstancePath(tmpDir, 'work', 'data', 'zavorth.db');
      expect(result).toBe(path.join(tmpDir, 'instances', 'work', 'data', 'zavorth.db'));
    });

    it('should resolve path for default instance', () => {
      const result = getInstancePath(tmpDir, 'default', 'data', 'zavorth.db');
      expect(result).toBe(path.join(tmpDir, 'data', 'zavorth.db'));
    });
  });
});
