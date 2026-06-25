import fs from 'fs';
import path from 'path';
import os from 'os';
import { ZavorthFileWatcherTool } from '../../src/tools/ZavorthFileWatcherTool';

describe('ZavorthFileWatcherTool', () => {
  let tool: ZavorthFileWatcherTool;
  let tmpDir: string;

  beforeEach(() => {
    tool = new ZavorthFileWatcherTool();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-watcher-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists watchers as empty initially', async () => {
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('No active');
  });

  it('returns error for non-existent watcher stop', async () => {
    const result = await tool.execute({ action: 'stop', watch_id: 'nonexistent' });
    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns error for non-existent watcher status', async () => {
    const result = await tool.execute({ action: 'status', watch_id: 'nonexistent' });
    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns error for non-existent watcher log', async () => {
    const result = await tool.execute({ action: 'log', watch_id: 'nonexistent' });
    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('starts and stops a watcher', async () => {
    const startResult = await tool.execute({ action: 'start', directory: tmpDir });
    expect(startResult).toContain('File watcher started');
    expect(startResult).toContain('ID:');

    const idMatch = startResult.match(/ID:\s*(\S+)/);
    expect(idMatch).toBeTruthy();
    const watchId = idMatch![1];

    const listResult = await tool.execute({ action: 'list' });
    expect(listResult).toContain(watchId);

    const statusResult = await tool.execute({ action: 'status', watch_id: watchId });
    expect(statusResult).toContain('Watcher:');
    expect(statusResult).toContain(tmpDir);

    const stopResult = await tool.execute({ action: 'stop', watch_id: watchId });
    expect(stopResult).toContain('stopped');
    expect(stopResult).toContain('0 events');

    const listAfter = await tool.execute({ action: 'list' });
    expect(listAfter).toContain('No active');
  });

  it('returns error when starting without directory', async () => {
    const result = await tool.execute({ action: 'start' });
    expect(result).toContain('Error');
    expect(result).toContain('directory');
  });

  it('returns error for non-existent directory', async () => {
    const result = await tool.execute({ action: 'start', directory: '/nonexistent/dir' });
    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('event log is empty initially', async () => {
    const startResult = await tool.execute({ action: 'start', directory: tmpDir });
    const idMatch = startResult.match(/ID:\s*(\S+)/);
    const watchId = idMatch![1];

    const logResult = await tool.execute({ action: 'log', watch_id: watchId });
    expect(logResult).toContain('No events');

    await tool.execute({ action: 'stop', watch_id: watchId });
  });

  it('captures file change events', async () => {
    const startResult = await tool.execute({ action: 'start', directory: tmpDir });
    const idMatch = startResult.match(/ID:\s*(\S+)/);
    const watchId = idMatch![1];

    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello', 'utf-8');

    await new Promise(resolve => setTimeout(resolve, 500));

    const logResult = await tool.execute({ action: 'log', watch_id: watchId });
    expect(logResult).toBeTruthy();

    await tool.execute({ action: 'stop', watch_id: watchId });
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
    expect(result).toContain('action');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'restart' });
    expect(result).toContain('Error');
    expect(result).toContain('invalid');
  });
});
