import { TelegramPipelineController } from '../../../src/telegram/controllers/TelegramPipelineController';

describe('TelegramPipelineController', () => {
it('routes ExternalExecutor review through the shared review pipeline', async () => {
    const ctx = {} as any;
    const runReviewPipeline = jest.fn().mockResolvedValue(undefined);
    const getDefaultWorkspace = jest.fn().mockReturnValue('C:/repo');
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline } as any),
      getDefaultWorkspace,
    );

    await controller.handleExternalExecutorReview(ctx, 'revisar ultimo ajuste');

    expect(getDefaultWorkspace).toHaveBeenCalledWith('/external_review');
    expect(runReviewPipeline).toHaveBeenCalledWith(ctx, 'revisar ultimo ajuste', 'C:/repo');
  });

  it('routes /workflow ship through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const getDefaultWorkspace = jest.fn().mockReturnValue('C:/repo');
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as any),
      getDefaultWorkspace,
    );

    await controller.handleWorkflow(ctx, 'ship implemente a tela inicial');

    expect(getDefaultWorkspace).toHaveBeenCalledWith('/workflow');
    expect(runWorkflow).toHaveBeenCalledWith(ctx, 'ship', 'implemente a tela inicial', 'C:/repo');
  });

  it('routes /workflow sdd through the native SDD loop pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const getDefaultWorkspace = jest.fn().mockReturnValue('C:/repo');
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as any),
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
    } as any;
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as any),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'resume wf-ship-abc123');

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(resumeWorkflow).toHaveBeenCalledWith(ctx, 'wf-ship-abc123', undefined);
  });

  it('routes /workflow resume with a specific stage through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as any),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'resume wf-ship-abc123 review');

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(resumeWorkflow).toHaveBeenCalledWith(ctx, 'wf-ship-abc123', { stageId: 'review' });
  });

  it('routes /workflow restart-stage with a specific stage through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow } as any),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'restart-stage wf-ship-abc123 draft');

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(resumeWorkflow).toHaveBeenCalledWith(ctx, 'wf-ship-abc123', { stageId: 'draft' });
  });

  it('routes /workflow close through the shared workflow pipeline', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const runWorkflow = jest.fn().mockResolvedValue(undefined);
    const runSddLoop = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflow = jest.fn().mockResolvedValue(undefined);
    const closeWorkflowRun = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow, runSddLoop, resumeWorkflow, closeWorkflowRun } as any),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'close wf-ship-abc123');

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(closeWorkflowRun).toHaveBeenCalledWith(ctx, 'wf-ship-abc123', { surface: 'telegram' });
  });

  it('guides the user when /workflow is missing type or objective', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow: jest.fn(), runSddLoop: jest.fn(), resumeWorkflow: jest.fn() } as any),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, '');
    await controller.handleWorkflow(ctx, 'research');
    await controller.handleWorkflow(ctx, 'sdd');

    expect(ctx.reply).toHaveBeenNthCalledWith(1, expect.stringContaining('Use /workflow <tipo> <objetivo>.'));
    expect(ctx.reply).toHaveBeenNthCalledWith(1, expect.stringContaining('Workflows disponiveis:'));
    expect(ctx.reply).toHaveBeenNthCalledWith(1, expect.stringContaining('executa, revisa e fecha com um parecer final'));
    expect(ctx.reply).toHaveBeenNthCalledWith(2, expect.stringContaining('Faltou o objetivo.'));
    expect(ctx.reply).toHaveBeenNthCalledWith(3, expect.stringContaining('/workflow sdd multisurface/shared-command-contract'));
  });

  it('guides the user when /workflow resume is missing a run id', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow: jest.fn(), runSddLoop: jest.fn(), resumeWorkflow: jest.fn() } as any),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'resume');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Faltou o identificador do workflow.'));
  });

  it('guides the user when /workflow restart-stage is missing the stage', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramPipelineController(
      () => ({ runReviewPipeline: jest.fn(), runWorkflow: jest.fn(), runSddLoop: jest.fn(), resumeWorkflow: jest.fn() } as any),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'restart-stage wf-ship-abc123');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Faltou a etapa para reiniciar.'));
  });

  it('guides the user when /workflow close is missing a run id', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramPipelineController(
      () => ({
        runReviewPipeline: jest.fn(),
        runWorkflow: jest.fn(),
        runSddLoop: jest.fn(),
        resumeWorkflow: jest.fn(),
        closeWorkflowRun: jest.fn(),
      } as any),
      jest.fn().mockReturnValue('C:/repo'),
    );

    await controller.handleWorkflow(ctx, 'close');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Faltou o identificador do workflow.'));
  });
});
