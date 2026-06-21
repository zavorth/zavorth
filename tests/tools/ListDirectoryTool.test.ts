import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ListDirectoryTool } from '../../src/tools/ListDirectoryTool.js';

describe('ListDirectoryTool', () => {
  const originalCwd = process.cwd();
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-list-directory-'));
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# ok', 'utf8');
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists directories inside the current workspace through WorkspaceFsPolicy', async () => {
    const tool = new ListDirectoryTool();
    const output = await tool.execute({ dirPath: '.' });

    expect(output).toContain('[DIR]  src');
    expect(output).toContain('[FILE] README.md');
  });

  it('blocks directory listings that escape the current workspace', async () => {
    const tool = new ListDirectoryTool();

    await expect(tool.execute({ dirPath: '..' })).resolves.toContain('dentro do workspace atual');
  });
});
