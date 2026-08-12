import fs from 'fs';
import os from 'os';
import path from 'path';
import { RealZavorthBridgeWatcher } from '../../src/orchestrator/RealZavorthBridgeWatcher';
import type { Task } from '../../src/contracts/TaskContract';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: 'telegram',
    chat_id: 'chat-1',
    user_id: 'user-1',
    raw_message: '/ag teste',
    normalized_message: '/ag teste',
    command_type: '/ag',
    intent: 'zavorthBridge_task',
    target: null,
    workspace: 'C:/workspace/zavorth',
    risk_level: 1,
    status: 'running',
    requires_planning: false,
    requires_approval: false,
    approval_status: 'not_required',
    planner_used: null,
    executor_used: 'zavorthBridge_cli',
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
    ...overrides,
  };
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function zavorthBridgeLogTimestamp(minutes: number): string {
  return minutesAgo(minutes).replace('T', ' ').replace('Z', '');
}

describe('RealZavorthBridgeWatcher', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('creates an approval request for /ag permission prompts without leaking log spam to Telegram', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-watcher-'));
    tempDirs.push(root);
    const logDir = path.join(root, 'session-1', 'window1', 'exthost', 'google.zavorthBridge');
    fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(
      path.join(logDir, 'ZavorthBridge.log'),
      `${zavorthBridgeLogTimestamp(1)} [INFO]: [SupercompleteProvider] No supercomplete response`,
      'utf8',
    );

    const task = createTask();
    const permission = {
      permission_id: 'perm-12345678',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      status: 'pending',
    };
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      lastDeliveredLogAt: null,
      automationAttempts: 0,
      lastAutomationAt: null,
      lastAutomationAction: null,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };
    const permissionService = {
      listApprovedRequests: jest.fn().mockResolvedValue([]),
      createRequest: jest.fn().mockResolvedValue(permission),
    };
    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
        permissionService: permissionService as any,
        botApi: botApi as any,
        formatPermissionCreatedMessage: jest.fn().mockReturnValue('perm msg'),
        buildPermissionKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [] }),
      },
    ) as any;

    watcher.logsDir = root;
    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn().mockResolvedValue({
        ok: true,
        hasPermissionPrompt: true,
        screenshotPath: 'capture.png',
      }),
    };
    watcher.tryAutomationRescue = jest.fn();
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });

    await watcher.processPendingLogs();

    expect(botApi.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      'perm msg',
      { reply_markup: { inline_keyboard: [] } },
    );
    expect(broadcaster.sendToChat).not.toHaveBeenCalled();
    expect(permissionService.createRequest).toHaveBeenCalled();
    expect(task.status).toBe('waiting_approval');
    expect(task.requires_approval).toBe(true);
    expect(task.approval_status).toBe('pending');
    expect(task.metadata.pendingPermissionId).toBe('perm-12345678');
    expect(task.metadata.pendingPermissionNotifiedAt).toEqual(expect.any(String));
    expect(task.metadata.pendingPermissionNotificationError).toBeNull();
    expect(task.metadata.zavorthBridgeCompanionInstanceId).toBe('bridge-1');
    expect(task.metadata.zavorthBridgeCompanionProcessId).toBe(4321);
    expect(watcher.tryAutomationRescue).not.toHaveBeenCalled();
  });

  it('creates an approval request as soon as the visible UI capture reports a permission prompt', async () => {
    const task = createTask();
    const permission = {
      permission_id: 'perm-visible-123',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      status: 'pending',
    };
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };
    const permissionService = {
      listApprovedRequests: jest.fn().mockResolvedValue([]),
      createRequest: jest.fn().mockResolvedValue(permission),
    };
    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
        permissionService: permissionService as any,
        botApi: botApi as any,
        formatPermissionCreatedMessage: jest.fn().mockReturnValue('perm msg'),
        buildPermissionKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [] }),
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn().mockResolvedValue({
        ok: true,
        status: 'permission_prompt',
        hasPermissionPrompt: true,
        permissionPromptSummary: 'Allow command execution for npm test',
        confidence: 1,
        responseText: '',
        screenshotPath: 'capture-visible.png',
        notes: 'Permission prompt visible in ZavorthBridge UI: Allow command execution for npm test',
      }),
    };

    await watcher.processVisibleResponses();

    expect(permissionService.createRequest).toHaveBeenCalledTimes(1);
    expect(permissionService.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringMatching(
          /(?:O ZavorthBridge pediu permissao na UI|ZavorthBridge requested permission in the UI): Allow command execution for npm test/,
        ),
        metadata: expect.objectContaining({
          permission_prompt_summary: 'Allow command execution for npm test',
        }),
      }),
    );
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      'perm msg',
      { reply_markup: { inline_keyboard: [] } },
    );
    expect(task.status).toBe('waiting_approval');
    expect(task.requires_approval).toBe(true);
    expect(task.approval_status).toBe('pending');
    expect(task.metadata.pendingPermissionId).toBe('perm-visible-123');
    expect(task.metadata.pendingPermissionNotifiedAt).toEqual(expect.any(String));
    expect(task.metadata.pendingPermissionNotificationError).toBeNull();
    expect(task.metadata.zavorthBridgeCompanionProcessId).toBe(4321);
    expect(watcher.uiCaptureService.captureLatestResponse).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing pending ZavorthBridge permission without sending a duplicate Telegram prompt', async () => {
    const notifiedAt = minutesAgo(4);
    const task = createTask({
      status: 'running',
      metadata: {
        pendingPermissionId: 'perm-existing-1',
        pendingPermissionNotifiedAt: notifiedAt,
      },
    });
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
      lastPermissionNotificationAt: notifiedAt,
      lastNotifiedPermissionId: 'perm-existing-1',
    };

    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const permissionService = {
      getRequest: jest.fn().mockResolvedValue({
        permission_id: 'perm-existing-1',
        executor: 'zavorthBridge',
        kind: 'ui_permission',
        scope: 'once',
        status: 'pending',
      }),
      createRequest: jest.fn(),
      listApprovedRequests: jest.fn().mockResolvedValue([]),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      {
        broadcast: jest.fn().mockResolvedValue(undefined),
        sendToChat: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        taskManager: {
          getTask: jest.fn().mockReturnValue(task),
          saveTask: jest.fn(),
          advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
            targetTask.status = nextStatus;
          }),
        } as any,
        permissionService: permissionService as any,
        botApi: botApi as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn().mockResolvedValue({
        ok: true,
        status: 'permission_prompt',
        hasPermissionPrompt: true,
        confidence: 1,
        responseText: '',
        screenshotPath: 'capture-visible.png',
      }),
    };

    await watcher.processVisibleResponses();

    expect(permissionService.createRequest).not.toHaveBeenCalled();
    expect(botApi.sendMessage).not.toHaveBeenCalled();
    expect(task.status).toBe('waiting_approval');
    expect(task.metadata.pendingPermissionId).toBe('perm-existing-1');
    expect(task.metadata.pendingPermissionNotifiedAt).toBe(notifiedAt);
  });

  it('does not create a fresh ZavorthBridge permission request immediately after approval if the same prompt is still visible', async () => {
    const approvedAt = new Date().toISOString();
    const task = createTask({
      status: 'running',
      metadata: {
        pendingPermissionId: 'perm-approved-1',
        zavorthBridgePermissionApprovedAt: approvedAt,
      },
    });
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
    };

    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const permissionService = {
      getRequest: jest.fn().mockResolvedValue({
        permission_id: 'perm-approved-1',
        executor: 'zavorthBridge',
        kind: 'ui_permission',
        scope: 'once',
        status: 'approved',
        updated_at: approvedAt,
      }),
      createRequest: jest.fn(),
      listApprovedRequests: jest.fn().mockResolvedValue([]),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      {
        broadcast: jest.fn().mockResolvedValue(undefined),
        sendToChat: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        taskManager: {
          getTask: jest.fn().mockReturnValue(task),
          saveTask: jest.fn(),
          advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
            targetTask.status = nextStatus;
          }),
        } as any,
        permissionService: permissionService as any,
        botApi: botApi as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn().mockResolvedValue({
        ok: true,
        status: 'permission_prompt',
        hasPermissionPrompt: true,
        confidence: 1,
        responseText: '',
        screenshotPath: 'capture-visible.png',
      }),
    };

    await watcher.processVisibleResponses();

    expect(permissionService.createRequest).not.toHaveBeenCalled();
    expect(botApi.sendMessage).not.toHaveBeenCalled();
    expect(task.status).toBe('running');
  });

  it('auto-approves ZavorthBridge prompts with the conversation button when a matching session policy exists', async () => {
    const task = createTask();
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      {
        broadcast: jest.fn().mockResolvedValue(undefined),
        sendToChat: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        taskManager: {
          getTask: jest.fn().mockReturnValue(task),
          saveTask: jest.fn(),
          advanceState: jest.fn(),
        } as any,
        permissionService: {
          listApprovedRequests: jest.fn().mockResolvedValue([
            {
              permission_id: 'perm-session-1',
              executor: 'zavorthBridge',
              kind: 'ui_permission',
              scope: 'session',
              resolved_value: 'approve-visible-step-conversation',
              metadata: {
                companion_instance_id: 'bridge-1',
              },
            },
          ]),
          createRequest: jest.fn(),
        } as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });
    watcher.windowAutomator = {
      approveVisibleStep: jest.fn().mockResolvedValue({ ok: true }),
      waitForPermissionPromptToClear: jest.fn().mockResolvedValue(true),
    };
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn().mockResolvedValue({
        ok: true,
        status: 'permission_prompt',
        hasPermissionPrompt: true,
        confidence: 1,
        responseText: '',
        screenshotPath: 'capture-visible.png',
      }),
    };

    await watcher.processVisibleResponses();

    expect(watcher.windowAutomator.approveVisibleStep).toHaveBeenCalledWith(0, 'conversation', 4321);
    expect(task.metadata.zavorthBridgeAutoPermissionApplied).toBe('perm-session-1');
    expect(task.metadata.zavorthBridgeAutoPermissionMode).toBe('conversation');
  });

  it('opens a manual permission request when auto-approval does not dismiss the ZavorthBridge prompt', async () => {
    const task = createTask();
    const session = {
      taskId: task.task_id,
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: new Date().toISOString(),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
    };
    const permission = {
      permission_id: 'perm-manual-1',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      status: 'pending',
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      { broadcast: jest.fn().mockResolvedValue(undefined), sendToChat: jest.fn().mockResolvedValue(undefined) } as any,
      {
        permissionService: {
          listApprovedRequests: jest.fn().mockResolvedValue([
            {
              permission_id: 'perm-session-2',
              executor: 'zavorthBridge',
              kind: 'ui_permission',
              scope: 'session',
              resolved_value: 'approve-visible-step-conversation',
              metadata: {
                companion_instance_id: 'bridge-1',
              },
            },
          ]),
          createRequest: jest.fn().mockResolvedValue(permission),
        } as any,
        taskManager: {
          getTask: jest.fn().mockReturnValue(task),
          saveTask: jest.fn((targetTask: any) => targetTask),
          advanceState: jest.fn((targetTask: any, nextStatus: string) => {
            targetTask.status = nextStatus;
          }),
        } as any,
        botApi: {
          sendMessage: jest.fn().mockResolvedValue(undefined),
        } as any,
        formatPermissionCreatedMessage: jest.fn().mockReturnValue('perm msg'),
        buildPermissionKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [] }),
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });
    watcher.windowAutomator = {
      approveVisibleStep: jest.fn().mockResolvedValue({ ok: true }),
      waitForPermissionPromptToClear: jest.fn().mockResolvedValue(false),
    };
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn().mockResolvedValue({
        ok: true,
        status: 'permission_prompt',
        hasPermissionPrompt: true,
        confidence: 1,
        responseText: '',
        screenshotPath: 'capture-visible.png',
      }),
    };

    await watcher.processVisibleResponses();

    expect(watcher.windowAutomator.approveVisibleStep).toHaveBeenCalledWith(0, 'conversation', 4321);
    expect(task.metadata.zavorthBridgeAutoPermissionApplied).toBeUndefined();
    expect(task.status).toBe('waiting_approval');
    expect(task.metadata.pendingPermissionId).toBe('perm-manual-1');
  });

  it('falls back to plain chat delivery when the inline ZavorthBridge permission message fails', async () => {
    const task = createTask({
      status: 'waiting_approval',
      requires_approval: true,
      approval_status: 'pending',
      metadata: {
        pendingPermissionId: 'perm-retry-123',
        pendingPermissionNotifiedAt: null,
      },
    });
    const permission = {
      permission_id: 'perm-retry-123',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      status: 'pending',
    };
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      sessionKind: 'handoff',
      automationEnabled: true,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn(),
    };
    const permissionService = {
      getRequest: jest.fn().mockResolvedValue(permission),
    };
    const botApi = {
      sendMessage: jest.fn().mockRejectedValue(new Error('telegram unavailable')),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
        permissionService: permissionService as any,
        botApi: botApi as any,
        formatPermissionCreatedMessage: jest.fn().mockReturnValue('perm msg'),
        buildPermissionKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [] }),
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    await watcher.processPendingPermissionNotifications();

    expect(botApi.sendMessage).toHaveBeenCalledTimes(1);
    expect(broadcaster.sendToChat).toHaveBeenCalledWith('chat-1', 'perm msg');
    expect(task.metadata.pendingPermissionNotifiedAt).toEqual(expect.any(String));
    expect(task.metadata.pendingPermissionNotificationError).toBeNull();
  });

  it('does not resend the same ZavorthBridge permission notification when the session already recorded it', async () => {
    const task = createTask({
      status: 'waiting_approval',
      requires_approval: true,
      approval_status: 'pending',
      metadata: {
        pendingPermissionId: 'perm-retry-123',
        pendingPermissionNotifiedAt: null,
      },
    });
    const permission = {
      permission_id: 'perm-retry-123',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      status: 'pending',
    };
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      sessionKind: 'handoff',
      automationEnabled: true,
      lastNotifiedPermissionId: 'perm-retry-123',
      lastPermissionNotificationAt: new Date().toISOString(),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      {
        broadcast: jest.fn().mockResolvedValue(undefined),
        sendToChat: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        taskManager: {
          getTask: jest.fn().mockReturnValue(task),
          saveTask: jest.fn(),
          advanceState: jest.fn(),
        } as any,
        permissionService: {
          getRequest: jest.fn().mockResolvedValue(permission),
        } as any,
        botApi: {
          sendMessage: jest.fn().mockResolvedValue(undefined),
        } as any,
        formatPermissionCreatedMessage: jest.fn().mockReturnValue('perm msg'),
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    await watcher.processPendingPermissionNotifications();

    expect(watcher.deps.botApi.sendMessage).not.toHaveBeenCalled();
    expect(task.metadata.pendingPermissionNotifiedAt).toEqual(expect.any(String));
  });

  it('clears resolved ZavorthBridge permission state instead of re-notifying it', async () => {
    const task = createTask({
      status: 'waiting_approval',
      requires_approval: true,
      approval_status: 'pending',
      metadata: {
        pendingPermissionId: 'perm-approved-123',
        pendingPermissionNotifiedAt: null,
      },
    });
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      sessionKind: 'handoff',
      automationEnabled: true,
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn(),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      {
        broadcast: jest.fn().mockResolvedValue(undefined),
        sendToChat: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        taskManager: taskManager as any,
        permissionService: {
          getRequest: jest.fn().mockResolvedValue({
            permission_id: 'perm-approved-123',
            executor: 'zavorthBridge',
            kind: 'ui_permission',
            scope: 'once',
            status: 'approved',
          }),
        } as any,
        botApi: {
          sendMessage: jest.fn().mockResolvedValue(undefined),
        } as any,
        formatPermissionCreatedMessage: jest.fn().mockReturnValue('perm msg'),
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    await watcher.processPendingPermissionNotifications();

    expect(watcher.deps.botApi.sendMessage).not.toHaveBeenCalled();
    expect(taskManager.saveTask).toHaveBeenCalled();
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(task.metadata.pendingPermissionNotifiedAt).toBeNull();
  });

  it('fails stale ZavorthBridge approval tasks whose tracked session already finished', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-stale-perm-'));
    tempDirs.push(root);
    const trackingFile = path.join(root, 'tracking.json');
    fs.writeFileSync(
      trackingFile,
      JSON.stringify({
        taskId: 'task-123',
      completedAt: minutesAgo(3),
      }),
      'utf8',
    );

    const task = createTask({
      status: 'waiting_approval',
      requires_approval: true,
      approval_status: 'pending',
      metadata: {
        pendingPermissionId: 'perm-stale-123',
        zavorthBridgeTrackingFile: trackingFile,
      },
    });
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      getPendingTasks: jest.fn().mockReturnValue([task]),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };
    const permissionService = {
      getRequest: jest.fn().mockResolvedValue({
        permission_id: 'perm-stale-123',
        executor: 'zavorthBridge',
        kind: 'ui_permission',
        scope: 'once',
        status: 'pending',
      }),
      rejectRequest: jest.fn().mockResolvedValue(undefined),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      {
        broadcast: jest.fn().mockResolvedValue(undefined),
        sendToChat: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        taskManager: taskManager as any,
        permissionService: permissionService as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    await watcher.reconcileZavorthBridgePermissionState();

    expect(permissionService.rejectRequest).toHaveBeenCalledWith(
      'perm-stale-123',
      'system',
      expect.stringContaining('sessao original ja terminou'),
    );
    expect(task.status).toBe('failed');
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(task.metadata.pendingPermissionNotifiedAt).toBeNull();
  });

  it('keeps a captured AG response pending when Telegram delivery fails', async () => {
    const task = createTask();
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      sessionKind: 'handoff',
      automationEnabled: true,
      pendingDeliveryMessage: 'Resposta final do AG',
      pendingDeliverySummary: 'Resposta final do AG',
      responseCapturedAt: minutesAgo(4),
      responseSource: 'captura da UI',
      deliveryState: 'pending',
      deliveryAttempts: 0,
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      {
        broadcast: jest.fn().mockRejectedValue(new Error('broadcast down')),
        sendToChat: jest.fn().mockRejectedValue(new Error('chat down')),
      } as any,
      {
        taskManager: {
          getTask: jest.fn().mockReturnValue(task),
          saveTask: jest.fn(),
          advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
            targetTask.status = nextStatus;
          }),
        } as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    await watcher.processPendingDeliveries();

    expect(task.status).toBe('running');
    expect(task.metadata.zavorthBridgeDeliveryState).toBe('failed');
    expect(task.metadata.zavorthBridgeDeliveryError).toContain('chat down');
    expect(session.deliveredResponse).toBe(false);
    expect(session.deliveryState).toBe('failed');
    expect(session.pendingDeliveryMessage).toBe('Resposta final do AG');
  });

  it('sends only walkthrough artifacts back to Telegram', async () => {
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: 'brain-1',
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      sessionKind: 'handoff',
      automationEnabled: true,
    };
    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const watcher = new RealZavorthBridgeWatcher({ log: jest.fn() } as any, broadcaster as any) as any;
    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.collectArtifacts = jest.fn().mockResolvedValue([
      {
        artifactType: 'ARTIFACT_TYPE_IMPLEMENTATION_PLAN',
        baseName: 'plan',
        brainDir: 'brain-1',
        content: 'Plano parcial',
        contentPath: 'plan.md',
        key: 'brain-1:plan',
        summary: 'Plano',
        updatedAt: minutesAgo(4),
        updatedAtMs: Date.parse(minutesAgo(4)),
      },
      {
        artifactType: 'ARTIFACT_TYPE_WALKTHROUGH',
        baseName: 'walkthrough',
        brainDir: 'brain-1',
        content: 'Resposta final do ZavorthBridge',
        contentPath: 'walkthrough.md',
        key: 'brain-1:walkthrough',
        summary: 'Resumo final',
        updatedAt: minutesAgo(3),
        updatedAtMs: Date.parse(minutesAgo(3)),
      },
    ]);

    await watcher.processPendingArtifacts();

    expect(broadcaster.sendToChat).toHaveBeenCalledTimes(1);
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('ZavorthBridge concluiu a tarefa.'),
    );
  });

  it('concludes explicit file-creation prompts from the verified artifact even without a visible AG closeout', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-contract-'));
    tempDirs.push(root);
    const createdFile = path.join(root, 'ag-contract-created.md');
    fs.writeFileSync(createdFile, 'ZAVORTH_CREATE_OK\n', 'utf8');

    const task = createTask({
      raw_message: `/ag Crie o arquivo "${createdFile}" com o conteudo exato "ZAVORTH_CREATE_OK". Depois responda apenas com "CRIADO ${createdFile}".`,
    });
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: `Crie o arquivo "${createdFile}" com o conteudo exato "ZAVORTH_CREATE_OK". Depois responda apenas com "CRIADO ${createdFile}".`,
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: false,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn(),
    };

    await watcher.processVisibleResponses();

    expect(watcher.uiCaptureService.captureLatestResponse).not.toHaveBeenCalled();
    expect(task.status).toBe('completed');
    expect(task.result_summary).toBe(`CRIADO ${createdFile}`);
    expect(session.deliveredResponse).toBe(true);
    expect(session.deliveryState).toBe('delivered');
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining(`CRIADO ${createdFile}`),
    );
  });

  it('accepts the newer direct-chat file contract wording without quoted literals', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-contract-new-'));
    tempDirs.push(root);
    const createdFile = path.join(root, 'ag-contract-created-new.md');
    fs.writeFileSync(createdFile, 'ZAVORTH_CREATE_OK_NEW', 'utf8');

    const task = createTask({
      raw_message: `/ag Crie o arquivo ${createdFile} contendo exatamente ZAVORTH_CREATE_OK_NEW e depois responda apenas com CRIADO ${createdFile}`,
    });
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: `Crie o arquivo ${createdFile} contendo exatamente ZAVORTH_CREATE_OK_NEW e depois responda apenas com CRIADO ${createdFile}`,
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: false,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn(),
    };

    await watcher.processVisibleResponses();

    expect(watcher.uiCaptureService.captureLatestResponse).not.toHaveBeenCalled();
    expect(task.status).toBe('completed');
    expect(task.result_summary).toBe(`CRIADO ${createdFile}`);
    expect(session.deliveredResponse).toBe(true);
    expect(session.deliveryState).toBe('delivered');
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining(`CRIADO ${createdFile}`),
    );
  });

  it('captures a stable visible ZavorthBridge reply from the UI when no walkthrough or fallback file exists', async () => {
    const task = createTask();
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'pesquise as noticias do dia',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });
    watcher.uiCaptureService = {
      captureLatestResponse: jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 'ready',
          hasPermissionPrompt: false,
          confidence: 0.4,
          responseText: 'Resumo final das noticias de tecnologia.',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 'ready',
          hasPermissionPrompt: false,
          confidence: 0.4,
          responseText: 'Resumo final das noticias de tecnologia.',
        }),
    };

    await watcher.processVisibleResponses();
    expect(broadcaster.sendToChat).not.toHaveBeenCalled();

    session.lastVisibleResponseAt = null;
    await watcher.processVisibleResponses();

    expect(task.status).toBe('completed');
    expect(task.result_summary).toContain('Resumo final das noticias de tecnologia.');
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('Resumo final das noticias de tecnologia.'),
    );
  });

  it('does not conclude /ag from home screen chrome or intermediate narration', async () => {
    const task = createTask();
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'responda apenas com ok',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });
    watcher.uiCaptureService = {
      captureLatestResponse: jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 'ready',
          hasPermissionPrompt: false,
          confidence: 0.94,
          responseText: 'Switch to Agent Manager\nCode with Agent',
          uiDiagnostics: { homeScreenAfter: true },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 'ready',
          hasPermissionPrompt: false,
          confidence: 0.94,
          responseText:
            "Initiating task execution. I've received the directive. The task is now actively being addressed.",
          uiDiagnostics: {},
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 'ready',
          hasPermissionPrompt: false,
          confidence: 0.94,
          responseText: 'OK',
          uiDiagnostics: {},
        }),
    };

    await watcher.processVisibleResponses();
    expect(task.status).toBe('running');
    expect(broadcaster.sendToChat).not.toHaveBeenCalled();

    session.lastVisibleResponseAt = null;
    await watcher.processVisibleResponses();
    expect(task.status).toBe('running');
    expect(broadcaster.sendToChat).not.toHaveBeenCalled();

    session.lastVisibleResponseAt = null;
    await watcher.processVisibleResponses();
    expect(task.status).toBe('completed');
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringMatching(/ok/i),
    );
  });

  it('does not conclude /ag with a stale UI reply that does not match the current prompt anchors', async () => {
    const task = createTask();
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt:
        'Crie o arquivo "tmp/ag-e2e-create-1774466674556.md" e responda apenas com "CRIADO tmp/ag-e2e-create-1774466674556.md".',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      processId: 4321,
    });
    watcher.uiCaptureService = {
      captureLatestResponse: jest.fn().mockResolvedValue({
        ok: true,
        status: 'ready',
        hasPermissionPrompt: false,
        confidence: 0.98,
        responseText: 'ZAVORTH_AG_E2E_RESPONSE_OK_1774466238602\nworkspace=zavorth',
        uiDiagnostics: {},
      }),
    };

    await watcher.processVisibleResponses();

    expect(task.status).toBe('running');
    expect(session.lastVisibleResponseKey).toBeNull();
    expect(session.stableVisibleResponseCount).toBe(0);
    expect(broadcaster.sendToChat).not.toHaveBeenCalled();
  });

  it('fails stalled /ag sessions after rescue attempts are exhausted', async () => {
    const task = createTask({
      metadata: {
        zavorthBridgeCompanionInstanceId: 'bridge-1',
      },
    });
    const session = {
      taskId: 'de89a8ff-c54a-4e3f-82ae-0dfa4c17551a',
      chatId: 'chat-1',
      prompt: 'me conte as noticias',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'C:/workspace/zavorth/data/agent-bridge/zavorth-bridge/handoffs/de89a8ff-target.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 2,
      lastAutomationAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
      lastAutomationAction: 'companion-open-handoff + companion-sync-pending-handoffs',
      companionInstanceId: null,
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.tryAutomationRescue = jest.fn();
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      activeEditor: 'C:/workspace/zavorth/data/agent-bridge/zavorth-bridge/handoffs/surface-send-check-2.md',
      lastSyncedHandoff: 'C:/workspace/zavorth/data/agent-bridge/zavorth-bridge/handoffs/surface-send-check-2.md',
      latestPendingHandoff: 'C:/workspace/zavorth/data/agent-bridge/zavorth-bridge/handoffs/surface-send-check-2.md',
    });

    await watcher.processStalledSessions();

    expect(watcher.tryAutomationRescue).not.toHaveBeenCalled();
    expect(watcher.getLiveCompanionStatus).toHaveBeenCalledWith('bridge-1');
    expect(task.status).toBe('failed');
    expect(task.error_summary).toMatch(
      /desviada para outra handoff|diverted to another handoff/i,
    );
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringMatching(/ZavorthBridge falhou ao concluir a tarefa|ZavorthBridge failed to complete the task/i),
    );
    expect(watcher.bridgeManager.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'de89a8ff-c54a-4e3f-82ae-0dfa4c17551a',
        completedAt: expect.any(String),
      }),
    );
  });

  it('fails stalled direct-chat /ag sessions even when automation rescue is disabled', async () => {
    const task = createTask({
      metadata: {
        zavorthBridgeCompanionInstanceId: 'bridge-1',
      },
    });
    const session = {
      taskId: '65ddffa9-316c-453a-b968-3dbb63573f66',
      chatId: 'chat-1',
      prompt: 'abra e exiba o conteudo da pasta',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'C:/workspace/zavorth/data/agent-bridge/zavorth-bridge/handoffs/65ddffa9-target.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      lastAutomationAt: null,
      lastAutomationAction: null,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: false,
      lastUiProbeAt: null,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.tryAutomationRescue = jest.fn();
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue({
      instanceId: 'bridge-1',
      activeEditor: null,
      lastSyncedHandoff: null,
      latestPendingHandoff: null,
    });

    await watcher.processStalledSessions();

    expect(watcher.tryAutomationRescue).not.toHaveBeenCalled();
    expect(watcher.getLiveCompanionStatus).toHaveBeenCalledWith('bridge-1');
    expect(task.status).toBe('failed');
    expect(task.error_summary).toMatch(
      /ficou sem progresso visivel por tempo demais|no visible progress for too long/i,
    );
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringMatching(/ZavorthBridge falhou ao concluir a tarefa|ZavorthBridge failed to complete the task/i),
    );
    expect(watcher.bridgeManager.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: '65ddffa9-316c-453a-b968-3dbb63573f66',
        completedAt: expect.any(String),
      }),
    );
  });

  it('falls back to a local directory listing when a stalled /ag task was asking to inspect a folder', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-dir-fallback-'));
    tempDirs.push(root);
    const testDev = path.join(root, 'workspace');
    const workspace = path.join(testDev, 'zavorth-core', 'Zavorth');
    fs.mkdirSync(path.join(workspace, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testDev, 'notes.txt'), 'ok', 'utf8');

    const task = createTask({
      raw_message: '/ag verifique o que tem na minha pasta chamada workspace',
      normalized_message: '/ag verifique o que tem na minha pasta chamada workspace',
      workspace,
      metadata: {
        zavorthBridgeCompanionInstanceId: 'bridge-1',
      },
    });
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'verifique o que tem na minha pasta chamada workspace',
      workspace,
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      automationAttempts: 0,
      lastAutomationAt: null,
      lastAutomationAction: null,
      companionInstanceId: 'bridge-1',
      sessionKind: 'handoff',
      automationEnabled: false,
      lastUiProbeAt: null,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    watcher.tryAutomationRescue = jest.fn();
    watcher.getLiveCompanionStatus = jest.fn().mockResolvedValue(null);

    await watcher.processStalledSessions();

    expect(task.status).toBe('completed');
    expect(task.fallback_used).toBe(true);
    expect(task.metadata.zavorthBridgeLocalDirectoryFallbackPath).toBe(testDev);
    expect(task.metadata.zavorthBridgeResponseSource).toMatch(
      /fallback local de pasta|local folder fallback/i,
    );
    expect(task.metadata.zavorthBridgeDeliveryState).toBe('delivered');
    expect(session.deliveredResponse).toBe(true);
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringMatching(new RegExp(`(?:Pasta|Folder|Directory):\\s*${testDev.replace(/[\\.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')),
    );
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('[DIR] zavorth-core'),
    );
    expect(broadcaster.sendToChat).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('[FILE] notes.txt'),
    );
    expect(watcher.getLiveCompanionStatus).not.toHaveBeenCalled();
  });

  it('does not auto-accept permission prompts during companion rescue', async () => {
    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      { broadcast: jest.fn().mockResolvedValue(undefined) } as any,
    ) as any;

    watcher.companionBridge = {
      openHandoff: jest.fn().mockResolvedValue(undefined),
      syncPendingHandoffs: jest.fn().mockResolvedValue(undefined),
      acceptStep: jest.fn().mockResolvedValue(undefined),
      openConversationPicker: jest.fn().mockResolvedValue(undefined),
    };
    watcher.resolveCompanionTargetInstanceId = jest.fn().mockReturnValue('bridge-1');

    const actions = await watcher.tryCompanionRecovery(
      {
        taskId: 'task-123',
        handoffFile: 'handoff.md',
      },
      'stalled',
      0,
      {
        instanceId: 'bridge-1',
        capabilities: {
          canOpenHandoff: true,
          canSyncPendingHandoffs: true,
          canAcceptStep: true,
          canOpenConversationPicker: true,
        },
      },
    );

    expect(actions).toEqual(['companion-open-handoff', 'companion-sync-pending-handoffs']);
    expect(watcher.companionBridge.acceptStep).not.toHaveBeenCalled();
  });

  it('keeps the AG response pending when Telegram delivery fails and completes after a retry succeeds', async () => {
    const task = createTask({
      status: 'delivery_pending',
      result_summary: 'Resumo final das noticias',
      metadata: {
        zavorthBridgeDeliveryState: 'pending',
      },
    });
    const session = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'pesquise as noticias do dia',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile: 'tracking.json',
      launchedAt: minutesAgo(5),
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      sessionKind: 'handoff',
      automationEnabled: true,
      pendingDeliveryMessage: 'ZavorthBridge concluiu a tarefa.\n\nResumo final das noticias',
      pendingDeliverySummary: 'Resumo final das noticias',
      responseCapturedAt: minutesAgo(4),
      responseSource: 'captura da UI',
      deliveryState: 'pending',
      deliveryAttempts: 0,
      lastDeliveryAttemptAt: null,
      lastDeliveryAt: null,
      lastDeliveryError: null,
    };

    const broadcaster = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest
        .fn()
        .mockRejectedValueOnce(new Error('telegram offline'))
        .mockResolvedValueOnce(undefined),
    };
    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
      advanceState: jest.fn((targetTask: Task, nextStatus: Task['status']) => {
        targetTask.status = nextStatus;
      }),
    };

    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      broadcaster as any,
      {
        taskManager: taskManager as any,
      },
    ) as any;

    watcher.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([session]),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    await watcher.processPendingDeliveries();
    expect(task.status).toBe('delivery_pending');
    expect(task.metadata.zavorthBridgeDeliveryState).toBe('failed');
    expect(session.deliveredResponse).toBe(false);
    expect(broadcaster.broadcast).not.toHaveBeenCalled();

    await watcher.processPendingDeliveries();
    expect(task.status).toBe('completed');
    expect(session.deliveredResponse).toBe(true);
    expect(session.pendingDeliveryMessage).toBeNull();
    expect(broadcaster.sendToChat).toHaveBeenCalledTimes(2);
  });

  it('formats AG directory-style replies into structured Telegram bullets', () => {
    const watcher = new RealZavorthBridgeWatcher(
      { log: jest.fn() } as any,
      { broadcast: jest.fn().mockResolvedValue(undefined) } as any,
    ) as any;

    const session = {
      taskId: 'bf0f80cb-1234-5678-9999-abcdefabcdef',
      prompt: 'veja o que tem dentro da pasta TESTE DEV',
    };

    const message = watcher.formatFinalResponseBroadcast(
      session,
      [
        '):',
        '.ps1',
        '.bak',
        'test_zavorthBridge.ps1',
        'test_click.ps1',
        'test_open_agent.ps1',
        'test_or.ps1',
        'dump_uia.ps1',
        'Arquivos de texto/Log:',
        'caixa_zavorthBridge.txt',
        'debug.log',
        'test_zavorthBridge.bak',
        'Se precisar de detalhes sobre o conte�do de alguma dessas pastas espec�ficas, estou � disposi��o.',
      ].join('\n'),
      'captura da UI',
    );

    expect(message).toMatch(/ZavorthBridge concluiu a tarefa|ZavorthBridge completed the task/i);
    expect(message).toMatch(/Fonte: captura da UI|Source: UI capture|Fonte: captura da UI/i);
    expect(message).toMatch(/Conteudo encontrado:|Found content:/i);
    expect(message).toContain('- `.ps1`');
    expect(message).toContain('- `test_zavorthBridge.ps1`');
    expect(message).toMatch(/Arquivos de texto e log:|Text and log files:/i);
    expect(message).toContain('- `debug.log`');
    expect(message).not.toContain('Se precisar de detalhes');
    expect(message).not.toContain('):');
  });
});
