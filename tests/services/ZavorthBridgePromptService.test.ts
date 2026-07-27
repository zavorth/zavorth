import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthBridgePromptService } from '../../src/services/ZavorthBridgePromptService';
import { config } from '../../src/config/index.js';
import type {
  ZavorthBridgePromptStartResult,
} from '../../src/services/ZavorthBridgePromptService';
import type { Task } from '../../src/contracts/TaskContract';

const createTask = (): Task => ({
  task_id: 'task-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  source: 'telegram',
  chat_id: 'chat-1',
  user_id: 'user-1',
  raw_message: '/ag_prompt gemini | teste',
  normalized_message: '/ag_prompt gemini | teste',
  command_type: '/ag_prompt',
  intent: 'zavorthBridge_prompt',
  target: null,
  workspace: 'C:/workspace/zavorth',
  risk_level: 1,
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
});

const createStartResult = (overrides: Partial<ZavorthBridgePromptStartResult> = {}): ZavorthBridgePromptStartResult => ({
  ok: true,
  taskId: 'task-123',
  stage: 'prompt_sent',
  verified: true,
  promptText: 'responda teste',
  selectedModel: 'gemini-3.1-flash',
  modelKey: 'gemini-3.1-flash',
  trackingFile: 'tracking.json',
  responseFile: 'response.md',
  handoffFile: 'handoff.md',
  companionInstanceId: 'instance-1',
  processId: 123,
  windowTitle: 'ZavorthBridge',
  message: 'Prompt sent to the real ZavorthBridge panel.',
  errorCode: null,
  errorMessage: null,
  logFile: null,
  diagnostics: null,
  remoteModeActive: false,
  sessionAccessible: true,
  desktopName: 'Default',
  sessionMessage: null,
  ...overrides,
});

