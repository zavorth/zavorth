import { ZavorthSchedulerTool } from '../../src/tools/ZavorthSchedulerTool.js';

describe('ZavorthSchedulerTool', () => {
  let createdJobId: string;

  it('should create a new scheduled job via tool execute', async () => {
    const rawResult = await ZavorthSchedulerTool.execute({
      action: 'create',
      name: 'Automated Test Runner',
      description: 'Runs test suite periodically',
      prompt: 'Execute npm test and report failures',
      scheduleKind: 'every',
      scheduleExpr: '1h',
      deliveryChannels: ['cli'],
    });

    const parsed = JSON.parse(rawResult);
    expect(parsed.status).toBe('success');
    expect(parsed.action).toBe('create');
    expect(parsed.job).toBeDefined();
    expect(parsed.job.name).toBe('Automated Test Runner');
    createdJobId = parsed.job.id;
  });

  it('should list all scheduled jobs', async () => {
    const rawResult = await ZavorthSchedulerTool.execute({
      action: 'list',
    });

    const parsed = JSON.parse(rawResult);
    expect(parsed.status).toBe('success');
    expect(parsed.total).toBeGreaterThanOrEqual(1);
  });

  it('should update an existing job', async () => {
    const rawResult = await ZavorthSchedulerTool.execute({
      action: 'update',
      jobId: createdJobId,
      name: 'Automated Test Runner (Updated)',
      enabled: false,
    });

    const parsed = JSON.parse(rawResult);
    expect(parsed.status).toBe('success');
    expect(parsed.job.name).toBe('Automated Test Runner (Updated)');
    expect(parsed.job.enabled).toBe(false);
  });

  it('should run a job immediately with run_now', async () => {
    const rawResult = await ZavorthSchedulerTool.execute({
      action: 'run_now',
      jobId: createdJobId,
    });

    const parsed = JSON.parse(rawResult);
    expect(parsed.status).toBe('success');
    expect(parsed.run).toBeDefined();
    expect(parsed.run.status).toBe('success');
  });

  it('should get execution history and scheduler metrics', async () => {
    const historyRaw = await ZavorthSchedulerTool.execute({
      action: 'get_history',
      jobId: createdJobId,
    });
    const historyParsed = JSON.parse(historyRaw);
    expect(historyParsed.status).toBe('success');
    expect(historyParsed.totalRuns).toBeGreaterThanOrEqual(1);

    const metricsRaw = await ZavorthSchedulerTool.execute({
      action: 'get_metrics',
    });
    const metricsParsed = JSON.parse(metricsRaw);
    expect(metricsParsed.status).toBe('success');
    expect(metricsParsed.metrics.totalRuns).toBeGreaterThanOrEqual(1);
  });

  it('should delete the scheduled job', async () => {
    const rawResult = await ZavorthSchedulerTool.execute({
      action: 'delete',
      jobId: createdJobId,
    });

    const parsed = JSON.parse(rawResult);
    expect(parsed.status).toBe('success');
  });
});
