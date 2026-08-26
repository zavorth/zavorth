import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthDelegateTool } from '../../src/tools/ZavorthDelegateTool';

describe('ZavorthDelegateTool', () => {
  let tool: ZavorthDelegateTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delegate-test-'));
    tool = new ZavorthDelegateTool({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_delegate');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('delegates a task', async () => {
    const result = await tool.execute({
      action: 'delegate',
      task_description: 'Research about TypeScript generics',
      role: 'researcher',
    });
    expect(result).toContain('Delegated task created');
    expect(result).toContain('researcher');
  });

  it('delegates a batch of tasks', async () => {
    const result = await tool.execute({
      action: 'delegate_batch',
      tasks: JSON.stringify([
        { task_description: 'Task 1', role: 'leaf' },
        { task_description: 'Task 2', role: 'executor' },
        { task_description: 'Task 3', role: 'reviewer' },
      ]),
    });
    expect(result).toContain('Batch');
    expect(result).toContain('3 tasks');
  });

  it('lists delegated tasks', async () => {
    await tool.execute({ action: 'delegate', task_description: 'Task A' });
    await tool.execute({ action: 'delegate', task_description: 'Task B' });
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('2');
  });

  it('gets task status', async () => {
    const delegate = await tool.execute({ action: 'delegate', task_description: 'Check me' });
    const idMatch = delegate.match(/ID: (del_\w+)/);
    expect(idMatch).toBeTruthy();
    const result = await tool.execute({ action: 'status', task_id: idMatch![1] });
    expect(result).toContain('Check me');
    expect(result).toContain('pending');
  });

  it('cancels a task', async () => {
    const delegate = await tool.execute({ action: 'delegate', task_description: 'Cancel me' });
    const idMatch = delegate.match(/ID: (del_\w+)/);
    const result = await tool.execute({ action: 'cancel', task_id: idMatch![1] });
    expect(result).toContain('cancelled');
  });

  it('returns error for invalid role', async () => {
    const result = await tool.execute({
      action: 'delegate',
      task_description: 'Bad role',
      role: 'invalid_role',
    });
    expect(result).toContain('Error');
    expect(result).toContain('role');
  });

  it('returns error for missing task_description', async () => {
    const result = await tool.execute({ action: 'delegate' });
    expect(result).toContain('Error');
    expect(result).toContain('task_description');
  });

  it('supports hierarchical delegation', async () => {
    const parent = await tool.execute({ action: 'delegate', task_description: 'Parent task' });
    const parentId = parent.match(/ID: (del_\w+)/)![1];
    const child = await tool.execute({
      action: 'delegate',
      task_description: 'Child task',
      parent_id: parentId,
    });
    expect(child).toContain('Parent: ' + parentId);
  });

  it('supports asynchronous background delegation', async () => {
    const result = await tool.execute({
      action: 'delegate',
      task_description: 'Build backend API in background',
      background: true,
    });
    expect(result).toContain('Delegated task created with execution plan');
    expect(result).toContain('planned (no background execution');
    expect(result).toContain('No specialist work was executed');
  });
});