describe('ZavorthBridgePromptService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    jest.restoreAllMocks();
    config.zavorthBridgeStartNewConversationPerTask = false;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('returns prompt_required when the prompt is empty', async () => {
    const service = new ZavorthBridgePromptService({} as any);

    const result = await service.start(createTask(), 'gemini-3.1-flash', '   ');

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('validation');
    expect(result.errorCode).toBe('prompt_required');
  });

  it('maps a model preparation failure before trying to use the bridge', async () => {
    const service = new ZavorthBridgePromptService({} as any) as any;
    service.controlService = {
      setModel: jest.fn().mockResolvedValue({
        ok: false,
        stage: 'set-model',
        verified: false,
        selectedModel: null,
        modelKey: null,
        processId: null,
        windowTitle: null,
        message: 'Failure ao trocar modelo.',
        errorCode: 'model_switch_failed',
        errorMessage: 'Troca recusada.',
        logFile: 'ag.log',
        diagnostics: { attempt: 1 },
        remoteModeActive: false,
        sessionAccessible: true,
        desktopName: 'Default',
        sessionMessage: null,
      }),
    };

    const result = await service.start(createTask(), 'gemini-3.1-flash', 'responda oi');

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('set-model');
    expect(result.errorCode).toBe('model_switch_failed');
    expect(result.logFile).toBe('ag.log');
  });

  it('returns bridge_offline when the model is ready but the bridge is unavailable', async () => {
    const service = new ZavorthBridgePromptService({} as any) as any;
    service.controlService = {
      setModel: jest.fn().mockResolvedValue({
        ok: true,
        stage: 'set-model',
        verified: true,
        selectedModel: 'gemini-3.1-flash',
        modelKey: 'gemini-3.1-flash',
        processId: 77,
        windowTitle: 'ZavorthBridge',
        logFile: 'ag.log',
        diagnostics: { source: 'test' },
      }),
    };
    service.bridge = {
      isOnline: jest.fn().mockResolvedValue(false),
    };

    const result = await service.start(createTask(), 'gemini-3.1-flash', 'responda oi');

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('bridge');
    expect(result.errorCode).toBe('bridge_offline');
    expect(result.selectedModel).toBe('gemini-3.1-flash');
  });

  it('returns prompt_sent and persists session metadata on the there isppy path', async () => {
    const service = new ZavorthBridgePromptService({} as any) as any;
    const saveSession = jest.fn().mockResolvedValue(undefined);
    const session = {
      taskId: 'task-123',
      trackingFile: 'tracking.json',
      companionInstanceId: null,
      sessionKind: 'chat',
      automationEnabled: true,
    };

    service.controlService = {
      setModel: jest.fn().mockResolvedValue({
        ok: true,
        stage: 'set-model',
        verified: true,
        selectedModel: 'gemini-3.1-flash',
        modelKey: 'gemini-3.1-flash',
        processId: 321,
        windowTitle: 'ZavorthBridge',
        logFile: null,
        diagnostics: { model: 'gemini-3.1-flash' },
      }),
      ensurePromptInteractionReady: jest.fn().mockResolvedValue({
        ok: true,
        processId: 321,
        windowTitle: 'ZavorthBridge',
        diagnostics: { promptField: true },
        remoteModeActive: false,
        sessionAccessible: true,
        desktopName: 'Default',
        sessionMessage: null,
      }),
    };
    service.bridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      supports: jest.fn().mockResolvedValue(true),
    };
    service.bridgeManager = {
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue({
        trackingFile: 'tracking.json',
        responseFile: 'response.md',
        handoffFile: 'handoff.md',
      }),
      saveSession,
    };
    service.waitForFreshBridgeStatus = jest.fn().mockResolvedValue({ instanceId: 'instance-9' });
    service.ensureConversationSurfaceVisible = jest.fn().mockResolvedValue({ ready: true, diagnostics: { surface: 'ok' } });
    service.automator = {
      pasteAndSubmit: jest.fn().mockResolvedValue(undefined),
    };
    service.readSession = jest.fn().mockResolvedValue(session);

    const result = await service.start(createTask(), 'gemini-3.1-flash', 'responda oi');

    expect(result.ok).toBe(true);
    expect(result.stage).toBe('prompt_sent');
    expect(result.companionInstanceId).toBe('instance-9');
    expect(service.automator.pasteAndSubmit).toHaveBeenCalled();
    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        companionInstanceId: 'instance-9',
        sessionKind: 'prompt-panel',
        automationEnabled: false,
      }),
    );
  });

  it('returns response-file content and promotes it to .processed.md', async () => {
    const service = new ZavorthBridgePromptService({} as any) as any;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-prompt-'));
    tempDirs.push(tempDir);
    const responseFile = path.join(tempDir, 'response.md');
    const trackingFile = path.join(tempDir, 'tracking.json');
    const handoffFile = path.join(tempDir, 'handoff.md');

    fs.writeFileSync(responseFile, 'Final ZavorthBridge response', 'utf8');

    const result = await service.waitForCompletion(
      createStartResult({
        trackingFile,
        responseFile,
        handoffFile,
      }),
      100,
    );

    expect(result.ok).toBe(true);
    expect(result.source).toBe('response-file-processed');
    expect(result.text).toBe('Final ZavorthBridge response');
    expect(fs.existsSync(responseFile.replace(/\.md$/i, '.processed.md'))).toBe(true);
  });

  it('returns permission_prompt_visible when the UI shows a permission request', async () => {
    const service = new ZavorthBridgePromptService({} as any) as any;
    service.tryReadResponseFile = jest.fn().mockResolvedValue(null);
    service.readSession = jest.fn().mockResolvedValue(null);
    service.ensureConversationSurfaceVisible = jest.fn().mockResolvedValue({ ready: true });
    service.tryCaptureUiState = jest.fn().mockResolvedValue({
      ok: true,
      hasPermissionPrompt: true,
      screenshotPath: 'ui-capture.png',
    });

    const result = await service.waitForCompletion(
      createStartResult(),
      500,
    );

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('permission_prompt');
    expect(result.errorCode).toBe('permission_prompt_visible');
  });

  it('does not start a new ZavorthBridge conversation while recovering the prompt surface by default', async () => {
    const service = new ZavorthBridgePromptService({} as any) as any;
    config.zavorthBridgeStartNewConversationPerTask = false;
    service.bridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      supports: jest.fn().mockImplementation(async (capability: string) => capability === 'canStartNewConversation'),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
    };
    service.probeConversationSurface = jest.fn().mockResolvedValue({ ready: false });
    service.recoverConversationSurface = jest
      .fn()
      .mockResolvedValueOnce({ ready: false })
      .mockResolvedValueOnce({ ready: true, diagnostics: { surface: 'ok' } });
    service.delay = jest.fn().mockResolvedValue(undefined);

    const result = await service.ensureConversationSurfaceVisible({
      taskId: 'task-123',
      targetInstanceId: 'bridge-1',
      processId: 321,
      expectedModel: 'gemini-3.1-flash',
      stage: 'send',
    });

    expect(result.ready).toBe(true);
    expect(service.bridge.executeCommand).toHaveBeenCalledWith(
      'zavorthBridge.openAgent',
      [],
      'task-123',
      5000,
      'bridge-1',
    );
    expect(service.bridge.executeCommand).not.toHaveBeenCalledWith(
      'zavorthBridge.startNewConversation',
      [],
      'task-123',
      5000,
      'bridge-1',
    );
  });

  it('returns timeout when no output appears before the deadline', async () => {
    const service = new ZavorthBridgePromptService({} as any) as any;

    const result = await service.waitForCompletion(createStartResult(), 0);

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('timeout');
    expect(result.errorCode).toBe('prompt_timeout');
  });
});
