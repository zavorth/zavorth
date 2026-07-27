import { TelegramZavorthBridgeController } from '../../../src/telegram/controllers/TelegramZavorthBridgeController';
import { ZavorthBridgeCliAdapter } from '../../../src/agents/ZavorthBridgeCliAdapter';
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.setTimeout(30000);

function createBridgeMock(overrides: Record<string, unknown> = {}) {
  return {
    isOnline: jest.fn().mockResolvedValue(false),
    readStatus: jest.fn().mockResolvedValue(null),
    acceptStep: jest.fn().mockResolvedValue({ ok: true }),
    closeAllEditors: jest.fn().mockResolvedValue({ ok: true }),
    executeCommand: jest.fn().mockResolvedValue({ ok: true }),
    openHandoff: jest.fn().mockResolvedValue({ ok: true }),
    resetSession: jest.fn().mockResolvedValue({ ok: true }),
    sendAgentPrompt: jest.fn().mockResolvedValue({ ok: true }),
    startNewConversation: jest.fn().mockResolvedValue({ ok: true }),
    syncPendingHandoffs: jest.fn().mockResolvedValue({ ok: true }),
    ...overrides};
}

function createAutomatorMock(overrides: Record<string, unknown> = {}) {
  return {
    captureWindow: jest.fn().mockResolvedValue({ ok: true }),
    focusWindow: jest.fn().mockResolvedValue({ ok: true, verified: true, mode: 'focus' }),
    approveVisibleStep: jest.fn().mockResolvedValue({ ok: true, verified: true, mode: 'approve-visible-step' }),
    ensureConversationSurface: jest.fn().mockResolvedValue({ ok: true, verified: true, mode: 'ensure-conversation-surface' }),
    pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true, mode: 'paste-and-submit' }),
    readLatestResponse: jest.fn().mockResolvedValue({ ok: true, hasPermissionPrompt: false }),
    resetVisibleConversation: jest.fn().mockResolvedValue({ ok: true, verified: true, mode: 'reset-visible-conversation' }),
    waitForPermissionPromptToClear: jest.fn().mockResolvedValue(true),
    ...overrides};
}

function createContext() {
  return {
    reply: jest.fn().mockResolvedValue(undefined),
    replyWithMediaGroup: jest.fn().mockResolvedValue(undefined),
    chat: { id: 123 },
    from: { id: 456 }} as any;
}

