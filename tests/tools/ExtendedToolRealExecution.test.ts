import { BatchTrajectoryTool } from '../../src/tools/BatchTrajectoryTool';
import { DatabaseQueryTool } from '../../src/tools/DatabaseQueryTool';
import { EmailTool } from '../../src/tools/EmailTool';
import { VideoGenerationTool } from '../../src/tools/VideoGenerationTool';

describe('Extended tool real execution boundaries', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does not report video generation success without a configured video backend', async () => {
    delete process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT;
    delete process.env.ZAVORTH_VIDEO_GENERATION_API_KEY;

    const result = await new VideoGenerationTool().execute({ prompt: 'cinematic sunrise' });

    expect(result).toContain('backend de video');
    expect(result).not.toContain('Video gerado com sucesso');
    expect(result).not.toContain('simulado');
  });

  it('does not report email sent without a real SMTP transport', async () => {
    process.env.ZAVORTH_SMTP_HOST = 'smtp.example.test';
    process.env.ZAVORTH_SMTP_USER = 'user';
    process.env.ZAVORTH_SMTP_PASS = 'pass';
    delete process.env.ZAVORTH_SMTP_ALLOW_LIVE_SEND;

    const result = await new EmailTool().execute({
      to: 'dest@example.com',
      subject: 'Hello',
      body: 'Body',
    });

    expect(result).toContain('envio real');
    expect(result).not.toContain('Email sent com sucesso');
  });

  it('does not fabricate batch trajectory model outputs without live execution enabled', async () => {
    delete process.env.ZAVORTH_BATCH_TRAJECTORY_ALLOW_LIVE;

    const result = await new BatchTrajectoryTool().execute({
      trajectories: JSON.stringify([{ prompt: 'Say hi', provider: 'openai' }]),
    });

    expect(result).toMatch(/live batch|real execution|real providers/i);
    expect(result).not.toContain('[Simulated]');
  });

  it('does not simulate database query results when SQLite driver is missing', async () => {
    const result = await new DatabaseQueryTool().execute({ query: 'SELECT 1 AS value' });

    expect(result).not.toContain('[SIMULADO]');
  });
});
