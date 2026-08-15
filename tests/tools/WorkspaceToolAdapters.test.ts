
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ToolRuntimeService } from '../../src/services/tools/ToolRuntimeService.js';

import {
  WorkspaceListTool,
  WorkspaceReadTool,
  WorkspaceWriteTool,
} from '../../src/tools/workspace/index.js';

describe('Workspace tool adapters', () => {
  const originalCwd = path.resolve(__dirname, '../../');
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-adapters-'));
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

  it('exposes workspace adapter names through the existing runtime catalog', () => {
    const tools = [
      new WorkspaceReadTool(),
      new WorkspaceListTool(),
      new WorkspaceWriteTool(),
    ];
    const runtime = new ToolRuntimeService(
      {
        getToolDefinitions: jest.fn().mockReturnValue([]),
        getAllTools: jest.fn().mockReturnValue(tools),
        getTool: jest.fn((name: string) => tools.find((tool) => tool.name === name)),
      } as any,
      {
        executeTool: jest.fn(),
      } as any,
    );

    expect(runtime.listToolsByGroup('workspace').map((tool) => tool.id)).toEqual([
      'workspace.read',
      'workspace.list',
      'workspace.write',
    ]);
  });

  it('delegates read, list and write behavior to the current legacy aliases', async () => {
    const readTool = new WorkspaceReadTool();
    const listTool = new WorkspaceListTool();
    const writeTool = new WorkspaceWriteTool();

    await expect(readTool.execute({ filePath: 'README.md' })).resolves.toBe('# ok');
    await expect(listTool.execute({ dirPath: '.' })).resolves.toContain('[FILE] README.md');

    const writeResult = JSON.parse(await writeTool.execute({
      filepath: 'notes/result.md',
      content: 'done',
    }));
    expect(writeResult).toEqual(expect.objectContaining({
      success: true,
      policy: {
        access: 'write',
        scope: 'workspace_output',
      },
    }));
    expect(fs.existsSync(path.join(tempDir, 'output', 'notes', 'result.md'))).toBe(true);
  });
});
