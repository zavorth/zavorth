import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthBridgeAdapter } from '../../src/agents/ZavorthBridgeAdapter';

jest.mock('../../src/agents/ZavorthBridgeAdapter', () => ({
  ZavorthBridgeAdapter: jest.fn().mockImplementation(() => ({
    generatePlan: jest.fn().mockResolvedValue({
      objective: 'Safe plan',
      executor_recommendation: 'local_executor',
      workspace_recommendation: 'core',
      risk_level: 0,
      steps: [],
    }),
  })),
}));


import { MailboxProtocol } from '../../src/orchestrator/MailboxProtocol';
import { MailboxWatcher } from '../../src/orchestrator/MailboxWatcher';
import { createTestLogRepo } from '../helpers/testLogRepoUtils.js';

function createPendingTask() {
  return {
    task_id: 'task-auto-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: 'system',
    chat_id: 'SYSTEM',
    user_id: 'SYSTEM',
    raw_message: '',
    normalized_message: '',
    command_type: '/auto_bridge',
    intent: 'unknown',
    target: null,
    workspace: null,
    risk_level: 0,
    status: 'pending',
    requires_planning: false,
    requires_approval: false,
    approval_status: 'not_required',
    planner_used: null,
    executor_used: null,
    fallback_used: false,
    parent_task_id: null,
    actions_planned: [],
    actions_executed: [],
    target_files: [],
    artifacts: [],
    stdout_summary: null,
    stderr_summary: null,
    diff_summary: null,
    result_summary: null,
    error_summary: null,
    rollback_available: false,
    metadata: {},
  } as any;
}

