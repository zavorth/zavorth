import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthCronSchedulerTool } from '../../src/tools/ZavorthCronSchedulerTool';

describe('ZavorthCronSchedulerTool', () => {
  let tool: ZavorthCronSchedulerTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-test-'));
    tool = new ZavorthCronSchedulerTool({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_cron_scheduler');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
    expect(result).toContain('action');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'invalid' });
    expect(result).toContain('Erro');
    expect(result).toContain('invalida');
  });

  it('creates a cron job', async () => {
    const result = await tool.execute({
      action: 'create',
      name: 'Daily Report',
      schedule: '0 9 * * *',
      task_description: 'Generate daily report',
    });
    expect(result).toContain('criado com sucesso');
    expect(result).toContain('daily_report');
    expect(result).toContain('cron');
  });

  it('creates an interval job', async () => {
    const result = await tool.execute({
      action: 'create',
      name: 'Health Check',
      schedule: '60000',
      schedule_type: 'interval',
      interval_ms: 60000,
      task_description: 'Check system health',
    });
    expect(result).toContain('criado com sucesso');
    expect(result).toContain('interval');
  });

  it('lists jobs', async () => {
    await tool.execute({ action: 'create', name: 'Job1', schedule: '0 * * * *', task_description: 'Task 1' });
    await tool.execute({ action: 'create', name: 'Job2', schedule: '0 0 * * *', task_description: 'Task 2' });
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('Job1');
    expect(result).toContain('Job2');
  });

  it('gets job status', async () => {
    await tool.execute({ action: 'create', name: 'StatusJob', schedule: '0 * * * *', task_description: 'Check status' });
    const result = await tool.execute({ action: 'status', job_id: 'statusjob' });
    expect(result).toContain('StatusJob');
    expect(result).toContain('cron');
  });

  it('enables and disables a job', async () => {
    await tool.execute({ action: 'create', name: 'ToggleJob', schedule: '0 * * * *', task_description: 'Toggle me' });
    const disable = await tool.execute({ action: 'disable', job_id: 'togglejob' });
    expect(disable).toContain('desabilitado');
    const enable = await tool.execute({ action: 'enable', job_id: 'togglejob' });
    expect(enable).toContain('habilitado');
  });

  it('runs a job now', async () => {
    await tool.execute({ action: 'create', name: 'RunNow', schedule: '0 * * * *', task_description: 'Run me' });
    const result = await tool.execute({ action: 'run_now', job_id: 'runnow' });
    expect(result).toContain('disparado manualmente');
  });

  it('deletes a job', async () => {
    await tool.execute({ action: 'create', name: 'DeleteMe', schedule: '0 * * * *', task_description: 'Delete me' });
    const result = await tool.execute({ action: 'delete', job_id: 'deleteme' });
    expect(result).toContain('deletado');
  });

  it('updates a job', async () => {
    await tool.execute({ action: 'create', name: 'UpdateMe', schedule: '0 * * * *', task_description: 'Original' });
    const result = await tool.execute({ action: 'update', job_id: 'updateme', task_description: 'Updated task' });
    expect(result).toContain('atualizado');
  });

  it('infers high risk for destructive tasks', async () => {
    const result = await tool.execute({
      action: 'create',
      name: 'DangerousJob',
      schedule: '0 * * * *',
      task_description: 'Delete all files from temp',
    });
    expect(result).toContain('critical');
  });

  it('returns error for missing job_id on status', async () => {
    const result = await tool.execute({ action: 'status' });
    expect(result).toContain('Erro');
    expect(result).toContain('job_id');
  });
});
