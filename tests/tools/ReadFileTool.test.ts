
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ReadFileTool } from '../../src/tools/ReadFileTool.js';

describe('ReadFileTool', () => {
  const originalCwd = process.cwd();
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-read-file-'));
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# ok', 'utf8');
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reads files inside the current workspace through WorkspaceFsPolicy', async () => {
    const tool = new ReadFileTool();

    await expect(tool.execute({ filePath: 'README.md' })).resolves.toBe('# ok');
  });

  it('blocks reads that escape the current workspace', async () => {
    const outsidePath = path.join(path.dirname(tempDir), 'outside-read.txt');
    fs.writeFileSync(outsidePath, 'nope', 'utf8');
    const tool = new ReadFileTool();

    await expect(tool.execute({ filePath: '../outside-read.txt' })).resolves.toContain(
      'dentro do workspace atual',
    );
    fs.rmSync(outsidePath, { force: true });
  });

  it('blocks direct reads of .env secrets inside the workspace', async () => {
    fs.writeFileSync(path.join(tempDir, '.env'), 'OPENAI_API_KEY=secret', 'utf8');
    const tool = new ReadFileTool();

    await expect(tool.execute({ filePath: '.env' })).resolves.toContain('Por seguranca');
  });
});
