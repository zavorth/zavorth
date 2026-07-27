
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CreateFileTool } from '../../src/tools/CreateFileTool.js';

// Mock Database to avoid SQLite initialization issues in test environment
jest.mock('../../src/storage/Database.js', () => {
  const mockDb = {
    run: jest.fn(),
    get: jest.fn().mockReturnValue(undefined),
    all: jest.fn().mockReturnValue([]),
    close: jest.fn(),
  };
  return {
    Database: Object.assign(
      jest.fn().mockImplementation(() => mockDb),
      {
        instance: null as unknown,
        initPromise: null as unknown,
        getInstance: jest.fn().mockResolvedValue(mockDb),
        getActiveInstance: jest.fn().mockReturnValue(null),
      }
    ),
  };
});

describe('CreateFileTool', () => {
  const originalCwd = process.cwd();
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-output-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates files inside output/', async () => {
    const tool = new CreateFileTool();
    const response = JSON.parse(await tool.execute({ filepath: 'docs/test.md', content: '# ok' }));

    expect(response.success).toBe(true);
    expect(response.policy).toEqual({
      access: 'write',
      scope: 'workspace_output',
    });
    expect(fs.existsSync(path.join(tempDir, 'output', 'docs', 'test.md'))).toBe(true);
  });

  it('blocks sibling-prefix escapes outside output/', async () => {
    const tool = new CreateFileTool();
    const response = JSON.parse(await tool.execute({ filepath: '../output-evil/pwned.txt', content: 'nope' }));

    expect(response.error).toContain('output/');
    expect(fs.existsSync(path.join(tempDir, 'output-evil', 'pwned.txt'))).toBe(false);
  });
});
