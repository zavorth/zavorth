import crypto from 'crypto';
import { TelegramPermissionController } from '../../../src/gateways/channels/telegram/controllers/TelegramPermissionController';
import { ZavorthBridgeWindowAutomator } from '../../../src/agents/ZavorthBridgeWindowAutomator';
import { config } from '../../../src/config/index';

describe('TelegramPermissionController', () => {
  const originalHighRiskPin = config.highRiskApprovalPin;
  const originalHighRiskTotpSecret = config.highRiskApprovalTotpSecret;
  const originalHighRiskTotpSecretRef = (config as any).highRiskApprovalTotpSecretRef;
  const originalHighRiskTotpEnvFallback = (config as any).highRiskApprovalAllowEnvFallback;

  afterEach(() => {
    (config as any).highRiskApprovalPin = originalHighRiskPin;
    (config as any).highRiskApprovalTotpSecret = originalHighRiskTotpSecret;
    (config as any).highRiskApprovalTotpSecretRef = originalHighRiskTotpSecretRef;
    (config as any).highRiskApprovalAllowEnvFallback = originalHighRiskTotpEnvFallback;
    jest.restoreAllMocks();
  });

  function createController(overrides: Record<string, any> = {}) {
    const createCompanionBridge =
      overrides.createCompanionBridge ||
      (() => ({
        isOnline: jest.fn().mockResolvedValue(false),
        readStatus: jest.fn().mockResolvedValue(null),
      }));
    return new TelegramPermissionController({
      permissionService: {
        grantPolicy: jest.fn().mockResolvedValue({
          permission_id: 'perm-1',
          executor: 'codex',
          kind: 'command_access',
          scope: 'persistent',
          resolved_value: 'npm test',
          decision_note: null,
        }),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-1',
          executor: 'codex',
          kind: 'command_access',
          scope: 'persistent',
          resolved_value: 'npm test',
          metadata: {},
        }),
        rejectRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-1',
          executor: 'codex',
          kind: 'command_access',
          scope: 'persistent',
          resolved_value: 'npm test',
          decision_note: 'revogado',
        }),
        listRequests: jest.fn().mockResolvedValue([]),
        listApprovedRequests: jest.fn().mockResolvedValue([]),
        getRequest: jest.fn().mockResolvedValue(null),
      } as any,
      taskManager: {
        getTask: jest.fn(),
        advanceState: jest.fn(),
      } as any,
      botApi: { sendMessage: jest.fn() },
      persistTask: jest.fn(),
      getZavorthBridgeController: jest.fn() as any,
      resumeTaskExecution: jest.fn(),
      resumeWorkflowExecution: jest.fn().mockResolvedValue(false),
      workflowRunService: {
        applyStageApprovalDecision: jest.fn(),
      },
      createCompanionBridge,
      ...overrides,
    });
  }

  it('creates persistent policies via /permallow with normalized kinds', async () => {
    const grantPolicy = jest.fn().mockResolvedValue({
      permission_id: 'perm-1',
      executor: 'codex',
      kind: 'command_access',
      scope: 'persistent',
      resolved_value: 'npm test',
      decision_note: null,
    });
    const controller = createController({
      permissionService: {
        grantPolicy,
      },
    });
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionAllowCommand(
      ctx,
      'executor=codex kind=command value="npm test" scope=persistent',
    );

    expect(grantPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        executor: 'codex',
        kind: 'command_access',
        scope: 'persistent',
        requested_value: 'npm test',
        resolved_value: 'npm test',
        metadata: expect.objectContaining({
          match_type: 'exact',
        }),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Aprovado'));
  });

  it('accepts fine-grained policy hints in /permallow for path and command permissions', async () => {
    const grantPolicy = jest.fn().mockResolvedValue({
      permission_id: 'perm-2',
      executor: 'file_delivery',
      kind: 'workspace_access',
      scope: 'workspace',
      resolved_value: 'C:/fora',
      decision_note: null,
    });
    const controller = createController({
      permissionService: {
        grantPolicy,
      } as any,
    });
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionAllowCommand(
      ctx,
      'executor=file_delivery kind=folder value="C:/fora" scope=workspace access=read_write',
    );

    expect(grantPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          access_level: 'read_write',
        }),
      }),
    );
  });

  it('revokes a policy through /permrevoke using short ids', async () => {
    const rejectRequest = jest.fn().mockResolvedValue({
      permission_id: 'perm-1',
      executor: 'codex',
      kind: 'command_access',
      scope: 'persistent',
      resolved_value: 'npm test',
      decision_note: 'revogado',
    });
    const controller = createController({
      permissionService: {
        getRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-12345678',
          executor: 'codex',
          kind: 'command_access',
          scope: 'persistent',
          resolved_value: 'npm test',
        }),
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-12345678',
            executor: 'codex',
            kind: 'command_access',
            scope: 'persistent',
            resolved_value: 'npm test',
          },
        ]),
        rejectRequest,
      } as any,
    });
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionRevokeCommand(ctx, 'perm-123 revogada pelo operador');

    expect(rejectRequest).toHaveBeenCalledWith(
      'perm-12345678',
      '42',
      'revogada pelo operador',
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Rejeitado'));
  });

  it('formats created permission prompts with quick actions', () => {
    const controller = createController();

    const text = controller.formatPermissionCreatedMessage({
      permission_id: 'perm-12345678',
      executor: 'external_executor',
      kind: 'agent_binding',
      scope: 'workspace',
      reason: 'workspace mismatch',
      workspace: 'C:/repo',
      requested_value: '/mnt/c/repo',
      resolved_value: 'zavorth',
      metadata: {
        agent_role: 'reviewer',
        suggested_command: 'runtime adapters bind zavorth --workspace "/mnt/c/repo" --non-interactive',
      },
    } as any);

    expect(text).toContain('I need your decision to unblock this ExternalExecutor workflow.');
    expect(text).toContain('Escolhas rapidas');
    expect(text).toContain('Use in this project');
    expect(text).toContain('Save for future requests');
    expect(text).toContain('Role: reviewer');
    expect(text).toContain('/perm approve perm-123 scope=workspace');
    expect(text).toContain('Technical suggestion');
  });

  it('formats permission lists with a more human-readable subject', () => {
    const controller = createController();

    const text = controller.formatPermissionList(
      [
        {
          permission_id: 'perm-file-12345678',
          executor: 'file_delivery',
          kind: 'workspace_access',
          scope: 'once',
          status: 'pending',
          requested_value: 'C:/fora',
          resolved_value: 'C:/fora',
          metadata: {
            permission_source: 'file_delivery',
            access_level: 'read_only',
          },
        },
      ] as any,
      'pending',
    );

    expect(text).toContain('Permissoes (pending - 1 item(ns))');
    expect(text).toContain('Local read for file delivery');
    expect(text).toContain('Escopo: somente esta tarefa');
  });

  it('shows permission details through /perm show with grouped sections', async () => {
    const permission = {
      permission_id: 'perm-external_executor-12345678',
      executor: 'external_executor',
      kind: 'agent_binding',
      scope: 'workspace',
      status: 'pending',
      workspace: 'C:/repo',
      task_id: 'task-123',
      requested_value: 'reviewer-agent',
      resolved_value: 'reviewer-agent',
      reason: 'workspace mismatch',
      created_at: '2026-04-04T10:00:00.000Z',
      updated_at: null,
      decided_by: null,
      decision_note: null,
      metadata: {
        agent_role: 'reviewer',
      },
    };
    const listRequests = jest.fn().mockImplementation(async (status: string) => {
      if (status === 'pending') {
        return [permission];
      }
      if (status === 'all') {
        return [permission];
      }
      return [];
    });
    const controller = createController({
      permissionService: {
        listRequests,
      } as any,
    });
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCommand(ctx, 'show perm-external_executor');

    const [message, options] = ctx.reply.mock.calls[0];
    expect(message).toContain('Resumo');
    expect(message).toContain('Executor interno: external_executor');
    expect(message).toContain('Valores:');
    expect(message).toContain('Historico:');
    expect(message).toContain('Papel: reviewer');
    expect(message).toContain('ExternalExecutor Agent [require_user_confirmation]');
    expect(message).toContain('- redacted: yes');
    expect(message).toContain('Acoes');
  });

  it('includes the detected ZavorthBridge prompt summary in the Telegram permission message', () => {
    const controller = createController();

    const text = controller.formatPermissionCreatedMessage({
      permission_id: 'perm-ag-12345678',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      reason: 'O ZavorthBridge pediu permissao na UI: Allow command execution for npm test',
      workspace: 'C:/repo',
      requested_value: 'approve-visible-step-once',
      resolved_value: 'approve-visible-step-once',
      metadata: {
        permission_prompt_summary: 'Allow command execution for npm test',
      },
    } as any);

    expect(text).toContain('Recommended approval');
    expect(text).toContain('Prompt detected: Allow command execution for npm test');
  });

  it('offers a conversation-scoped approval button for ZavorthBridge UI permissions', () => {
    const controller = createController();

    const keyboard = controller.buildPermissionKeyboard({
      permission_id: 'perm-zavorth-bridge-1',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      status: 'pending',
    } as any);

    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:approve:perm-zav:session');
    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:approve:perm-zav:once');
  });

  it('offers a task-scoped approval button for ExternalExecutor path access permissions', () => {
    const controller = createController();

    const keyboard = controller.buildPermissionKeyboard({
      permission_id: 'perm-external_executor-path-1',
      executor: 'external_executor',
      kind: 'workspace_access',
      scope: 'once',
      status: 'pending',
    } as any);

    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('Allow read-only for this task only');
    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:approve:perm-ext:once');
    expect(JSON.stringify(keyboard.inline_keyboard)).not.toContain('persistent');
  });

  it('offers scoped approval buttons for local file access permissions', () => {
    const controller = createController();

    const keyboard = controller.buildPermissionKeyboard({
      permission_id: 'perm-file-path-1',
      executor: 'file_delivery',
      kind: 'workspace_access',
      scope: 'once',
      status: 'pending',
    } as any);

    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('Allow read-only for this task only');
    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:approve:perm-fil:once');
    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:approve:perm-fil:workspace');
    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:reject:perm-fil');
  });

  it('formats local file access permission prompts with explicit guidance', () => {
    const controller = createController();

    const text = controller.formatPermissionCreatedMessage({
      permission_id: 'perm-file-12345678',
      executor: 'file_delivery',
      kind: 'workspace_access',
      scope: 'once',
      reason: 'Esse caminho existe, mas ainda nao esta nas areas liberadas para leitura e envio pelo Zavorth.',
      workspace: 'C:/repo',
      requested_value: 'C:/fora',
      resolved_value: 'C:/fora',
      metadata: {
        original_request: 'me envie "C:/fora/index.html"',
      },
    } as any);

    expect(text).toContain('Zavorth found the requested path');
    expect(text).toContain('Requested folder: C:/fora');
    expect(text).toContain('Access level to be granted: somente leitura e listagem');
    expect(text).toContain('Allow read-only for this task only');
    expect(text).toContain('/perm approve perm-fil scope=once access=read_only');
  });

  it('offers scoped approval buttons for Google AI Studio tools', () => {
    const controller = createController();

    const keyboard = controller.buildPermissionKeyboard({
      permission_id: 'perm-aistudio-tools-1',
      executor: 'aistudio',
      kind: 'builtin_tool_access',
      scope: 'once',
      status: 'pending',
      metadata: {
        requested_tools: ['google_search', 'code_execution'],
      },
    } as any);

    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:approve:perm-ais:once');
    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:approve:perm-ais:workspace');
    expect(JSON.stringify(keyboard.inline_keyboard)).toContain('perm:reject:perm-ais');
  });

  it('formats Google AI Studio permission prompts with explicit guidance', () => {
    const controller = createController();

    const text = controller.formatPermissionCreatedMessage({
      permission_id: 'perm-aistudio-12345678',
      executor: 'aistudio',
      kind: 'service_access',
      scope: 'once',
      reason: 'O Google AI Studio pediu acesso ao servico drive.',
      workspace: 'C:/repo',
      requested_value: 'drive',
      resolved_value: 'drive',
      metadata: {
        requested_services: ['drive'],
        suggested_model: 'gemini-2.5-pro',
        service_request_reason: 'Preciso ler um documento para concluir a tarefa.',
      },
    } as any);

    expect(text).toContain('Google AI Studio requested extra access');
    expect(text).toContain('Requested service(s): drive');
    expect(text).toContain('Suggested model: gemini-2.5-pro');
    expect(text).toContain('Allow for this task only');
    expect(text).toContain('/perm approve perm-ais scope=once');
  });

  it('creates manual ExternalExecutor bindings with an explicit role', async () => {
    const grantPolicy = jest.fn().mockResolvedValue({
      permission_id: 'perm-external_executor-1',
      executor: 'external_executor',
      kind: 'agent_binding',
      scope: 'persistent',
      resolved_value: 'reviewer-agent',
      decision_note: null,
    });
    const controller = createController({
      permissionService: {
        grantPolicy,
      } as any,
    });
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionAllowCommand(
      ctx,
      'executor=external_executor kind=agent_binding value=reviewer-agent role=reviewer scope=persistent workspace="C:/repo"',
    );

    expect(grantPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        executor: 'external_executor',
        kind: 'agent_binding',
        metadata: expect.objectContaining({
          agent_role: 'reviewer',
        }),
      }),
    );
  });

  it('preserves task-local extra allowed paths while loading persisted ExternalExecutor policies', async () => {
    const task = {
      workspace: 'C:/repo',
      metadata: {
        extra_allowed_paths: ['C:/workspace'],
        external_executor_agent_role: 'default',
      },
    };
    const listApprovedRequests = jest
      .fn()
      .mockResolvedValueOnce([
        {
          resolved_value: 'C:/repo/shared',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const persistTask = jest.fn();
    const controller = createController({
      permissionService: {
        listApprovedRequests,
      } as any,
      persistTask,
    });

    await controller.applyPersistedPermissionPolicies(task as any, 'external_executor');

    expect(task.metadata.extra_allowed_paths).toEqual(
      expect.arrayContaining(['C:/workspace', 'C:/repo/shared']),
    );
    expect(task.metadata.extra_allowed_path_policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'C:/repo/shared',
          access_level: 'read_only',
        }),
      ]),
    );
    expect(persistTask).toHaveBeenCalledWith(task);
  });

  it('loads persisted command policies with match type metadata', async () => {
    const task = {
      workspace: 'C:/repo',
      metadata: {
        extra_allowed_commands: ['npm test'],
      },
    };
    const listApprovedRequests = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          permission_id: 'perm-cmd-1',
          resolved_value: 'npm run *',
          metadata: { match_type: 'prefix' },
          scope: 'workspace',
        },
      ]);
    const persistTask = jest.fn();
    const controller = createController({
      permissionService: {
        listApprovedRequests,
      } as any,
      persistTask,
    });

    await controller.applyPersistedPermissionPolicies(task as any, 'codex');

    expect(task.metadata.extra_allowed_command_policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'npm run *',
          match_type: 'prefix',
        }),
      ]),
    );
    expect(persistTask).toHaveBeenCalledWith(task);
  });

  it('loads persisted Google AI Studio permissions into the task metadata', async () => {
    const task = {
      workspace: 'C:/repo',
      metadata: {
        aistudio_allowed_tools: ['google_search'],
      },
    };
    const listApprovedRequests = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          permission_id: 'perm-tool-1',
          resolved_value: 'google_search, code_execution',
          metadata: {
            requested_tools: ['google_search', 'code_execution'],
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          permission_id: 'perm-service-1',
          resolved_value: 'drive',
          metadata: {
            requested_services: ['drive'],
          },
        },
      ]);
    const persistTask = jest.fn();
    const controller = createController({
      permissionService: {
        listApprovedRequests,
      } as any,
      persistTask,
    });

    await controller.applyPersistedPermissionPolicies(task as any, 'aistudio');

    expect(task.metadata.aistudio_allowed_tools).toEqual(
      expect.arrayContaining(['google_search', 'code_execution']),
    );
    expect(task.metadata.aistudio_allowed_services).toEqual(['drive']);
    expect(persistTask).toHaveBeenCalledWith(task);
  });

  it('approves Google AI Studio tool access for the current task and resumes execution', async () => {
    const task = {
      task_id: 'task-aistudio-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      metadata: {},
    };
    const resumeTaskExecution = jest.fn().mockResolvedValue(undefined);
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-aistudio-tools-1',
            task_id: 'task-aistudio-1',
            executor: 'aistudio',
            kind: 'builtin_tool_access',
            scope: 'once',
            status: 'pending',
            requested_value: 'google_search, code_execution',
            resolved_value: 'google_search, code_execution',
            metadata: {
              requested_tools: ['google_search', 'code_execution'],
              suggested_model: 'gemini-2.5-pro',
            },
          },
        ]),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-aistudio-tools-1',
          task_id: 'task-aistudio-1',
          executor: 'aistudio',
          kind: 'builtin_tool_access',
          scope: 'once',
          status: 'approved',
          requested_value: 'google_search, code_execution',
          resolved_value: 'google_search, code_execution',
          metadata: {
            requested_tools: ['google_search', 'code_execution'],
            suggested_model: 'gemini-2.5-pro',
          },
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      resumeTaskExecution,
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-ais:workspace');

    expect(task.requires_approval).toBe(false);
    expect(task.approval_status).toBe('approved');
    expect(task.metadata.aistudio_allowed_tools).toEqual(
      expect.arrayContaining(['google_search', 'code_execution']),
    );
    expect(task.metadata.aistudio_model).toBe('gemini-2.5-pro');
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(resumeTaskExecution).toHaveBeenCalledWith(ctx, task);
  });

  it('resumes file delivery after approving workspace access', async () => {
    const resumeFileDeliveryPermission = jest.fn().mockResolvedValue(true);
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-file-delivery-1',
            executor: 'file_delivery',
            kind: 'workspace_access',
            scope: 'once',
            status: 'pending',
            requested_value: 'C:/fora',
            resolved_value: 'C:/fora',
            metadata: {},
          },
        ]),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-file-delivery-1',
          executor: 'file_delivery',
          kind: 'workspace_access',
          scope: 'once',
          status: 'approved',
          requested_value: 'C:/fora',
          resolved_value: 'C:/fora',
          metadata: {},
        }),
      } as any,
      resumeFileDeliveryPermission,
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-fil:once');

    expect(resumeFileDeliveryPermission).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        permission_id: 'perm-file-delivery-1',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Acesso local do Zavorth liberado.'),
    );
  });

  it('keeps ZavorthBridge handoff approvals on the watcher path when start state is absent', async () => {
    const approveVisibleStep = jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'approveVisibleStep')
      .mockResolvedValue({ ok: true, pid: 412 } as any);
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'readLatestResponse')
      .mockResolvedValue({
        ok: true,
        status: 'generating',
        hasPermissionPrompt: false,
        hasInputBar: true,
        visibleModel: 'Gemini 3 Flash',
        responseText: '',
        screenshotPath: null,
        captureMethod: 'uia',
        confidence: 0.95,
        notes: 'prompt dismissed',
        rawResponse: null,
        errorCode: null,
        errorMessage: null,
        taskId: 'task-123',
      } as any);
    const finishPrompt = jest.fn();
    const task = {
      task_id: 'task-123',
      status: 'waiting_approval',
      approval_status: 'pending',
      metadata: {
        zavorthBridgeTrackingFile: 'tracking.json',
      },
    };
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-12345678',
            task_id: 'task-123',
            executor: 'zavorthBridge',
            kind: 'ui_permission',
            scope: 'once',
            status: 'pending',
            requested_value: 'approve-visible-step-once',
            resolved_value: 'approve-visible-step-once',
          },
        ]),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-12345678',
          task_id: 'task-123',
          executor: 'zavorthBridge',
          kind: 'ui_permission',
          scope: 'once',
          status: 'approved',
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      getZavorthBridgeController: jest.fn().mockReturnValue({
        finishPrompt,
      }),
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-123:once');

    expect(approveVisibleStep).toHaveBeenCalledWith(0, 'once', 0);
    expect(finishPrompt).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      'Permission sent to ZavorthBridge. I will monitor the real task and notify you when it finishes.',
    );
    expect(task.status).toBe('running');
    expect(task.metadata.pendingPermissionId).toBeNull();
  });

  it('uses the conversation approval mode for ZavorthBridge session approvals', async () => {
    const approveVisibleStep = jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'approveVisibleStep')
      .mockResolvedValue({ ok: true, pid: 778 } as any);
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'readLatestResponse')
      .mockResolvedValue({
        ok: true,
        status: 'generating',
        hasPermissionPrompt: false,
        hasInputBar: true,
        visibleModel: 'Gemini 3 Flash',
        responseText: '',
        screenshotPath: null,
        captureMethod: 'uia',
        confidence: 0.95,
        notes: 'prompt dismissed',
        rawResponse: null,
        errorCode: null,
        errorMessage: null,
        taskId: 'task-456',
      } as any);
    const task = {
      task_id: 'task-456',
      status: 'waiting_approval',
      approval_status: 'pending',
      metadata: {
        zavorthBridgeTrackingFile: 'tracking.json',
      },
    };
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-abcdef12',
            task_id: 'task-456',
            executor: 'zavorthBridge',
            kind: 'ui_permission',
            scope: 'once',
            status: 'pending',
            requested_value: 'approve-visible-step-once',
            resolved_value: 'approve-visible-step-once',
            metadata: {
              companion_instance_id: 'bridge-9',
              companion_process_id: 778,
            },
          },
        ]),
        approveRequest: jest.fn().mockImplementation(async (_permissionId: string, _userId: string, patch: any) => ({
          permission_id: 'perm-abcdef12',
          task_id: 'task-456',
          executor: 'zavorthBridge',
          kind: 'ui_permission',
          scope: patch.scope,
          status: 'approved',
          requested_value: patch.requested_value,
          resolved_value: patch.resolved_value,
          metadata: patch.metadata,
        })),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      getZavorthBridgeController: jest.fn().mockReturnValue({
        finishPrompt: jest.fn(),
      }),
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-abc:session');

    expect(approveVisibleStep).toHaveBeenCalledWith(0, 'conversation', 778);
    expect(task.metadata.zavorthBridgePermissionScope).toBe('session');
    expect(task.metadata.zavorthBridgePermissionValue).toBe('approve-visible-step-conversation');
  });

  it('prefers the live ZavorthBridge process id when the bridge instance matches the pending permission', async () => {
    const approveVisibleStep = jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'approveVisibleStep')
      .mockResolvedValue({ ok: true, pid: 5856 } as any);
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'readLatestResponse')
      .mockResolvedValue({
        ok: true,
        status: 'generating',
        hasPermissionPrompt: false,
        hasInputBar: true,
        visibleModel: 'Gemini 3 Flash',
        responseText: '',
        screenshotPath: null,
        captureMethod: 'uia',
        confidence: 0.95,
        notes: 'prompt dismissed',
        rawResponse: null,
        errorCode: null,
        errorMessage: null,
        taskId: 'task-live-bridge',
      } as any);
    const task = {
      task_id: 'task-live-bridge',
      status: 'waiting_approval',
      approval_status: 'pending',
      metadata: {
        zavorthBridgeTrackingFile: 'tracking.json',
        zavorthBridgeCompanionInstanceId: 'bridge-live',
        zavorthBridgeCompanionProcessId: 22796,
      },
    };
    const controller = createController({
      createCompanionBridge: () => ({
        isOnline: jest.fn().mockResolvedValue(true),
        readStatus: jest.fn().mockResolvedValue({
          instanceId: 'bridge-live',
          processId: 5856,
        }),
      }),
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-live-1234',
            task_id: 'task-live-bridge',
            executor: 'zavorthBridge',
            kind: 'ui_permission',
            scope: 'once',
            status: 'pending',
            requested_value: 'approve-visible-step-once',
            resolved_value: 'approve-visible-step-once',
            metadata: {
              companion_instance_id: 'bridge-live',
              companion_process_id: 22796,
            },
          },
        ]),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-live-1234',
          task_id: 'task-live-bridge',
          executor: 'zavorthBridge',
          kind: 'ui_permission',
          scope: 'once',
          status: 'approved',
          requested_value: 'approve-visible-step-once',
          resolved_value: 'approve-visible-step-once',
          metadata: {},
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      getZavorthBridgeController: jest.fn().mockReturnValue({
        finishPrompt: jest.fn(),
      }),
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-liv:once');

    expect(approveVisibleStep).toHaveBeenCalledWith(0, 'once', 5856);
    expect(task.metadata.zavorthBridgeCompanionProcessId).toBe(5856);
  });

  it('rejects sibling ZavorthBridge permission requests when one approval succeeds', async () => {
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'approveVisibleStep')
      .mockResolvedValue({ ok: true, pid: 778 } as any);
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'readLatestResponse')
      .mockResolvedValue({
        ok: true,
        status: 'generating',
        hasPermissionPrompt: false,
        hasInputBar: true,
        visibleModel: 'Gemini 3 Flash',
        responseText: '',
        screenshotPath: null,
        captureMethod: 'uia',
        confidence: 0.95,
        notes: 'prompt dismissed',
        rawResponse: null,
        errorCode: null,
        errorMessage: null,
        taskId: 'task-777',
      } as any);

    const listRequests = jest.fn().mockResolvedValue([
      {
        permission_id: 'perm-main-1234',
        task_id: 'task-777',
        executor: 'zavorthBridge',
        kind: 'ui_permission',
        scope: 'once',
        status: 'pending',
        requested_value: 'approve-visible-step-once',
        resolved_value: 'approve-visible-step-once',
        metadata: {},
      },
      {
        permission_id: 'perm-dup-9999',
        task_id: 'task-777',
        executor: 'zavorthBridge',
        kind: 'ui_permission',
        scope: 'once',
        status: 'pending',
        requested_value: 'approve-visible-step-once',
        resolved_value: 'approve-visible-step-once',
        metadata: {},
      },
    ]);
    const rejectRequest = jest.fn().mockResolvedValue({
      permission_id: 'perm-dup-9999',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      status: 'rejected',
    });
    const task = {
      task_id: 'task-777',
      status: 'waiting_approval',
      approval_status: 'pending',
      requires_approval: true,
      metadata: {
        pendingPermissionId: 'perm-main-1234',
        pendingPermissionNotifiedAt: '2026-03-25T20:00:00.000Z',
        zavorthBridgeTrackingFile: 'tracking.json',
      },
    };
    const controller = createController({
      permissionService: {
        listRequests,
        rejectRequest,
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-main-1234',
          task_id: 'task-777',
          executor: 'zavorthBridge',
          kind: 'ui_permission',
          scope: 'once',
          status: 'approved',
          requested_value: 'approve-visible-step-once',
          resolved_value: 'approve-visible-step-once',
          metadata: {},
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      getZavorthBridgeController: jest.fn().mockReturnValue({
        finishPrompt: jest.fn(),
      }),
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-mai:once');

    expect(rejectRequest).toHaveBeenCalledWith(
      'perm-dup-9999',
      'system',
      expect.stringContaining('Pedido substituido pela aprovacao'),
    );
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(task.metadata.pendingPermissionNotifiedAt).toBeNull();
    expect(task.metadata.pendingPermissionNotificationError).toBeNull();
    expect(task.requires_approval).toBe(false);
  });

  it('does not mark ZavorthBridge permission as approved when the prompt remains visible', async () => {
    const approveVisibleStep = jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'approveVisibleStep')
      .mockResolvedValue({ ok: true, pid: 991 } as any);
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'readLatestResponse')
      .mockResolvedValue({
        ok: true,
        status: 'permission_prompt',
        hasPermissionPrompt: true,
        hasInputBar: false,
        visibleModel: 'Gemini 3 Flash',
        responseText: '',
        screenshotPath: null,
        captureMethod: 'uia',
        confidence: 0.98,
        notes: 'permission still visible',
        rawResponse: null,
        errorCode: null,
        errorMessage: null,
        taskId: 'task-789',
      } as any);
    const approveRequest = jest.fn();
    const task = {
      task_id: 'task-789',
      status: 'waiting_approval',
      approval_status: 'pending',
      metadata: {
        zavorthBridgeTrackingFile: 'tracking.json',
      },
    };
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-99999999',
            task_id: 'task-789',
            executor: 'zavorthBridge',
            kind: 'ui_permission',
            scope: 'once',
            status: 'pending',
            requested_value: 'approve-visible-step-once',
            resolved_value: 'approve-visible-step-once',
            metadata: {
              companion_process_id: 991,
            },
          },
        ]),
        approveRequest,
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn(),
      } as any,
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-999:session');

    expect(approveVisibleStep).toHaveBeenCalledWith(0, 'conversation', 991);
    expect(approveRequest).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
      text: 'Aprovando permissao...',
    });
  });

  it('rejects ZavorthBridge permission on the live bridge process and marks the task as rejected', async () => {
    const rejectVisibleStep = jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'rejectVisibleStep')
      .mockResolvedValue({ ok: true, pid: 5856 } as any);
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'readLatestResponse')
      .mockResolvedValue({
        ok: true,
        status: 'generating',
        hasPermissionPrompt: false,
        hasInputBar: true,
        visibleModel: 'Gemini 3 Flash',
        responseText: '',
        screenshotPath: null,
        captureMethod: 'uia',
        confidence: 0.95,
        notes: 'prompt dismissed after rejection',
        rawResponse: null,
        errorCode: null,
        errorMessage: null,
        taskId: 'task-reject-live',
      } as any);
    const task = {
      task_id: 'task-reject-live',
      status: 'waiting_approval',
      approval_status: 'pending',
      requires_approval: true,
      metadata: {
        pendingPermissionId: 'perm-rej-1234',
        zavorthBridgeTrackingFile: 'tracking.json',
        zavorthBridgeCompanionInstanceId: 'bridge-live',
        zavorthBridgeCompanionProcessId: 22796,
      },
    };
    const rejectRequest = jest.fn().mockResolvedValue({
      permission_id: 'perm-rej-1234',
      task_id: 'task-reject-live',
      executor: 'zavorthBridge',
      kind: 'ui_permission',
      scope: 'once',
      status: 'rejected',
      requested_value: 'approve-visible-step-once',
      resolved_value: 'approve-visible-step-once',
      metadata: {},
    });
    const controller = createController({
      createCompanionBridge: () => ({
        isOnline: jest.fn().mockResolvedValue(true),
        readStatus: jest.fn().mockResolvedValue({
          instanceId: 'bridge-live',
          processId: 5856,
        }),
      }),
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-rej-1234',
            task_id: 'task-reject-live',
            executor: 'zavorthBridge',
            kind: 'ui_permission',
            scope: 'once',
            status: 'pending',
            requested_value: 'approve-visible-step-once',
            resolved_value: 'approve-visible-step-once',
            metadata: {
              companion_instance_id: 'bridge-live',
              companion_process_id: 22796,
            },
          },
        ]),
        rejectRequest,
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:reject:perm-rej');

    expect(rejectVisibleStep).toHaveBeenCalledWith(0, 5856);
    expect(task.status).toBe('rejected');
    expect(task.approval_status).toBe('rejected');
    expect(task.metadata.zavorthBridgeCompanionProcessId).toBe(5856);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Permissao do ZavorthBridge rejeitada.'));
  });

  it('fails an already running ZavorthBridge task when its permission is rejected', async () => {
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'rejectVisibleStep')
      .mockResolvedValue({ ok: true, pid: 991 } as any);
    jest
      .spyOn(ZavorthBridgeWindowAutomator.prototype, 'readLatestResponse')
      .mockResolvedValue({
        ok: true,
        status: 'idle',
        hasPermissionPrompt: false,
        hasInputBar: true,
        visibleModel: 'Gemini 3 Flash',
        responseText: '',
        screenshotPath: null,
        captureMethod: 'uia',
        confidence: 0.9,
        notes: 'prompt dismissed after rejection',
        rawResponse: null,
        errorCode: null,
        errorMessage: null,
        taskId: 'task-running-reject',
      } as any);

    const task = {
      task_id: 'task-running-reject',
      status: 'running',
      approval_status: 'pending',
      requires_approval: true,
      metadata: {
        pendingPermissionId: 'perm-run-1234',
        zavorthBridgeTrackingFile: 'tracking.json',
      },
    };
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-run-1234',
            task_id: 'task-running-reject',
            executor: 'zavorthBridge',
            kind: 'ui_permission',
            scope: 'once',
            status: 'pending',
            requested_value: 'approve-visible-step-once',
            resolved_value: 'approve-visible-step-once',
            metadata: {
              companion_process_id: 991,
            },
          },
        ]),
        rejectRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-run-1234',
          task_id: 'task-running-reject',
          executor: 'zavorthBridge',
          kind: 'ui_permission',
          scope: 'once',
          status: 'rejected',
          requested_value: 'approve-visible-step-once',
          resolved_value: 'approve-visible-step-once',
          metadata: {},
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:reject:perm-run');

    expect(task.status).toBe('failed');
    expect(task.approval_status).toBe('rejected');
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(task.error_summary).toContain('Rejeicao inline pelo Telegram');
  });

  it('rejects non-ZavorthBridge workflow permissions and clears pending metadata', async () => {
    const task = {
      task_id: 'task-external_executor-reject-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      requires_approval: true,
      metadata: {
        pendingPermissionId: 'perm-rej-7654',
        pendingPermissionNotifiedAt: '2026-04-03T20:00:00.000Z',
        pendingPermissionNotificationError: 'callback timeout',
        workflow_run_id: 'wf-external_executor-reject-1',
        workflow_stage_id: 'review',
      },
    };
    const applyStageApprovalDecision = jest.fn();
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-rej-7654',
            task_id: 'task-external_executor-reject-1',
            executor: 'external_executor',
            kind: 'workspace_access',
            scope: 'once',
            status: 'pending',
            requested_value: 'C:/workspace',
            resolved_value: 'C:/workspace',
            metadata: {},
          },
        ]),
        rejectRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-rej-7654',
          task_id: 'task-external_executor-reject-1',
          executor: 'external_executor',
          kind: 'workspace_access',
          scope: 'once',
          status: 'rejected',
          requested_value: 'C:/workspace',
          resolved_value: 'C:/workspace',
          metadata: {},
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      workflowRunService: {
        applyStageApprovalDecision,
      },
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:reject:perm-rej');

    expect(task.status).toBe('rejected');
    expect(task.requires_approval).toBe(false);
    expect(task.approval_status).toBe('rejected');
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(task.metadata.pendingPermissionNotifiedAt).toBeNull();
    expect(task.metadata.pendingPermissionNotificationError).toBeNull();
    expect(task.error_summary).toContain('Rejeicao inline pelo Telegram');
    expect(applyStageApprovalDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowRunId: 'wf-external_executor-reject-1',
        stageId: 'review',
        taskId: 'task-external_executor-reject-1',
        action: 'reject',
      }),
    );
  });

  it('applies ExternalExecutor approvals to the role-specific binding map before resuming', async () => {
    const task = {
      task_id: 'task-external_executor-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      metadata: {
        external_executor_agent_role: 'reviewer',
      },
    };
    const resumeTaskExecution = jest.fn().mockResolvedValue(undefined);
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-76543210',
            task_id: 'task-external_executor-1',
            executor: 'external_executor',
            kind: 'agent_binding',
            scope: 'workspace',
            status: 'pending',
            metadata: {
              agent_role: 'reviewer',
              suggested_agent_id: 'reviewer-agent',
            },
          },
        ]),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-76543210',
          task_id: 'task-external_executor-1',
          executor: 'external_executor',
          kind: 'agent_binding',
          scope: 'workspace',
          status: 'approved',
          resolved_value: 'reviewer-agent',
          metadata: {
            agent_role: 'reviewer',
            suggested_agent_id: 'reviewer-agent',
          },
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      resumeTaskExecution,
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-765:workspace');

    expect(task.requires_approval).toBe(false);
    expect(task.metadata.external_executor_agent_id).toBe('reviewer-agent');
    expect(task.metadata.external_executor_agent_role).toBe('reviewer');
    expect(task.metadata.external_executor_agent_bindings).toEqual(
      expect.objectContaining({
        reviewer: 'reviewer-agent',
      }),
    );
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(resumeTaskExecution).toHaveBeenCalled();
  });

  it('loads persisted ExternalExecutor bindings into the task metadata by role', async () => {
    const task = {
      workspace: 'C:/repo',
      metadata: {
        external_executor_agent_role: 'reviewer',
      },
    };
    const listApprovedRequests = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          permission_id: 'perm-maker',
          resolved_value: 'maker-agent',
          metadata: { agent_role: 'maker' },
        },
        {
          permission_id: 'perm-reviewer',
          resolved_value: 'reviewer-agent',
          metadata: { agent_role: 'reviewer' },
        },
      ]);
    const persistTask = jest.fn();
    const controller = createController({
      permissionService: {
        listApprovedRequests,
      } as any,
      persistTask,
    });

    await controller.applyPersistedPermissionPolicies(task as any, 'external_executor');

    expect(task.metadata.external_executor_agent_bindings).toEqual({
      maker: 'maker-agent',
      reviewer: 'reviewer-agent',
    });
    expect(task.metadata.external_executor_agent_id).toBe('reviewer-agent');
    expect(task.metadata.external_executor_permission_id).toBe('perm-reviewer');
    expect(persistTask).toHaveBeenCalledWith(task);
  });

  it('approves ExternalExecutor path access for the current task only and resumes execution', async () => {
    const task = {
      task_id: 'task-external_executor-path-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      metadata: {},
    };
    const resumeTaskExecution = jest.fn().mockResolvedValue(undefined);
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-path-76543210',
            task_id: 'task-external_executor-path-1',
            executor: 'external_executor',
            kind: 'workspace_access',
            scope: 'once',
            status: 'pending',
            requested_value: 'C:/workspace',
            resolved_value: 'C:/workspace',
            metadata: {},
          },
        ]),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-path-76543210',
          task_id: 'task-external_executor-path-1',
          executor: 'external_executor',
          kind: 'workspace_access',
          scope: 'once',
          status: 'approved',
          requested_value: 'C:/workspace',
          resolved_value: 'C:/workspace',
          metadata: {},
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      resumeTaskExecution,
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-pat:once');

    expect(task.requires_approval).toBe(false);
    expect(task.metadata.extra_allowed_paths).toEqual(['C:/workspace']);
    expect(task.metadata.extra_allowed_path_policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'C:/workspace',
          access_level: 'read_only',
        }),
      ]),
    );
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(task.approval_status).toBe('approved');
    expect(resumeTaskExecution).toHaveBeenCalledWith(ctx, task);
  });

  it('continues approval flow when permission decision audit logging fails', async () => {
    const task = {
      task_id: 'task-external_executor-audit-approve-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      requires_approval: true,
      metadata: {
        pendingPermissionId: 'perm-audit-approve-1',
      },
    };
    const resumeTaskExecution = jest.fn().mockResolvedValue(undefined);
    const logPermissionDecision = jest
      .fn()
      .mockRejectedValue(new Error('audit backend offline'));
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-audit-approve-1',
            task_id: 'task-external_executor-audit-approve-1',
            executor: 'external_executor',
            kind: 'workspace_access',
            scope: 'once',
            status: 'pending',
            requested_value: 'C:/workspace',
            resolved_value: 'C:/workspace',
            metadata: {},
          },
        ]),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-audit-approve-1',
          task_id: 'task-external_executor-audit-approve-1',
          executor: 'external_executor',
          kind: 'workspace_access',
          scope: 'once',
          status: 'approved',
          requested_value: 'C:/workspace',
          resolved_value: 'C:/workspace',
          metadata: {},
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      auditLogger: {
        logPermissionDecision,
      },
      resumeTaskExecution,
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-aud:once');

    expect(logPermissionDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        permission_id: 'perm-audit-approve-1',
      }),
      'approve',
      '42',
      expect.objectContaining({
        patch: expect.objectContaining({
          scope: 'once',
        }),
      }),
    );
    expect(task.requires_approval).toBe(false);
    expect(task.approval_status).toBe('approved');
    expect(task.status).toBe('running');
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(resumeTaskExecution).toHaveBeenCalledWith(ctx, task);
  });

  it('requires the configured high-risk TOTP before approving a waiting task', async () => {
    (config as any).highRiskApprovalTotpSecretRef = 'missing-high-risk-approval-totp-test';
    (config as any).highRiskApprovalTotpSecret = 'telegram-approval-test-secret';
    (config as any).highRiskApprovalAllowEnvFallback = true;
    const code = generateTotpForTest('telegram-approval-test-secret');
    const task = {
      task_id: 'task-high-risk-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      risk_level: 3,
      metadata: {
        requiresHighRiskPin: true,
      },
    };
    const resumeTaskExecution = jest.fn().mockResolvedValue(undefined);
    const controller = createController({
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      resumeTaskExecution,
    });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleApproval(ctx, `task-high-risk-1 pin=${code}`);

    expect(task.approval_status).toBe('approved');
    expect(resumeTaskExecution).toHaveBeenCalled();
  });

  it('resumes the workflow run instead of the plain task after approving a workflow stage', async () => {
    const task = {
      task_id: 'task-workflow-approval-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      requires_approval: true,
      metadata: {
        workflow_run_id: 'wf-ship-demo-001',
        workflow_stage_id: 'review',
      },
    };
    const resumeTaskExecution = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflowExecution = jest.fn().mockResolvedValue(true);
    const applyStageApprovalDecision = jest.fn();
    const controller = createController({
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      resumeTaskExecution,
      resumeWorkflowExecution,
      workflowRunService: {
        applyStageApprovalDecision,
      },
    });
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleApproval(ctx, 'task-workflow-approval-1');

    expect(task.approval_status).toBe('approved');
    expect(applyStageApprovalDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowRunId: 'wf-ship-demo-001',
        stageId: 'review',
        taskId: 'task-workflow-approval-1',
        action: 'approve',
      }),
    );
    expect(resumeWorkflowExecution).toHaveBeenCalledWith(ctx, task);
    expect(resumeTaskExecution).not.toHaveBeenCalled();
  });

  it('resumes the workflow run after approving a workflow permission gate', async () => {
    const task = {
      task_id: 'task-external_executor-workflow-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      requires_approval: true,
      metadata: {
        workflow_run_id: 'wf-review-demo-001',
        workflow_stage_id: 'maker',
      },
    };
    const resumeTaskExecution = jest.fn().mockResolvedValue(undefined);
    const resumeWorkflowExecution = jest.fn().mockResolvedValue(true);
    const applyStageApprovalDecision = jest.fn();
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-path-76543210',
            task_id: 'task-external_executor-workflow-1',
            executor: 'external_executor',
            kind: 'workspace_access',
            scope: 'once',
            status: 'pending',
            requested_value: 'C:/workspace',
            resolved_value: 'C:/workspace',
            metadata: {},
          },
        ]),
        approveRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-path-76543210',
          task_id: 'task-external_executor-workflow-1',
          executor: 'external_executor',
          kind: 'workspace_access',
          scope: 'once',
          status: 'approved',
          requested_value: 'C:/workspace',
          resolved_value: 'C:/workspace',
          metadata: {},
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      resumeTaskExecution,
      resumeWorkflowExecution,
      workflowRunService: {
        applyStageApprovalDecision,
      },
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:approve:perm-pat:once');

    expect(task.approval_status).toBe('approved');
    expect(applyStageApprovalDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowRunId: 'wf-review-demo-001',
        stageId: 'maker',
        taskId: 'task-external_executor-workflow-1',
        action: 'approve',
      }),
    );
    expect(resumeWorkflowExecution).toHaveBeenCalledWith(ctx, task);
    expect(resumeTaskExecution).not.toHaveBeenCalled();
  });

  it('continues rejection flow when permission decision audit logging fails', async () => {
    const task = {
      task_id: 'task-external_executor-audit-reject-1',
      status: 'waiting_approval',
      approval_status: 'pending',
      requires_approval: true,
      metadata: {
        pendingPermissionId: 'perm-audit-reject-1',
        pendingPermissionNotifiedAt: '2026-04-03T20:00:00.000Z',
        pendingPermissionNotificationError: 'callback timeout',
        workflow_run_id: 'wf-external_executor-audit-reject-1',
        workflow_stage_id: 'review',
      },
    };
    const logPermissionDecision = jest
      .fn()
      .mockRejectedValue(new Error('audit backend offline'));
    const applyStageApprovalDecision = jest.fn();
    const controller = createController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-audit-reject-1',
            task_id: 'task-external_executor-audit-reject-1',
            executor: 'external_executor',
            kind: 'workspace_access',
            scope: 'once',
            status: 'pending',
            requested_value: 'C:/workspace',
            resolved_value: 'C:/workspace',
            metadata: {},
          },
        ]),
        rejectRequest: jest.fn().mockResolvedValue({
          permission_id: 'perm-audit-reject-1',
          task_id: 'task-external_executor-audit-reject-1',
          executor: 'external_executor',
          kind: 'workspace_access',
          scope: 'once',
          status: 'rejected',
          requested_value: 'C:/workspace',
          resolved_value: 'C:/workspace',
          metadata: {},
        }),
      } as any,
      taskManager: {
        getTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((targetTask: any, nextStatus: string) => {
          targetTask.status = nextStatus;
        }),
      } as any,
      workflowRunService: {
        applyStageApprovalDecision,
      },
      auditLogger: {
        logPermissionDecision,
      },
    });
    const ctx = {
      from: { id: 42 },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handlePermissionCallback(ctx, 'perm:reject:perm-aud');

    expect(logPermissionDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        permission_id: 'perm-audit-reject-1',
      }),
      'reject',
      '42',
      expect.objectContaining({
        note: 'Rejeicao inline pelo Telegram.',
      }),
    );
    expect(task.status).toBe('rejected');
    expect(task.requires_approval).toBe(false);
    expect(task.approval_status).toBe('rejected');
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(task.metadata.pendingPermissionNotifiedAt).toBeNull();
    expect(task.metadata.pendingPermissionNotificationError).toBeNull();
    expect(task.error_summary).toContain('Rejeicao inline pelo Telegram');
    expect(applyStageApprovalDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowRunId: 'wf-external_executor-audit-reject-1',
        stageId: 'review',
        taskId: 'task-external_executor-audit-reject-1',
        action: 'reject',
      }),
    );
  });
});

function generateTotpForTest(secret: string): string {
  const counter = Math.floor(Date.now() / 30_000);
  const key = crypto.createHash('sha1').update(secret).digest();
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}