describe('MailboxWatcher', () => {
  let tmpDir: string;
  let inboxDir: string;
  let processedDir: string;
  let rejectedDir: string;
  let runtimeDir: string;
  let seenDir: string;
  let statusFilePath: string;
  let protocol: MailboxProtocol;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mailbox-'));
    inboxDir = path.join(tmpDir, 'inbox');
    processedDir = path.join(tmpDir, 'processed');
    rejectedDir = path.join(tmpDir, 'rejected');
    runtimeDir = path.join(tmpDir, 'runtime');
    seenDir = path.join(runtimeDir, 'seen');
    statusFilePath = path.join(runtimeDir, 'last-status.txt');
    fs.mkdirSync(inboxDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
    fs.mkdirSync(rejectedDir, { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.mkdirSync(seenDir, { recursive: true });
    protocol = new MailboxProtocol({
      secret: 'watcher-test-secret',
      allowLegacy: false,
      maxAgeMs: 60_000,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    jest.clearAllMocks();
  });

  it('rejects unsigned payloads', async () => {
    const legacyFile = path.join(inboxDir, 'legacy.msg');
    fs.writeFileSync(
      legacyFile,
      [
        '[SENDER: TELEGRAM_USER]',
        '[AGENT: ZAVORTH_BRIDGE]',
        '[ACTION: PLAN_AND_EXECUTE]',
        '[TASK_ID: legacy-task]',
        '[PROMPT: corrija isso]',
        '[WORKSPACE: AUTO]',
        '---',
        '[END_OF_MESSAGE]',
        '',
      ].join('\n'),
      'utf8',
    );

    const taskManager = {
      createPendingTask: jest.fn().mockReturnValue(createPendingTask()),
      advanceState: jest.fn(),
      saveTask: jest.fn(),
    } as any;
    const logRepo = createTestLogRepo();
    const botClient = { broadcast: jest.fn().mockResolvedValue(undefined) } as any;
    const watcher = new MailboxWatcher(taskManager, logRepo, botClient, undefined, {
      inboxDir,
      processedDir,
      rejectedDir,
      runtimeDir,
      seenDir,
      statusFilePath,
      protocol,
    });

    await (watcher as any).processInbox();

    expect(taskManager.createPendingTask).not.toHaveBeenCalled();
    expect(fs.readFileSync(statusFilePath, 'utf8')).toContain('[STATUS: REJECTED]');
    expect(fs.readdirSync(inboxDir).filter((file) => file.endsWith('.msg'))).toHaveLength(0);
    expect(fs.readdirSync(rejectedDir).filter((file) => file.endsWith('.msg'))).toHaveLength(1);
  });

  it('consumes signed payloads and rejects simple replay', async () => {
    const dispatch = protocol.buildDispatchMessage(
      {
        task_id: 'task-mailbox-1',
        normalized_message: 'corrija o watcher',
        workspace: 'core',
      } as any,
      'ZAVORTH_BRIDGE',
    );
    fs.writeFileSync(path.join(inboxDir, 'first.msg'), dispatch.payload, 'utf8');

    const task = createPendingTask();
    const taskManager = {
      createPendingTask: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((currentTask: any, status: string) => {
        currentTask.status = status;
      }),
      saveTask: jest.fn(),
    } as any;
    const logRepo = createTestLogRepo();
    const botClient = { broadcast: jest.fn().mockResolvedValue(undefined) } as any;
    const watcher = new MailboxWatcher(taskManager, logRepo, botClient, undefined, {
      inboxDir,
      processedDir,
      rejectedDir,
      runtimeDir,
      seenDir,
      statusFilePath,
      protocol,
    });

    await (watcher as any).processInbox();

    expect(taskManager.createPendingTask).toHaveBeenCalledTimes(1);
    expect(task.source).toBe('system');
    expect(task.metadata.mailbox_message_id).toBeTruthy();
    expect(task.metadata.mailbox_protocol).toBe('ZAVORTH_MAILBOX_V1');
    expect(fs.readFileSync(statusFilePath, 'utf8')).toContain('[STATUS: CONSUMED]');
    expect(fs.readdirSync(processedDir).filter((file) => file.endsWith('.msg'))).toHaveLength(1);

    fs.writeFileSync(path.join(inboxDir, 'replay.msg'), dispatch.payload, 'utf8');
    await (watcher as any).processInbox();

    expect(taskManager.createPendingTask).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(statusFilePath, 'utf8')).toContain('[STATUS: REJECTED]');
    expect(fs.readdirSync(rejectedDir).filter((file) => file.endsWith('.msg'))).toHaveLength(1);
  });

  it('routes shell steps through the execution gateway using the planned executor', async () => {
    (ZavorthBridgeAdapter as jest.Mock).mockImplementationOnce(() => ({
      generatePlan: jest.fn().mockResolvedValue({
        objective: 'Revisar modulo remoto',
        executor_recommendation: 'external_executor',
        workspace_recommendation: 'C:/repo',
        risk_level: 0,
        requires_approval: false,
        steps: [
          {
            step_id: 'step-1',
            type: 'shell',
            description: 'Rodar audit no agente remoto',
            tool: null,
            args: null,
            command: 'Revise o modulo principal',
            file_targets: ['C:/repo'],
            expected_output: 'Resumo da audit',
            sensitive: false,
          },
        ],
        validation_steps: [],
        success_condition: 'Resumo ready',
        rollback_condition: null,
        notes: [],
      }),
    }));

    const dispatch = protocol.buildDispatchMessage(
      {
        task_id: 'task-mailbox-3',
        normalized_message: 'revisar modulo remoto',
        workspace: 'C:/repo',
      } as any,
      'ZAVORTH_BRIDGE',
    );
    fs.writeFileSync(path.join(inboxDir, 'gateway.msg'), dispatch.payload, 'utf8');

    const task = createPendingTask();
    const taskManager = {
      createPendingTask: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((currentTask: any, status: string) => {
        currentTask.status = status;
      }),
      saveTask: jest.fn(),
    } as any;
    const logRepo = createTestLogRepo();
    const broadcaster = { broadcast: jest.fn().mockResolvedValue(undefined) } as any;
    const executionGateway = {
      submit: jest.fn().mockResolvedValue({
        requires_confirmation: false,
        allowed: true,
        reason: 'ok',
        execution_result: {
          success: true,
          stdout: 'ExternalExecutor concluiu a audit',
          stderr: '',
        },
      }),
    } as any;
    const watcher = new MailboxWatcher(taskManager, logRepo, broadcaster, undefined, {
      inboxDir,
      processedDir,
      rejectedDir,
      runtimeDir,
      seenDir,
      statusFilePath,
      protocol,
      executionGateway,
    });

    await (watcher as any).processInbox();

    expect(executionGateway.submit).toHaveBeenCalledTimes(1);
    expect(executionGateway.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        executor_used: 'external_executor',
        metadata: expect.objectContaining({
          gateway_plan: expect.objectContaining({
            executor_recommendation: 'external_executor',
          }),
        }),
      }),
      expect.objectContaining({
        executor_recommendation: 'external_executor',
        workspace_recommendation: 'C:/repo',
        steps: [
          expect.objectContaining({
            type: 'exec',
            command: 'Revise o modulo principal',
          }),
        ],
      }),
      false,
    );
    expect(broadcaster.broadcast).toHaveBeenCalledWith(
      expect.stringMatching(
        /Autonomous execution completed through external_executor|Autonomous execution completed (-:via|through) external_executor/i,
      ),
    );
  });

  it('executes tool steps through ToolRuntimeService before concluding the mailbox task', async () => {
    (ZavorthBridgeAdapter as jest.Mock).mockImplementationOnce(() => ({
      generatePlan: jest.fn().mockResolvedValue({
        objective: 'Consultar file local',
        executor_recommendation: 'local_executor',
        workspace_recommendation: 'C:/repo',
        risk_level: 0,
        requires_approval: false,
        steps: [
          {
            step_id: 'tool-step-1',
            type: 'tool',
            description: 'Ler README',
            tool: 'read_file',
            args: { path: 'README.md' },
            command: null,
            file_targets: ['C:/repo/README.md'],
            expected_output: 'File content',
            sensitive: false,
          },
        ],
        validation_steps: [],
        success_condition: 'Content ready',
        rollback_condition: null,
        notes: [],
      }),
    }));

    const dispatch = protocol.buildDispatchMessage(
      {
        task_id: 'task-mailbox-tool-1',
        normalized_message: 'leia o readme',
        workspace: 'C:/repo',
      } as any,
      'ZAVORTH_BRIDGE',
    );
    fs.writeFileSync(path.join(inboxDir, 'tool.msg'), dispatch.payload, 'utf8');

    const task = createPendingTask();
    const taskManager = {
      createPendingTask: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((currentTask: any, status: string) => {
        currentTask.status = status;
      }),
      saveTask: jest.fn(),
    } as any;
    const logRepo = createTestLogRepo();
    const broadcaster = { broadcast: jest.fn().mockResolvedValue(undefined) } as any;
    const toolRuntime = {
      executeTool: jest.fn().mockResolvedValue('content README'),
    } as any;
    const watcher = new MailboxWatcher(taskManager, logRepo, broadcaster, toolRuntime, {
      inboxDir,
      processedDir,
      rejectedDir,
      runtimeDir,
      seenDir,
      statusFilePath,
      protocol,
    });

    await (watcher as any).processInbox();

    expect(toolRuntime.executeTool).toHaveBeenCalledWith(
      'read_file',
      expect.objectContaining({
        path: 'README.md',
        taskId: task.task_id,
        metadata: expect.objectContaining({
          traceId: expect.stringContaining(`task:${task.task_id}`),
        }),
      }),
    );
    expect(broadcaster.broadcast).toHaveBeenCalledWith(
      expect.stringMatching(/Resultado da tool \[read_file\]:|Tool result \[read_file\]:/i),
    );
  });

  it('rejects replay after watcher restart using persisted seen markers', async () => {
    const dispatch = protocol.buildDispatchMessage(
      {
        task_id: 'task-mailbox-2',
        normalized_message: 'corrija o replay',
        workspace: 'core',
      } as any,
      'ZAVORTH_BRIDGE',
    );
    fs.writeFileSync(path.join(inboxDir, 'first.msg'), dispatch.payload, 'utf8');

    const firstTaskManager = {
      createPendingTask: jest.fn().mockReturnValue(createPendingTask()),
      advanceState: jest.fn((currentTask: any, status: string) => {
        currentTask.status = status;
      }),
      saveTask: jest.fn(),
    } as any;
    const logRepo = createTestLogRepo();
    const broadcaster = { broadcast: jest.fn().mockResolvedValue(undefined) } as any;

    const firstWatcher = new MailboxWatcher(firstTaskManager, logRepo, broadcaster, undefined, {
      inboxDir,
      processedDir,
      rejectedDir,
      runtimeDir,
      seenDir,
      statusFilePath,
      protocol,
    });

    await (firstWatcher as any).processInbox();

    fs.writeFileSync(path.join(inboxDir, 'second.msg'), dispatch.payload, 'utf8');

    const secondTaskManager = {
      createPendingTask: jest.fn().mockReturnValue(createPendingTask()),
      advanceState: jest.fn(),
      saveTask: jest.fn(),
    } as any;
    const secondWatcher = new MailboxWatcher(secondTaskManager, logRepo, broadcaster, undefined, {
      inboxDir,
      processedDir,
      rejectedDir,
      runtimeDir,
      seenDir,
      statusFilePath,
      protocol,
    });

    await (secondWatcher as any).processInbox();

    expect(firstTaskManager.createPendingTask).toHaveBeenCalledTimes(1);
    expect(secondTaskManager.createPendingTask).not.toHaveBeenCalled();
    expect(fs.readFileSync(statusFilePath, 'utf8')).toContain('[STATUS: REJECTED]');
  });
});
