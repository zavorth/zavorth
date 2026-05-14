import fs from 'fs';
import os from 'os';
import path from 'path';
import { createTwoFilesPatch } from 'diff';
import { ToolRuntimeService } from '../../src/services/tools/ToolRuntimeService.js';
import {
  WorkspaceApplyPatchTool,
  WorkspaceEditTool,
} from '../../src/tools/workspace/index.js';

describe('Workspace patch/edit tools', () => {
  const originalCwd = process.cwd();
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-patch-'));
    fs.mkdirSync(path.join(tempDir, 'output', 'notes'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'output', 'notes', 'item.txt'), 'one\n', 'utf8');
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('exposes edit and apply patch adapters in the workspace catalog group', () => {
    const tools = [
      new WorkspaceEditTool(),
      new WorkspaceApplyPatchTool(),
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
      'workspace.edit',
      'workspace.apply_patch',
    ]);
  });

  it('applies a unified patch and returns an auditable diff result', async () => {
    const patch = createTwoFilesPatch(
      'notes/item.txt',
      'notes/item.txt',
      'one\n',
      'two\n',
      'current',
      'proposed',
    );
    const result = JSON.parse(await new WorkspaceApplyPatchTool().execute({
      filepath: 'notes/item.txt',
      patch,
    }));

    expect(result).toEqual(expect.objectContaining({
      success: true,
      applied: true,
      policy: {
        access: 'apply_patch',
        scope: 'workspace_output',
      },
    }));
    expect(result.audit.diffPatch).toContain('-one');
    expect(result.audit.diffPatch).toContain('+two');
    expect(fs.readFileSync(path.join(tempDir, 'output', 'notes', 'item.txt'), 'utf8')).toBe('two\n');
  });

  it('rejects an incompatible patch without changing the target file', async () => {
    const patch = createTwoFilesPatch(
      'notes/item.txt',
      'notes/item.txt',
      'alpha\n',
      'beta\n',
      'current',
      'proposed',
    );
    const result = JSON.parse(await new WorkspaceApplyPatchTool().execute({
      filepath: 'notes/item.txt',
      patch,
    }));

    expect(result.success).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.error).toContain('Patch invalido');
    expect(fs.readFileSync(path.join(tempDir, 'output', 'notes', 'item.txt'), 'utf8')).toBe('one\n');
  });

  it('previews exact edits with an auditable diff without writing on dry run', async () => {
    const result = JSON.parse(await new WorkspaceEditTool().execute({
      filepath: 'notes/item.txt',
      search: 'one',
      replace: 'two',
      dryRun: true,
    }));

    expect(result).toEqual(expect.objectContaining({
      success: true,
      applied: false,
      dryRun: true,
      policy: {
        access: 'edit',
        scope: 'workspace_output',
      },
    }));
    expect(result.audit.diffPatch).toContain('-one');
    expect(result.audit.diffPatch).toContain('+two');
    expect(fs.readFileSync(path.join(tempDir, 'output', 'notes', 'item.txt'), 'utf8')).toBe('one\n');
  });
});
