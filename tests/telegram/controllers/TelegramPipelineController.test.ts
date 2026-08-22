import { TelegramPipelineController } from '../../../src/telegram/controllers/TelegramPipelineController';

interface MockPipelineService {
  runReviewPipeline: jest.Mock;
  runWorkflow: jest.Mock;
  runSddLoop: jest.Mock;
  resumeWorkflow: jest.Mock;
  closeWorkflowRun?: jest.Mock;
}

describe('TelegramPipelineController', () => {
  it('routes ExternalExecutor review through the shared review pipeline', async () => {
    const ctx = {} as unknown as never;
    const runReviewPipeline = jest.fn().mockResolvedValue(undefined);
    const getDefaultWorkspace = jest.fn().mockReturnValue('C:/repo');
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline } as unknown as MockPipelineService),
      getDefaultWorkspace,
    );

    await controller.handleExternalExecutorReview(ctx, 'revisar ultimo ajuste');

    expect(getDefaultWorkspace).toHaveBeenCalledWith('/external_review');
    expect(runReviewPipeline).toHaveBeenCalledWith(ctx, 'revisar ultimo ajuste', 'C:/repo');
  });

  it('routes /workflow ship through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const getDefaultWorkspace = jest.fn().mockReturnValue('C:/repo');
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as unknown as MockPipelineService),
      getDefaultWorkspace,
    );

    await controller.handleWorkflow(ctx, 'ship implemente a tela inicial');

    expect(getDefaultWorkspace).toHaveBeenCalledWith('/workflow');
    expect(runWorkflow).toHaveBeenCalledWith(ctx, 'ship', 'implemente a tela inicial', 'C:/repo');
  });

  it('routes /workflow sdd through the native SDD loop pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const getDefaultWorkspace = jest.fn().mockReturnValue('C:/repo');
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as unknown as MockPipelineService),
      getDefaultWorkspace,
    );

    await controller.handleWorkflow(ctx, 'sdd multisurface/shared-command-contract');

    expect(getDefaultWorkspace).toHaveBeenCalledWith('/workflow');
    expect(runWorkflow).not.toHaveBeenCalled();
    expect(runSddLoop).toHaveBeenCalledWith(ctx, 'multisurface/shared-command-contract', 'C:/repo');
  });

  it('routes /workflow resume through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as unknown as MockPipelineService),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'resume wf-ship-abc123');

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(resumeWorkflow).toHaveBeenCalledWith(ctx, 'wf-ship-abc123', undefined);
  });

  it('routes /workflow resume with a specific stage through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as unknown as MockPipelineService),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'resume wf-ship-abc123 review');

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(resumeWorkflow).toHaveBeenCalledWith(ctx, 'wf-ship-abc123', { stageId: 'review' });
  });

  it('routes /workflow restart-stage with a specific stage through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as unknown as MockPipelineService),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'restart-stage wf-ship-abc123 draft');

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(resumeWorkflow).toHaveBeenCalledWith(ctx, 'wf-ship-abc123', { stageId: 'draft' });
  });

  it('routes /workflow close through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const closeWorkflowRun = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow, closeWorkflowRun } as unknown as MockPipelineService),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'close wf-ship-abc123');

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(closeWorkflowRun).toHaveBeenCalledWith(ctx, 'wf-ship-abc123', { surface: 'telegram' });
  });

  it('guides the user when /workflow is missing type or objective', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow: jest.fn(), runSddLoop: jest.fn(), resumeWorkflow: jest.fn() } as unknown as MockPipelineService),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, '');
    await controller.handleWorkflow(ctx, 'research');
    await controller.handleWorkflow(ctx, 'sdd');

    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toContain('Use /workflow <type> <objective>.');
    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toMatch(/Available workflows|workflows:/i);
    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toMatch(/review|ship|research|sdd/i);
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toMatch(/Missing objective|objective|Faltou o objetivo|objetivo/i);
    expect(String(ctx.reply.mock.calls[2]?.[0] ?? '')).toMatch(/workflow sdd|sdd/i);
  });

  it('guides the user when /workflow resume is missing a run id', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow: jest.fn(), runSddLoop: jest.fn(), resumeWorkflow: jest.fn() } as unknown as MockPipelineService),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'resume');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Missing workflow identifier');
  });

  it('guides the user when /workflow restart-stage is missing the stage', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow: jest.fn(), runSddLoop: jest.fn(), resumeWorkflow: jest.fn() } as unknown as MockPipelineService),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'restart-stage wf-ship-abc123');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Missing stage to restart');
  });

  it('guides the user when /workflow close is missing a run id', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const controller = new TelegramPipelineController(
      () => ({
        runReviewPipeline: jest.fn(),
        runWorkflow: jest.fn(),
        runSddLoop: jest.fn(),
        resumeWorkflow: jest.fn(),
        closeWorkflowRun: jest.fn(),
      } as unknown as MockPipelineService),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'close');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Missing workflow identifier');
  });
});
