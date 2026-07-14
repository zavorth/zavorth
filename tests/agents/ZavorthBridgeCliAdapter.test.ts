import { ZavorthBridgeCliAdapter } from '../../src/agents/ZavorthBridgeCliAdapter';
import { config } from '../../src/config/index.js';

describe('ZavorthBridgeCliAdapter', () => {
  const workspace = config.defaultWorkspace.replace(/\\/g, '/');
  const workspaceRoot = config.workspaceRoot.replace(/\\/g, '/');

  afterEach(() => {
    config.zavorthBridgeStartNewConversationPerTask = false;
    config.zavorthBridgeWindowStrategy = 'reuse-window';
  });

  function createTask() {
    return {
      task_id: 'task-123',
      chat_id: 'chat-1',
      user_id: 'user-1',
    } as any;
  }

  function createHandoff() {
    return {
      taskId: 'task-123',
      workspace: workspace,
      prompt: "search today's news",
      handoffFile: `${workspace}/data/agent-bridge/zavorth-bridge/handoffs/task-123.md`,
      trackingFile: `${workspace}/data/agent-bridge/zavorth-bridge/pending/task-123.json`,
      responseFile: `${workspace}/data/agent-bridge/zavorth-bridge/responses/task-123.md`,
      launchedAt: '2026-03-25T12:00:00.000Z',
    };
  }

  it('treats a parent workspace folder as compatible for ZavorthBridge reuse', () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;

    expect(
      adapter.isWorkspaceCompatible([workspaceRoot], workspace),
    ).toBe(true);
  });

  it('bootstraps the workspace and reuses the live companion session', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const reusableStatus = {
      instanceId: 'bridge-1',
      processId: 321,
      workspaceFolders: [workspaceRoot],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
      },
    };

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue('Gemini 3 Flash'),
    };
    adapter.windowAutomator = {
      focusWindow: jest.fn().mockResolvedValue(undefined),
      switchModel: jest.fn().mockResolvedValue(undefined),
      verifyModel: jest.fn().mockResolvedValue(undefined),
      ensureConversationSurface: jest.fn().mockResolvedValue({ ok: true, verified: true }),
      readLatestResponse: jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 'ready',
          responseText: 'resposta anterior',
          hasPermissionPrompt: false,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 'generating',
          responseText: '',
          hasPermissionPrompt: false,
        }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(reusableStatus),
      supports: jest.fn().mockResolvedValue(false),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
      sendAgentPrompt: jest.fn().mockResolvedValue({ ok: true }),
    };
    adapter.waitForCompatibleBridgeStatus = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reusableStatus)
      .mockResolvedValueOnce(reusableStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    const result = await adapter.executePrompt(
      createTask(),
      "search today's news",
      workspace,
    );

    expect(adapter.launch).toHaveBeenCalledWith(
      ['--profile', 'zavorth-model-test', '--reuse-window', workspace],
      workspace,
    );
    expect(adapter.windowAutomator.focusWindow).toHaveBeenCalledWith(200, 321);
    expect(adapter.windowAutomator.ensureConversationSurface).toHaveBeenCalledWith(600, 321);
    expect(adapter.windowAutomator.pasteAndSubmit).toHaveBeenCalledWith(
      expect.stringContaining('Answer the user directly in this chat'),
      200,
      321,
    );
    expect(adapter.companionBridge.sendAgentPrompt).not.toHaveBeenCalled();
    expect(result.executor).toBe('zavorthBridge_companion');
    expect(result.metadata.delivery_mode).toBe('companion-reuse');
    expect(result.metadata.prompt_delivery).toBe('window-automation:paste-and-submit');
  });

  it('prefers prompt delivery through the companion bridge when send-agent-prompt is available', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const reusableStatus = {
      instanceId: 'bridge-send-1',
      processId: 654,
      workspaceFolders: [workspaceRoot],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
        canSendAgentPrompt: true,
      },
    };

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue(null),
    };
    adapter.windowAutomator = {
      focusWindow: jest.fn().mockResolvedValue(undefined),
      switchModel: jest.fn().mockResolvedValue(undefined),
      verifyModel: jest.fn().mockResolvedValue(undefined),
      ensureConversationSurface: jest.fn().mockResolvedValue({ ok: true, verified: true }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(reusableStatus),
      supports: jest.fn().mockImplementation(async (capability: string) => capability === 'canSendAgentPrompt'),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
      sendAgentPrompt: jest.fn().mockResolvedValue({ ok: true }),
    };
    adapter.waitForCompatibleBridgeStatus = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reusableStatus)
      .mockResolvedValueOnce(reusableStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    const result = await adapter.executePrompt(
      createTask(),
      'responda apenas com ZAVORTH BRIDGE SEND OK',
      workspace,
    );

    expect(adapter.companionBridge.sendAgentPrompt).toHaveBeenCalledWith(
      expect.stringContaining('ZAVORTH BRIDGE SEND OK'),
      'task-123',
      8000,
      'bridge-send-1',
    );
    expect(adapter.windowAutomator.pasteAndSubmit).not.toHaveBeenCalled();
    expect(result.metadata.prompt_delivery).toBe('companion-bridge:send-agent-prompt');
  });

  it('falls back to window automation when bridge prompt delivery succeeds but no new ZavorthBridge activity is observed', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const reusableStatus = {
      instanceId: 'bridge-send-3',
      processId: 656,
      workspaceFolders: [workspaceRoot],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
        canSendAgentPrompt: true,
      },
    };

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue(null),
    };
    adapter.windowAutomator = {
      focusWindow: jest.fn().mockResolvedValue(undefined),
      switchModel: jest.fn().mockResolvedValue(undefined),
      verifyModel: jest.fn().mockResolvedValue(undefined),
      ensureConversationSurface: jest.fn().mockResolvedValue({ ok: true, verified: true }),
      readLatestResponse: jest.fn().mockResolvedValue({
        ok: true,
        status: 'ready',
        responseText: 'resposta anterior',
        hasPermissionPrompt: false,
      }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(reusableStatus),
      supports: jest.fn().mockImplementation(async (capability: string) => capability === 'canSendAgentPrompt'),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
      sendAgentPrompt: jest.fn().mockResolvedValue({ ok: true }),
    };
    adapter.waitForCompatibleBridgeStatus = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reusableStatus)
      .mockResolvedValueOnce(reusableStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    const result = await adapter.executePrompt(
      createTask(),
      'responda apenas com ZAVORTH BRIDGE VERIFIED FALLBACK OK',
      workspace,
    );

    expect(adapter.companionBridge.sendAgentPrompt).toHaveBeenCalled();
    expect(adapter.windowAutomator.pasteAndSubmit).toHaveBeenCalled();
    expect(result.metadata.prompt_delivery).toBe(
      'companion-bridge:send-agent-prompt-unconfirmed + window-automation:paste-and-submit',
    );
  });

  it('falls back to window automation when bridge prompt delivery is available but fails', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const reusableStatus = {
      instanceId: 'bridge-send-2',
      processId: 655,
      workspaceFolders: [workspaceRoot],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
        canSendAgentPrompt: true,
      },
    };

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue(null),
    };
    adapter.windowAutomator = {
      focusWindow: jest.fn().mockResolvedValue(undefined),
      switchModel: jest.fn().mockResolvedValue(undefined),
      verifyModel: jest.fn().mockResolvedValue(undefined),
      ensureConversationSurface: jest.fn().mockResolvedValue({ ok: true, verified: true }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(reusableStatus),
      supports: jest.fn().mockImplementation(async (capability: string) => capability === 'canSendAgentPrompt'),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
      sendAgentPrompt: jest.fn().mockRejectedValue(new Error('Bridge send failed')),
    };
    adapter.waitForCompatibleBridgeStatus = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reusableStatus)
      .mockResolvedValueOnce(reusableStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    const result = await adapter.executePrompt(
      createTask(),
      'responda apenas com ZAVORTH BRIDGE FALLBACK OK',
      workspace,
    );

    expect(adapter.companionBridge.sendAgentPrompt).toHaveBeenCalled();
    expect(adapter.windowAutomator.pasteAndSubmit).toHaveBeenCalled();
    expect(result.metadata.prompt_delivery).toBe('window-automation:paste-and-submit');
  });

  it('fails explicitly when no reusable workspace session becomes available', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue('Gemini 3 Flash'),
    };
    adapter.companionBridge = {
      readStatus: jest.fn().mockResolvedValue({
        instanceId: 'bridge-2',
        workspaceFolders: [],
        capabilities: {
          canSendAgentPrompt: true,
        },
      }),
    };
    adapter.waitForCompatibleBridgeStatus = jest.fn().mockResolvedValue(null);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    await expect(
      adapter.executePrompt(
        createTask(),
        "search today's news",
        workspace,
      ),
    ).rejects.toThrow(/workspace correta|correct workspace/i);
  });

  it('accepts the visible ZavorthBridge window as compatible when the bridge workspace snapshot is empty', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const bridgeStatus = {
      instanceId: 'bridge-window-fallback',
      processId: 444,
      workspaceFolders: [],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
      },
    };

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue(null),
    };
    adapter.windowAutomator = {
      focusWindow: jest
        .fn()
        .mockResolvedValue({ ok: true, windowTitle: 'Zavorth - zavorth-model-test - ZavorthBridge' }),
      ensureConversationSurface: jest.fn().mockResolvedValue({
        ok: true,
        verified: true,
        diagnostics: {
          promptSurfaceReady: true,
          homeScreenAfter: true,
          hasInputBar: true,
        },
      }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(bridgeStatus),
      supports: jest.fn().mockResolvedValue(false),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
    };
    adapter.waitForCompatibleBridgeStatus = jest.fn().mockResolvedValue(bridgeStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    const result = await adapter.executePrompt(
      createTask(),
      'responda apenas com ZAVORTH WINDOW TITLE OK',
      workspace,
    );

    expect(adapter.windowAutomator.pasteAndSubmit).toHaveBeenCalled();
    expect(result.metadata.delivery_mode).toBe('companion-reuse');
  });

  it('respects the configured new-window strategy during workspace bootstrap', () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    config.zavorthBridgeWindowStrategy = 'new-window';

    expect(adapter.buildWorkspaceBootstrapArgs(workspace)).toEqual([
      ['--profile', 'zavorth-model-test', '--new-window', workspace],
      ['--new-window', workspace],
      ['--profile', 'zavorth-model-test', workspace],
      [workspace],
    ]);
  });

  it('fails fast when the conversation surface is not automation-ready', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const reusableStatus = {
      instanceId: 'bridge-3',
      processId: 444,
      workspaceFolders: [workspaceRoot],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
      },
    };

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue(null),
    };
    adapter.windowAutomator = {
      focusWindow: jest.fn().mockResolvedValue(undefined),
      ensureConversationSurface: jest.fn().mockResolvedValue({
        ok: false,
        verified: false,
        message: 'surface unavailable',
        diagnostics: {
          promptSurfaceReady: false,
          homeScreenAfter: true,
          hasInputBar: false,
        },
      }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(reusableStatus),
      supports: jest.fn().mockImplementation(async (capability: string) => capability === 'canStartNewConversation'),
      startNewConversation: jest.fn().mockResolvedValue({ ok: true }),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
      sendAgentPrompt: jest.fn().mockResolvedValue({ ok: true }),
    };
    adapter.waitForCompatibleBridgeStatus = jest.fn().mockResolvedValue(reusableStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    await expect(
      adapter.executePrompt(
        createTask(),
        "search today's news",
        workspace,
      ),
    ).rejects.toMatchObject({
      code: 'direct_chat_unavailable',
    });

    expect(adapter.windowAutomator.pasteAndSubmit).not.toHaveBeenCalled();
    expect(adapter.companionBridge.sendAgentPrompt).not.toHaveBeenCalled();
  });

  it('accepts a home-screen surface when the prompt input is available', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const reusableStatus = {
      instanceId: 'bridge-9',
      processId: 999,
      workspaceFolders: [workspaceRoot],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
      },
    };

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue(null),
    };
    adapter.windowAutomator = {
      focusWindow: jest.fn().mockResolvedValue(undefined),
      ensureConversationSurface: jest.fn().mockResolvedValue({
        ok: true,
        verified: true,
        diagnostics: {
          promptSurfaceReady: true,
          homeScreenAfter: true,
          hasInputBar: true,
        },
      }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(reusableStatus),
      supports: jest.fn().mockResolvedValue(false),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
    };
    adapter.waitForCompatibleBridgeStatus = jest.fn().mockResolvedValue(reusableStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    const result = await adapter.executePrompt(
      createTask(),
      'responda apenas com OK',
      workspace,
    );

    expect(adapter.windowAutomator.pasteAndSubmit).toHaveBeenCalled();
    expect(result.metadata.prompt_delivery).toBe('window-automation:paste-and-submit');
  });

  it('reuses the current ZavorthBridge conversation by default instead of starting a new one per task', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const reusableStatus = {
      instanceId: 'bridge-7',
      processId: 777,
      activeEditor: 'conversation.md',
      workspaceFolders: [workspaceRoot],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
      },
    };

    config.zavorthBridgeStartNewConversationPerTask = false;

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue(null),
    };
    adapter.windowAutomator = {
      focusWindow: jest.fn().mockResolvedValue(undefined),
      ensureConversationSurface: jest.fn().mockResolvedValue({
        ok: true,
        verified: true,
        diagnostics: {
          promptSurfaceReady: true,
          homeScreenAfter: false,
          hasInputBar: true,
        },
      }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(reusableStatus),
      supports: jest.fn().mockImplementation(async (capability: string) => capability === 'canStartNewConversation'),
      startNewConversation: jest.fn().mockResolvedValue({ ok: true }),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
      sendAgentPrompt: jest.fn().mockResolvedValue({ ok: true }),
    };
    adapter.waitForCompatibleBridgeStatus = jest.fn().mockResolvedValue(reusableStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    const result = await adapter.executePrompt(
      createTask(),
      "search today's news",
      workspace,
    );

    expect(adapter.companionBridge.startNewConversation).not.toHaveBeenCalled();
    expect(result.metadata.conversation_mode).toBe('reuse-current');
  });

  it('cleans old Zavorth editors before starting a fresh conversation', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;
    const handoff = createHandoff();
    const reusableStatus = {
      instanceId: 'bridge-8',
      processId: 888,
      activeEditor:
        `${workspace}/data/agent-bridge/zavorth-bridge/handoffs/old-task.md`,
      workspaceFolders: [workspaceRoot],
      capabilities: {
        canExecuteCommand: true,
        canOpenAgentPanel: true,
      },
    };

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([]),
      createZavorthBridgeHandoff: jest.fn().mockResolvedValue(handoff),
    };
    adapter.preferenceStore = {
      getPreferredModel: jest.fn().mockResolvedValue(null),
    };
    adapter.windowAutomator = {
      focusWindow: jest.fn().mockResolvedValue(undefined),
      ensureConversationSurface: jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          verified: false,
          diagnostics: {
            promptSurfaceReady: false,
            homeScreenAfter: true,
            hasInputBar: false,
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          verified: true,
          diagnostics: {
            promptSurfaceReady: true,
            homeScreenAfter: false,
            hasInputBar: true,
          },
        }),
      pasteAndSubmit: jest.fn().mockResolvedValue({ ok: true, verified: true }),
    };
    adapter.companionBridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue(reusableStatus),
      supports: jest.fn().mockImplementation(
        async (capability: string) => capability === 'canStartNewConversation' || capability === 'canCloseAllEditors',
      ),
      closeAllEditors: jest.fn().mockResolvedValue({ ok: true }),
      startNewConversation: jest.fn().mockResolvedValue({ ok: true }),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
      sendAgentPrompt: jest.fn().mockResolvedValue({ ok: true }),
    };
    adapter.waitForCompatibleBridgeStatus = jest.fn().mockResolvedValue(reusableStatus);
    adapter.launch = jest.fn().mockResolvedValue(undefined);

    const result = await adapter.executePrompt(
      createTask(),
      "search today's news",
      workspace,
    );

    expect(adapter.companionBridge.closeAllEditors).toHaveBeenCalledWith(
      'task-123',
      8000,
      'bridge-8',
    );
    expect(adapter.companionBridge.startNewConversation).toHaveBeenCalledWith(
      'task-123',
      8000,
      'bridge-8',
    );
    expect(result.metadata.preflight_action).toContain('close-all-editors-from-artifact-editor');
    expect(result.metadata.preflight_action).toContain('start-new-conversation-from-artifact-editor');
  });

  it('blocks a new task while another ZavorthBridge handoff is still active', async () => {
    const adapter = new ZavorthBridgeCliAdapter() as any;

    adapter.bridgeManager = {
      listPendingSessions: jest.fn().mockResolvedValue([
        {
          taskId: 'running-task-1',
          launchedAt: new Date().toISOString(),
          completedAt: null,
        },
      ]),
      createZavorthBridgeHandoff: jest.fn(),
    };

    await expect(
      adapter.executePrompt(
        createTask(),
        "search today's news",
        workspace,
      ),
    ).rejects.toThrow('ainda esta ocupado com a tarefa');
    expect(adapter.bridgeManager.createZavorthBridgeHandoff).not.toHaveBeenCalled();
  });
});
