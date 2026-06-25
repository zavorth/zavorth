import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthTrajectoryExportTool } from '../../src/tools/ZavorthTrajectoryExportTool';

describe('ZavorthTrajectoryExportTool', () => {
  let tool: ZavorthTrajectoryExportTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'traj-test-'));

    const trajectory = {
      id: 'traj_001',
      session_id: 'session_1',
      task_description: 'Build a REST API',
      turns: [
        { role: 'user', content: 'Build a REST API for users', timestamp: '2025-06-01T10:00:00Z' },
        { role: 'assistant', content: 'I will create the API with Express.', timestamp: '2025-06-01T10:00:05Z', tool_calls: [{ name: 'create_file', args: { path: 'server.js' } }] },
        { role: 'tool', content: 'File created successfully', timestamp: '2025-06-01T10:00:06Z' },
        { role: 'assistant', content: 'API created with GET and POST endpoints.', timestamp: '2025-06-01T10:00:10Z' },
      ],
      outcome: 'success',
      total_turns: 4,
      total_tool_calls: 1,
      tools_used: ['create_file'],
      duration_ms: 10000,
      started_at: '2025-06-01T10:00:00Z',
      completed_at: '2025-06-01T10:00:10Z',
      metadata: { model: 'gpt-4o' },
    };

    const trajectory2 = {
      ...trajectory,
      id: 'traj_002',
      task_description: 'Fix a bug in login',
      outcome: 'failure',
      total_tool_calls: 3,
      tools_used: ['read_file', 'edit_file', 'run_command'],
    };

    fs.writeFileSync(path.join(tempDir, 'traj_001.json'), JSON.stringify(trajectory));
    fs.writeFileSync(path.join(tempDir, 'traj_002.json'), JSON.stringify(trajectory2));

    tool = new ZavorthTrajectoryExportTool({ trajectoriesDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_trajectory_export');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('lists trajectories', async () => {
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('traj_001');
    expect(result).toContain('traj_002');
    expect(result).toContain('2');
  });

  it('gets stats', async () => {
    const result = await tool.execute({ action: 'stats' });
    expect(result).toContain('Statistics');
    expect(result).toContain('success');
    expect(result).toContain('failure');
    expect(result).toContain('create_file');
  });

  it('exports as JSON', async () => {
    const result = await tool.execute({ action: 'export', format: 'json' });
    expect(result).toContain('traj_001');
    expect(result).toContain('Build a REST API');
  });

  it('exports as JSONL', async () => {
    const result = await tool.execute({ action: 'export', format: 'jsonl' });
    expect(result).toContain('traj_001');
  });

  it('exports as CSV', async () => {
    const result = await tool.execute({ action: 'export', format: 'csv' });
    expect(result).toContain('id,session_id');
    expect(result).toContain('traj_001');
  });

  it('exports as markdown', async () => {
    const result = await tool.execute({ action: 'export', format: 'markdown' });
    expect(result).toContain('Trajetorias Exportadas');
    expect(result).toContain('Build a REST API');
  });

  it('exports as alpaca format', async () => {
    const result = await tool.execute({ action: 'export', format: 'alpaca' });
    expect(result).toContain('instruction');
    expect(result).toContain('output');
  });

  it('exports as sharegpt format', async () => {
    const result = await tool.execute({ action: 'export', format: 'sharegpt' });
    expect(result).toContain('conversations');
    expect(result).toContain('human');
  });

  it('filters by outcome', async () => {
    const result = await tool.execute({ action: 'export', outcome_filter: 'failure' });
    expect(result).toContain('traj_002');
    expect(result).not.toContain('traj_001');
  });

  it('saves export to file', async () => {
    const outputPath = path.join(tempDir, 'export.json');
    const result = await tool.execute({
      action: 'export',
      format: 'json',
      output_path: outputPath,
    });
    expect(result).toContain('Exportado');
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('filters trajectories', async () => {
    const result = await tool.execute({ action: 'filter', outcome_filter: 'success' });
    expect(result).toContain('1 de 2');
  });

  it('merges trajectories', async () => {
    const outputPath = path.join(tempDir, 'merged.json');
    const result = await tool.execute({
      action: 'merge',
      trajectory_ids: JSON.stringify(['traj_001', 'traj_002']),
      output_path: outputPath,
    });
    expect(result).toContain('Merge');
    expect(result).toContain('2');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'dance' });
    expect(result).toContain('Error');
  });
});