describe('TelegramZavorthBridgeController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createController(options: {
    bridge-: ReturnType<typeof createBridgeMock>;
    automator-: ReturnType<typeof createAutomatorMock>;
    zavorthBridgeControlService-: Record<string, unknown>;
    zavorthBridgePromptService-: Record<string, unknown>;
    zavorthBridgePreferenceStore-: Record<string, unknown>;
    permissionService-: Record<string, unknown>;
    taskManager-: Record<string, unknown>;
    botApi-: Record<string, unknown>;
    persistTask-: jest.Mock;
    createPermissionRequest-: jest.Mock;
    formatPermissionCreatedMessage-: jest.Mock;
    buildPermissionKeyboard-: jest.Mock;
    shortPermissionId-: jest.Mock;
    runResearchFallback-: jest.Mock;
  } = {}) {
    const bridge = options.bridge || createBridgeMock();
    const automator = options.automator || createAutomatorMock();
    const bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      saveSession: jest.fn().mockResolvedValue(undefined)};

    return new TelegramZavorthBridgeController({
      taskManager: {
        createPendingTask: jest.fn(),
        advanceState: jest.fn(),
        getTask: jest.fn(),
        ...(options.taskManager || {})} as any,
      zavorthBridgeControlService: {
        open: jest.fn(),
        restart: jest.fn(),
        status: jest.fn(),
        setModel: jest.fn(),
        ...(options.zavorthBridgeControlService || {})} as any,
      zavorthBridgePromptService: {
        start: jest.fn(),
        waitForCompletion: jest.fn(),
        ...(options.zavorthBridgePromptService || {})} as any,
      zavorthBridgePreferenceStore: {
        getPreferredModel: jest.fn().mockResolvedValue('gemini-3.1-flash'),
        setPreferredModel: jest.fn().mockResolvedValue(undefined),
        ...(options.zavorthBridgePreferenceStore || {})} as any,
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
        rejectRequest: jest.fn().mockResolvedValue(undefined),
        findApprovedRequest: jest.fn().mockResolvedValue(null),
        ...(options.permissionService || {})} as any,
      botApi: { sendMessage: jest.fn(), ...(options.botApi || {}) },
      persistTask: options.persistTask || jest.fn(),
      truncateForTelegram: (content: string) => content,
      createPermissionRequest: options.createPermissionRequest || jest.fn(),
      formatPermissionCreatedMessage: options.formatPermissionCreatedMessage || jest.fn(),
      buildPermissionKeyboard: (options.buildPermissionKeyboard || jest.fn()) as any,
      shortPermissionId: options.shortPermissionId || jest.fn(),
      runResearchFallback: options.runResearchFallback,
      createCompanionBridge: () => bridge as any,
      createBridgeManager: () => bridgeManager as any,
      createWindowAutomator: () => automator as any});
  }

  it('parses only slash ZavorthBridge control commands (no free-text NLU)', () => {
    const controller = createController();

    expect(controller.parseControlCommand('abrir zavorthBridge')).toBeNull();
    expect(controller.parseControlCommand('/ag_open')).toEqual({ action: 'open' });
    expect(controller.parseControlCommand('/ag_model gemini-3.1-flash')).toEqual({
      action: 'set-model',
      model: 'gemini-3.1-flash'});
  });

  it('parses prompt commands with model and prompt body', () => {
    const controller = createController();

    expect(controller.parsePromptCommand('/ag_prompt gemini-3.1-flash | responda com OK')).toEqual({
      model: 'gemini-3.1-flash',
      prompt: 'responda com OK'});
  });

  it('auto-applies a persisted ZavorthBridge UI permission and resumes completion tracking', async () => {
    const automator = createAutomatorMock();
    const botApi = { sendMessage: jest.fn().mockResolvedValue(undefined) };
    const persistTask = jest.fn();
    const advanceState = jest.fn();
    const waitForCompletion = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        errorCode: 'permission_prompt_visible'})
      .mockResolvedValueOnce({
        ok: true,
        text: 'Final ZavorthBridge response',
        stage: 'completed',
        source: 'ui',
        verified: true});
    const controller = createController({
      automator,
      botApi,
      persistTask,
      shortPermissionId: jest.fn().mockReturnValue('perm-auto'),
      taskManager: { advanceState },
      permissionService: {
        findApprovedRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-auto-1',
          scope: 'workspace'})},
      zavorthBridgePromptService: {
        waitForCompletion}});
    const task = {
      task_id: 'task-ag-prompt-1',
      chat_id: '123',
      workspace: 'C:/workspace/zavorth',
      metadata: {
        zavorthBridgeCompanionProcessId: 7788}} as any;

    await controller.finishPrompt(task, { processId: 1122 } as any);

    expect(automator.approveVisibleStep).toHaveBeenCalledWith(0, 'conversation', 7788);
    expect(automator.waitForPermissionPromptToClear).toHaveBeenCalledWith(7788);
    expect(waitForCompletion).toHaveBeenCalledTimes(2);
    expect(advanceState).toHaveBeenCalledWith(task, 'completed');
    expect(String(task.metadata.zavorthBridgeAutoPermissionApplied)).toBe('perm-auto-1');
    expect(
      botApi.sendMessage.mock.calls.some((call: any[]) => {
        const text = String(call[1]);
        return /Persistent policy automatically applied for ZavorthBridge \(perm-auto\)|Persistent policy automatically applied for ZavorthBridge \(perm-auto\)/i.test(text)
          || /persistente aplicada automatically|Persistent policy automatically applied/i.test(text);
      }),
    ).toBe(true);
  });

  it('creates a manual permission request when the ZavorthBridge prompt is still waiting for user approval', async () => {
    const botApi = { sendMessage: jest.fn().mockResolvedValue(undefined) };
    const persistTask = jest.fn();
    const advanceState = jest.fn();
    const permission = { permission_id: 'perm-manual-1' };
    const createPermissionRequest = jest.fn().mockResolvedValue(permission);
    const formatPermissionCreatedMessage = jest.fn().mockReturnValue('Permission created for ZavorthBridge');
    const buildPermissionKeyboard = jest.fn().mockReturnValue({ inline_keyboard: [] });
    const controller = createController({
      botApi,
      persistTask,
      createPermissionRequest,
      formatPermissionCreatedMessage,
      buildPermissionKeyboard,
      taskManager: { advanceState },
      permissionService: {
        findApprovedRequest: jest.fn().mockResolvedValue(null)},
      zavorthBridgePromptService: {
        waitForCompletion: jest.fn().mockResolvedValue({
          ok: false,
          errorCode: 'permission_prompt_visible',
          stage: 'waiting',
          source: 'ui',
          verified: false})}});
    const task = {
      task_id: 'task-ag-prompt-2',
      chat_id: '123',
      workspace: 'C:/workspace/zavorth',
      metadata: {}} as any;

    await controller.finishPrompt(task, { processId: 4455 } as any);

    expect(createPermissionRequest).toHaveBeenCalledWith(
      task,
      expect.objectContaining({ processId: 4455 }),
      expect.objectContaining({ errorCode: 'permission_prompt_visible' }),
    );
    expect(task.requires_approval).toBe(true);
    expect(task.approval_status).toBe('pending');
    expect(task.metadata.pendingPermissionId).toBe('perm-manual-1');
    expect(advanceState).toHaveBeenCalledWith(task, 'waiting_approval');
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      '123',
      'Permission created for ZavorthBridge',
      { reply_markup: { inline_keyboard: [] } },
    );
  });

  it('prefers the companion bridge for /agaccept when the capability is live', async () => {
    const bridge = createBridgeMock({
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue({
        instanceId: 'bridge-1',
        capabilities: { canAcceptStep: true }})});
    const automator = createAutomatorMock();
    const controller = createController({ bridge, automator });
    const ctx = createContext();

    await controller.handleWindowAction(ctx, 'approve-visible-step');

    expect(bridge.acceptStep).toHaveBeenCalledWith(undefined, 8000, 'bridge-1');
    expect(automator.approveVisibleStep).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Done. Accepted the visible ZavorthBridge step through the bridge.');
  });

  it('falls back to window automation when the bridge cannot accept a step', async () => {
    const bridge = createBridgeMock({
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue({
        instanceId: 'bridge-1',
        capabilities: { canAcceptStep: false }})});
    const automator = createAutomatorMock();
    const controller = createController({ bridge, automator });
    const ctx = createContext();

    await controller.handleWindowAction(ctx, 'approve-visible-step');

    expect(bridge.acceptStep).not.toHaveBeenCalled();
    expect(automator.approveVisibleStep).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Done. Accepted the visible step in the real ZavorthBridge window.');
  });

  it('uses the bridge for /agnudge when prompt delivery is supported', async () => {
    const bridge = createBridgeMock({
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue({
        instanceId: 'bridge-2',
        capabilities: { canSendAgentPrompt: true }})});
    const automator = createAutomatorMock();
    const controller = createController({ bridge, automator });
    const ctx = createContext();

    await controller.handleWindowAction(ctx, 'paste-and-submit', 'Continue dai');

    expect(bridge.sendAgentPrompt).toHaveBeenCalledWith('Continue dai', undefined, 8000, 'bridge-2');
    expect(automator.pasteAndSubmit).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Done. Sent this text to the real ZavorthBridge conversation through the bridge.');
  });

  it('surfaces automation failures instead of claiming success', async () => {
    const controller = createController({
      automator: createAutomatorMock({
        focusWindow: jest.fn().mockResolvedValue({
          ok: false,
          verified: false,
          mode: 'focus',
          message: 'Janela not encontrada'})})});
    const ctx = createContext();

    await controller.handleWindowAction(ctx, 'focus');

    const replyText = String(ctx.reply.mock.calls[0]?.[0] ?? '');
    expect(replyText).toMatch(
      /Not consegui concluir focar a conversa atual pela janela do ZavorthBridge|I could not complete focus the current conversation through the ZavorthBridge window/,
    );
    expect(replyText).toMatch(/Motivo:|Reason:/);
    expect(replyText).toContain('Janela not encontrada');
  });

  it('reports bridge command modes succinctly in /agbridge', async () => {
    const controller = createController({
      bridge: createBridgeMock({
        isOnline: jest.fn().mockResolvedValue(true),
        readStatus: jest.fn().mockResolvedValue({
          instanceId: 'bridge-3',
          updatedAt: '2026-03-25T03:04:58.430Z',
          pendingHandoffs: 2,
          capabilities: {
            canOpenAgentPanel: true,
            canAcceptStep: false,
            canSendAgentPrompt: true,
            canCloseAllEditors: true,
            canResetSession: false,
            canStartNewConversation: true}})})});
    const ctx = createContext();

    await controller.handleBridgeStatus(ctx);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(
      /agfocus|agaccept|agnudge|agclean|agreset|agmodel|ZavorthBridge bridge/i,
    );
  });

  it('uses reset-session directly when /agreset is fully supported by the bridge', async () => {
    const bridge = createBridgeMock({
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue({
        instanceId: 'bridge-4',
        processId: 4321,
        capabilities: { canResetSession: true }})});
    const automator = createAutomatorMock();
    const controller = createController({ bridge, automator });
    const ctx = createContext();

    await controller.handleSessionAction(ctx, 'reset');

    expect(bridge.resetSession).toHaveBeenCalledWith(undefined, 12000, 'bridge-4');
    expect(automator.ensureConversationSurface).toHaveBeenCalledWith(0, 4321);
    expect(automator.resetVisibleConversation).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      'Done. Restarted the visible ZavorthBridge conversation and confirmed the reset in the real UI.',
    );
  });

  it('falls back to a full app restart when the visible Manager conversation does not clear', async () => {
    const restart = jest.fn().mockResolvedValue({ ok: true });
    const bridge = createBridgeMock({
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue({
        instanceId: 'bridge-5',
        processId: 9876,
        capabilities: { canResetSession: true }})});
    const automator = createAutomatorMock({
      ensureConversationSurface: jest.fn().mockResolvedValue({
        ok: true,
        verified: false,
        mode: 'ensure-conversation-surface',
        message: 'ZavorthBridge UI still shows a permission request after reset.'})});
    const controller = createController({
      bridge,
      automator,
      zavorthBridgeControlService: { restart }});
    const ctx = createContext();

    await controller.handleSessionAction(ctx, 'reset');

    expect(restart).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      'Quick ZavorthBridge reset did not clean the visible conversation, so I restarted the entire app to give you a clean session.\nQuick reset reason: ZavorthBridge UI still shows a permission request after reset.',
    );
  });

  it('reports both failures when /agreset cannot verify the UI reset and the app restart also fails', async () => {
    const bridge = createBridgeMock({
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue({
        instanceId: 'bridge-6',
        processId: 2468,
        capabilities: { canResetSession: true }})});
    const automator = createAutomatorMock({
      ensureConversationSurface: jest.fn().mockResolvedValue({
        ok: false,
        verified: false,
        mode: 'ensure-conversation-surface',
        message: 'The chat surface was not ready after the bridge reset.'})});
    const controller = createController({
      bridge,
      automator,
      zavorthBridgeControlService: {
        restart: jest.fn().mockResolvedValue({
          ok: false,
          errorMessage: 'Failed to restart ZavorthBridge.'})}});
    const ctx = createContext();

    await controller.handleSessionAction(ctx, 'reset');

    expect(ctx.reply).toHaveBeenCalledWith(
      'Triggered ZavorthBridge reset, but could not confirm a clean conversation in the real UI.\nReason: The chat surface was not ready after the bridge reset.\nAlso failed to restart the app: Failed to restart ZavorthBridge.',
    );
  });

  it('keeps /agmodel responses short and explicit', async () => {
    const controller = createController({
      zavorthBridgeControlService: {
        setModel: jest.fn().mockResolvedValue({
          ok: true,
          action: 'set-model',
          stage: 'completed',
          verified: true,
          appInstalled: true,
          processFound: true,
          windowFound: true,
          processId: 123,
          windowTitle: 'ZavorthBridge',
          selectedModel: 'gemini-3.1-flash',
          modelKey: 'gemini-3.1-flash',
          errorCode: null,
          errorMessage: null,
          logFile: null,
          diagnostics: null})}});
    const ctx = createContext();

    await controller.handleModelCommand(ctx, 'gemini-3.1-flash');

    expect(ctx.reply).toHaveBeenCalledWith('Done. ZavorthBridge model confirmed: gemini-3.1-flash.');
  });

  it('formats ZavorthBridge status replies with readiness and remote mode details', async () => {
    const controller = createController({
      zavorthBridgeControlService: {
        status: jest.fn().mockResolvedValue({
          ok: true,
          action: 'status',
          verified: true,
          appInstalled: true,
          processFound: true,
          windowFound: true,
          sessionAccessible: true,
          remoteModeActive: true,
          selectedModel: 'gemini-3.1-flash',
          errorMessage: null})}});
    const ctx = createContext();

    await controller.handleControl(ctx, 'status');

    expect(ctx.reply).toHaveBeenCalledWith(
      ['ZavorthBridge status: ready for remote use.', 'Model: gemini-3.1-flash', 'Session accessible: yes', 'Remote mode: active'].join('\n'),
    );
  });

  it('opens a bridge handoff and records the companion instance in the tracking file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-');
    const trackingFile = path.join(tempDir, 'tracking.json');
    fs.writeFileSync(trackingFile, JSON.stringify({ source: 'test' }, null, 2), 'utf8');
    const bridge = createBridgeMock({
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue({
        instanceId: 'bridge-live-1'})});
    const persistTask = jest.fn();
    const executePromptSpy = jest
      .spyOn(ZavorthBridgeCliAdapter.prototype, 'executePrompt')
      .mockResolvedValue({
        executor: 'zavorthBridge',
        metadata: {
          delivery_mode: 'handoff',
          handoff_file: 'C:/tmp/handoff.json',
          tracking_file: trackingFile,
          response_file: 'C:/tmp/response.md',
          preferred_model: 'gemini-3.1-flash',
          companion_instance_id: null}} as any);
    const controller = createController({ bridge, persistTask });
    const ctx = createContext();
    const task = {
      task_id: 'task-ag-handoff-1',
      chat_id: '123',
      workspace: 'C:/workspace/zavorth',
      metadata: {}} as any;

    try {
      await controller.handleTaskExecution(ctx, task, 'abra o zavorthBridge e continue esta tarefa');

      expect(bridge.openHandoff).toHaveBeenCalledWith('C:/tmp/handoff.json', 'task-ag-handoff-1');
      expect(bridge.syncPendingHandoffs).toHaveBeenCalledWith('task-ag-handoff-1');
      expect(task.metadata.zavorthBridgeCompanionInstanceId).toBe('bridge-live-1');
      expect(JSON.parse(fs.readFileSync(trackingFile, 'utf8')).companionInstanceId).toBe('bridge-live-1');
      expect(persistTask).toHaveBeenCalled();
      expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Delivered the task to the real ZavorthBridge.');
    } finally {
      executePromptSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('surfaces ZavorthBridge task launch failures with a research fallback hint', async () => {
    const executePromptSpy = jest
      .spyOn(ZavorthBridgeCliAdapter.prototype, 'executePrompt')
      .mockRejectedValue(new Error('O ZavorthBridge not abriu uma session reutilizavel na workspace correta.');
    const controller = createController();
    const ctx = createContext();
    const task = {
      task_id: 'task-ag-3',
      workspace: 'C:/workspace/zavorth'} as any;

    try {
      await controller.handleTaskExecution(ctx, task, 'research today news');
    } finally {
      executePromptSpy.mockRestore();
    }

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Immediate alternative for web research: use /research <topic>.');
  });

  it('routes pure research prompts straight to the web path before any AG launch attempt', async () => {
    const error: any = new Error('A superficie direta do chat do ZavorthBridge not ficou pronta.');
    error.code = 'direct_chat_unavailable';
    const executePromptSpy = jest
      .spyOn(ZavorthBridgeCliAdapter.prototype, 'executePrompt')
      .mockRejectedValue(error);
    const runResearchFallback = jest
      .fn()
      .mockResolvedValue('*Resumo web*\n- Fonte A\n- Fonte B');
    const controller = createController({ runResearchFallback });
    const ctx = createContext();
    const task = {
      task_id: 'task-ag-4',
      chat_id: '123',
      workspace: 'C:/workspace/zavorth',
      metadata: { responseDecision: { requestedTools: ['web_search'] } }} as any;

    await controller.handleTaskExecution(ctx, task, 'research the latest technology news of the day');

    expect(executePromptSpy).not.toHaveBeenCalled();
    expect(runResearchFallback).toHaveBeenCalledWith('research the latest technology news of the day');
    expect(ctx.reply).toHaveBeenCalledWith(
      'This request looks like web research. I will answer through Zavorth structured web route instead of opening ZavorthBridge.',
    );
  }, 15000);

  it('routes clear web research requests directly to the web research path before launching ZavorthBridge', async () => {
    const executePromptSpy = jest.spyOn(ZavorthBridgeCliAdapter.prototype, 'executePrompt');
    const runResearchFallback = jest.fn().mockResolvedValue('*Resumo web*\n- Fonte A\n- Fonte B');
    const controller = createController({ runResearchFallback });
    const ctx = createContext();
    const task = {
      task_id: 'task-ag-5',
      chat_id: '123',
      workspace: 'C:/workspace/zavorth',
      metadata: { responseDecision: { requestedTools: ['web_search'] } }} as any;

    await controller.handleTaskExecution(ctx, task, 'research the main technology news of the day');

    expect(executePromptSpy).not.toHaveBeenCalled();
    expect(runResearchFallback).toHaveBeenCalledWith('research the main technology news of the day');
    expect(ctx.reply).toHaveBeenCalledWith(
      'This request looks like web research. I will answer through Zavorth structured web route instead of opening ZavorthBridge.',
    );
  }, 15000);

  it('does not bypass ZavorthBridge for prompts about local folders even when they contain "pesquise"', async () => {
    const executePromptSpy = jest
      .spyOn(ZavorthBridgeCliAdapter.prototype, 'executePrompt')
      .mockRejectedValue(new Error('workspace mismatch');
    const runResearchFallback = jest.fn().mockResolvedValue('*Resumo web*\n- Fonte A');
    const controller = createController({ runResearchFallback });
    const ctx = createContext();
    const task = {
      task_id: 'task-ag-local-folder',
      chat_id: '123',
      workspace: 'C:/workspace/zavorth'} as any;

    await controller.handleTaskExecution(ctx, task, 'research what is inside my TESTE DEV folder');

    expect(executePromptSpy).toHaveBeenCalled();
    expect(runResearchFallback).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalledWith(
      'This request looks like web research. I will answer through Zavorth structured web route instead of opening ZavorthBridge.',
    );
  });
});
