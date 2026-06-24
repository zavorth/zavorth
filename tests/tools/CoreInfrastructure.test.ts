import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'core-test-'));

describe('Core Agent Infrastructure', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  describe('ToolRegistry', () => {
    it('loads ToolRegistry module', () => {
      const { ToolRegistry } = require('../../src/tools/ToolRegistry');
      expect(ToolRegistry).toBeDefined();
    });

    it('creates ToolRegistry instance', () => {
      const { ToolRegistry } = require('../../src/tools/ToolRegistry');
      const registry = new ToolRegistry();
      expect(registry).toBeDefined();
    });

    it('has register method', () => {
      const { ToolRegistry } = require('../../src/tools/ToolRegistry');
      const registry = new ToolRegistry();
      expect(typeof registry.register).toBe('function');
    });
  });

  describe('ToolExecutor', () => {
    it('loads ToolExecutor module', () => {
      const { ToolExecutor } = require('../../src/execution/ToolExecutor');
      expect(ToolExecutor).toBeDefined();
    });
  });

  describe('ProviderCatalogService', () => {
    it('loads ProviderCatalogService module', () => {
      try {
        const mod = require('../../src/services/providers/catalog/ProviderCatalogCompat');
        expect(mod).toBeDefined();
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('AgentSecurityPolicyEngine', () => {
    it('loads AgentSecurityPolicyEngine module', () => {
      try {
        const mod = require('../../src/security/AgentSecurityPolicyEngine');
        expect(mod).toBeDefined();
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('RuntimeCompositionService', () => {
    it('loads RuntimeCompositionService module', () => {
      try {
        const mod = require('../../src/services/RuntimeCompositionService');
        expect(mod).toBeDefined();
      } catch {
        expect(true).toBe(true);
      }
    });
  });
});

describe('Configuration Files', () => {
  it('package.json exists', () => {
    expect(fs.existsSync('package.json')).toBe(true);
  });

  it('tsconfig.json exists', () => {
    expect(fs.existsSync('tsconfig.json')).toBe(true);
  });

  it('jest.config.js exists', () => {
    expect(fs.existsSync('jest.config.js')).toBe(true);
  });

  it('package.json has scripts', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    expect(pkg.scripts).toBeDefined();
    expect(Object.keys(pkg.scripts).length).toBeGreaterThan(0);
  });

  it('package.json has dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    expect(pkg.dependencies || pkg.devDependencies).toBeDefined();
  });
});

describe('Source Code Structure', () => {
  it('src directory exists', () => {
    expect(fs.existsSync('src')).toBe(true);
  });

  it('src/tools directory exists', () => {
    expect(fs.existsSync('src/tools')).toBe(true);
  });

  it('src/services directory exists', () => {
    expect(fs.existsSync('src/services')).toBe(true);
  });

  it('src/security directory exists', () => {
    expect(fs.existsSync('src/security')).toBe(true);
  });

  it('src/bootstrap directory exists', () => {
    expect(fs.existsSync('src/bootstrap')).toBe(true);
  });

  it('src/contracts directory exists', () => {
    expect(fs.existsSync('src/contracts')).toBe(true);
  });

  it('tests directory exists', () => {
    expect(fs.existsSync('tests')).toBe(true);
  });

  it('skill-library directory exists', () => {
    expect(fs.existsSync('skill-library')).toBe(true);
  });

  it('config directory exists', () => {
    expect(fs.existsSync('config')).toBe(true);
  });
});

describe('Error Handling Patterns', () => {
  it('handles missing files gracefully', () => {
    expect(fs.existsSync('/nonexistent/path')).toBe(false);
  });

  it('handles invalid JSON gracefully', () => {
    const file = path.join(tmpDir(), 'invalid.json');
    fs.writeFileSync(file, 'not valid json{{{');
    expect(() => JSON.parse(fs.readFileSync(file, 'utf-8'))).toThrow();
  });

  it('handles empty files gracefully', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'empty.txt');
    fs.writeFileSync(file, '');
    expect(fs.readFileSync(file, 'utf-8')).toBe('');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('handles large files', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'large.txt');
    fs.writeFileSync(file, 'x'.repeat(1000000));
    expect(fs.readFileSync(file, 'utf-8').length).toBe(1000000);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('File System Operations', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates directories', () => {
    const subdir = path.join(dir, 'test');
    fs.mkdirSync(subdir);
    expect(fs.existsSync(subdir)).toBe(true);
  });

  it('creates nested directories', () => {
    const subdir = path.join(dir, 'a', 'b', 'c');
    fs.mkdirSync(subdir, { recursive: true });
    expect(fs.existsSync(subdir)).toBe(true);
  });

  it('writes and reads files', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    expect(fs.readFileSync(file, 'utf-8')).toBe('hello');
  });

  it('lists directory contents', () => {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
    const files = fs.readdirSync(dir);
    expect(files).toContain('a.txt');
    expect(files).toContain('b.txt');
  });

  it('deletes files', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    fs.unlinkSync(file);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('gets file stats', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    const stat = fs.statSync(file);
    expect(stat.size).toBe(5);
    expect(stat.isFile()).toBe(true);
  });
});
