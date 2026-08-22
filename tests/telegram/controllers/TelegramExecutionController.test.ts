import { ZavorthBridgeCliAdapter } from '../../../src/agents/ZavorthBridgeCliAdapter';
jest.mock('../../../src/services/DeepSearchService', () => ({
  DeepSearchService: jest.fn().mockImplementation(() => ({
    research: jest.fn().mockResolvedValue('Resposta web estruturada'),
  })),
}));

import { LocalExecutor } from '../../../src/execution/LocalExecutor';
import { TelegramExecutionController } from '../../../src/telegram/controllers/TelegramExecutionController';
import type { TelegramExecutionControllerDeps } from '../../../src/telegram/controllers/TelegramExecutionController';
import type { Task } from '../../../src/contracts/TaskContract';
import type { ExecutionResult } from '../../../src/contracts/runtime/ExecutionContract';
import type { Context } from 'grammy';
import fs from 'fs';
import os from 'os';
import path from 'path';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-12345678',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: 'telegram',
    chat_id: '42',
    user_id: '42',
    raw_message: '/dryrun npm test',
    normalized_message: '/dryrun npm test',
    command_type: '/dryrun',
    intent: 'exec',
    target: null,
    workspace: 'core',
    risk_level: 1,
    status: 'parsed',
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
    ...overrides,
  };
}

describe('TelegramExecutionController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createController(overrides: Partial<TelegramExecutionControllerDeps> & { toolRuntime?: import('../../../src/services/tools/ToolRuntimeService').ToolRuntimeService } = {}) {
    const toolRuntime = overrides.toolRuntime;
    const deps = {
      taskManager: {
        advanceState: jest.fn((task: Task, status: Task['status']) => {
          task.status = status;
        }),
      },
      logRepo: {
        log: jest.fn(),
      } as import('../../../src/storage/LogRepository').LogRepository,
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({
          getMode: jest.fn().mockReturnValue('BUILD'),
          isSufficientFor: jest.fn().mockReturnValue(true),
        }),
        getPolicyEngine: jest.fn().mockReturnValue({
          isCommandBlocked: jest.fn().mockReturnValue(false),
        }),
        submit: jest.fn().mockResolvedValue({
          requires_confirmation: false,
          allowed: true,
          reason: 'ok',
          execution_result: { success: true, stdout: 'simulado' },
        }),
      },
      auditLogger: {
        logEvent: jest.fn().mockResolvedValue(undefined),
        logSecurityBlock: jest.fn().mockResolvedValue(undefined),
      },
      permissionService: {
        getRequest: jest.fn().mockResolvedValue(null),
        findApprovedRequest: jest.fn().mockResolvedValue(null),
        findApprovedExternalExecutorBinding: jest.fn().mockResolvedValue(null),
        listApprovedRequests: jest.fn().mockResolvedValue([]),
      },
      persistTask: jest.fn(),
      applyPersistedPermissionPolicies: jest.fn().mockResolvedValue(undefined),
      buildPermissionKeyboard: jest.fn(),
      formatPermissionCreatedMessage: jest.fn(),
      createExternalExecutorPermissionRequest: jest.fn(),
      createAiStudioPermissionRequest: jest.fn(),
      presentationModeService: {
        isEnabled: jest.fn().mockReturnValue(false),
      },
      ...overrides,
    } as unknown as TelegramExecutionControllerDeps;

    return {
      controller: new TelegramExecutionController(deps, toolRuntime),
      deps,
    };
  }

  it('executes dry-run tasks through the execution gateway and replies with output', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask();
    const { controller, deps } = createController();

    await controller.executeImmediate(ctx, task, true);

    expect(deps.applyPersistedPermissionPolicies).toHaveBeenCalledWith(task, 'local');
    expect(deps.executionGateway.submit).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringMatching(/Shell local: (pronto|ready)|Local shell: (pronto|ready)/i),
      expect.objectContaining({}),
    );
    expect(task.metadata.last_user_facing_response).toEqual(
      expect.objectContaining({
        kind: 'execution_result',
      }),
    );
    expect(task.metadata.last_operational_response.text).toContain('kind=execution_result');
  });

  it('captures and logs preparation failures when immediate execution throws', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask();
    const { controller, deps } = createController({
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({
          getMode: jest.fn().mockReturnValue('BUILD'),
          isSufficientFor: jest.fn().mockReturnValue(true),
        }),
        getPolicyEngine: jest.fn().mockReturnValue({
          isCommandBlocked: jest.fn().mockReturnValue(false),
        }),
        submit: jest.fn().mockRejectedValue(new Error('gateway offline')),
      },
    });

    await controller.executeImmediate(ctx, task, true);

    expect(task.status).toBe('failed');
    expect(task.error_summary).toBe('gateway offline');
    expect(deps.logRepo.log).toHaveBeenCalledWith(
      'error',
      'ResponseEnvelope',
      expect.stringContaining('kind=preparation_failure'),
      expect.anything(),
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain(
      'I could not execute this task right now.',
    );
  });

  it('does not force a completed task back to failed when a post-delivery reply throws', async () => {
    const ctx = {
      reply: jest.fn()
        .mockRejectedValueOnce(new Error('reply transport failed'))
        .mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask();
    const { controller } = createController();

    await controller.executeImmediate(ctx, task, true);

    expect(task.status).toBe('completed');
    expect(task.error_summary).toBe('reply transport failed');
    expect(ctx.reply).toHaveBeenCalledTimes(2);
  });

  it('resumes execution and marks the task completed when successful', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({ status: 'running' });
    const { controller } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(task.status).toBe('completed');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringMatching(/Shell local: (pronto|ready)|Local shell: (pronto|ready)/i),
      expect.objectContaining({}),
    );
  });

  it('routes /ag through the direct ZavorthBridge path instead of the gateway', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/ag',
      raw_message: '/ag revise o repositorio atual',
      normalized_message: '/ag revise o repositorio atual',
      status: 'running',
      workspace: 'C:/repo',
    });
    const executePrompt = jest.spyOn(ZavorthBridgeCliAdapter.prototype, 'executePrompt').mockResolvedValue({
      success: true,
      metadata: {
        delivery_mode: 'companion-reuse',
        preferred_model: 'sonnet',
        handoff_file: 'handoff.md',
        tracking_file: 'tracking.json',
        response_file: 'response.txt',
      },
    } as unknown as ExecutionResult);
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(executePrompt).toHaveBeenCalledWith(task, 'revise o repositorio atual', 'C:/repo');
    expect(deps.executionGateway.submit).not.toHaveBeenCalled();
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Real ZavorthBridge invoked.');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('active session reused');
  });

  it('executes local shell commands without routing them through the gateway', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/shell',
      raw_message: '/shell npm test',
      normalized_message: '/shell npm test',
      status: 'running',
      workspace: 'C:/repo',
    });
    const executeDirect = jest.spyOn(LocalExecutor.prototype, 'executeDirect').mockResolvedValue({
      success: true,
      stdout: 'tests ok',
      stderr: '',
      diff_summary: '',
      artifacts: [],
    } as unknown as ExecutionResult);
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(executeDirect).toHaveBeenCalledWith(task, ['npm test'], 'C:/repo', false);
    expect(deps.executionGateway.submit).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringMatching(/Shell local: (pronto|ready)|Local shell: (pronto|ready)/i),
      expect.objectContaining({}),
    );
    expect(task.metadata.last_user_facing_response).toEqual(
      expect.objectContaining({
        kind: 'execution_result',
      }),
    );
  });

  it('resumes stored mailbox gateway plans through the execution gateway', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/auto_bridge',
      status: 'running',
      executor_used: 'external_executor',
      metadata: {
        gateway_plan: {
          plan_id: 'plan-mailbox-1',
          task_id: 'task-12345678',
          objective: 'Executar auditoria remota',
          context: 'Fluxo mailbox',
          assumptions: [],
          executor_recommendation: 'external_executor',
          workspace_recommendation: 'C:/repo',
          risk_level: 1,
          requires_approval: false,
          steps: [
            {
              step_id: 'step-1',
              type: 'exec',
              description: 'Executar auditoria remota',
              tool: null,
              args: null,
              command: 'Executar auditoria remota',
              file_targets: ['C:/repo'],
              expected_output: 'Resumo remoto',
              sensitive: false,
            },
          ],
          validation_steps: [],
          success_condition: 'Resumo remoto',
          rollback_condition: null,
          notes: [],
        },
      },
    });
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(deps.applyPersistedPermissionPolicies).toHaveBeenCalledWith(task, 'external_executor');
    expect(deps.executionGateway.submit).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        executor_recommendation: 'external_executor',
      }),
      false,
    );
    expect(task.status).toBe('completed');
  });

  it('injects the role-aware ExternalExecutor binding before submitting the plan', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/external',
      raw_message: '/external revisar modulo',
      status: 'running',
      executor_used: 'external_executor',
      workspace: 'C:/repo',
      metadata: {
        external_executor_agent_role: 'reviewer',
      },
    });
    const approvedBinding = {
      permission_id: 'perm-role-1',
      resolved_value: 'reviewer-agent',
    };
    const { controller, deps } = createController({
      permissionService: {
        getRequest: jest.fn().mockResolvedValue(null),
        findApprovedRequest: jest.fn().mockResolvedValue(null),
        findApprovedExternalExecutorBinding: jest.fn().mockResolvedValue(approvedBinding),
        listApprovedRequests: jest
          .fn()
          .mockResolvedValueOnce([approvedBinding])
          .mockResolvedValue([]),
      },
    });

    await controller.resumeTaskExecution(ctx, task);

    expect(deps.permissionService.listApprovedRequests).toHaveBeenCalledWith(
      'external_executor',
      'agent_binding',
      'C:/repo',
      {
        agent_role: 'reviewer',
        tenant_id: 'telegram:user:42',
        tenant_policy_profile: 'telegram-private',
      },
    );
    expect(task.metadata.external_executor_agent_id).toBe('reviewer-agent');
    expect(task.metadata.external_executor_agent_bindings).toEqual(
      expect.objectContaining({
        reviewer: 'reviewer-agent',
      }),
    );
  });

  it('opens a path-scoped ExternalExecutor permission request when extra folder access is required', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/external',
      raw_message: '/external veja o que tem na pasta workspace',
      status: 'parsed',
      executor_used: 'external_executor',
      workspace: 'C:/workspace/zavorth',
    });
    const permission = {
      permission_id: 'perm-path-1',
      executor: 'external_executor',
      kind: 'workspace_access',
      scope: 'once',
      requested_value: 'C:/workspace',
      resolved_value: 'C:/workspace',
      metadata: {},
    };
    const { controller, deps } = createController({
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({ getMode: jest.fn().mockReturnValue('BUILD') }),
        getPolicyEngine: jest.fn(),
        submit: jest.fn().mockResolvedValue({
          requires_confirmation: false,
          allowed: true,
          reason: 'ok',
          execution_result: {
            success: false,
            error_code: 'EXTERNAL_EXECUTOR_PATH_ACCESS_REQUIRED',
            error_message: 'O ExternalExecutor precisa de acesso adicional ao caminho C:/workspace.',
            metadata: {
              requested_access_path_windows: 'C:/workspace',
            },
          },
        }),
      },
      createExternalExecutorPermissionRequest: jest.fn().mockImplementation(async (currentTask: Task) => {
        currentTask.status = 'waiting_approval';
        currentTask.metadata = {
          ...(currentTask.metadata || {}),
          pendingPermissionId: permission.permission_id,
        };
        return permission;
      }),
      permissionService: {
        getRequest: jest.fn().mockResolvedValue(permission),
        findApprovedRequest: jest.fn().mockResolvedValue(null),
        findApprovedExternalExecutorBinding: jest.fn().mockResolvedValue(null),
        listApprovedRequests: jest.fn().mockResolvedValue([]),
      },
      buildPermissionKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [['ok']] }),
      formatPermissionCreatedMessage: jest.fn().mockReturnValue('Permissao da pasta criada'),
    });

    await controller.executeImmediate(ctx, task, false);

    expect(deps.createExternalExecutorPermissionRequest).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        error_code: 'EXTERNAL_EXECUTOR_PATH_ACCESS_REQUIRED',
      }),
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('ExternalExecutor needs extra access to a specific folder or path before continuing.');
    expect(ctx.reply.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
        reply_markup: { inline_keyboard: [['ok']] },
      }));
  });

  it('routes /gemini through the execution gateway with the Gemini CLI executor', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/gemini',
      raw_message: '/gemini revise o arquivo atual',
      normalized_message: '/gemini revise o arquivo atual',
      status: 'running',
      workspace: 'C:/repo',
    });
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(deps.applyPersistedPermissionPolicies).toHaveBeenCalledWith(task, 'gemini_cli');
    expect(deps.executionGateway.submit).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        executor_recommendation: 'gemini_cli',
        workspace_recommendation: 'C:/repo',
      }),
      false,
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Gemini CLI: ready.');
  });

  it('hides executor labels in execution output when presentation mode is active', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/gemini',
      raw_message: '/gemini explique esse erro',
      normalized_message: '/gemini explique esse erro',
      status: 'running',
      workspace: 'C:/repo',
    });
    const { controller } = createController({
      presentationModeService: {
        isEnabled: jest.fn().mockReturnValue(true),
      },
    });

    await controller.resumeTaskExecution(ctx, task);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Managed to complete this.');
    expect(ctx.reply).not.toHaveBeenCalledWith(
      expect.stringContaining('Gemini CLI: ready.'),
      expect.objectContaining({}),
    );
  });

  it('routes /aistudio through the execution gateway with the Google AI Studio executor', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/aistudio',
      raw_message: '/aistudio model=gemini-2.5-pro tools=search me diga as noticias do dia',
      normalized_message: '/aistudio model=gemini-2.5-pro tools=search me diga as noticias do dia',
      status: 'running',
      workspace: 'C:/repo',
    });
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(deps.applyPersistedPermissionPolicies).toHaveBeenCalledWith(task, 'aistudio');
    expect(deps.executionGateway.submit).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        executor_recommendation: 'aistudio',
        workspace_recommendation: 'C:/repo',
      }),
      false,
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Google AI Studio: ready.');
  });

  it('injects workspace profile notes into explicit execution plans', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/run',
      raw_message: '/run npm test',
      normalized_message: '/run npm test',
      status: 'running',
      workspace: 'C:/repo',
      metadata: {
        workspace_profile: {
          summary: 'Workspace repo | stacks nodejs, frontend',
          scripts: {
            build: 'npm run build',
            test: 'npm test',
          },
          important_paths: ['C:/repo/src', 'C:/repo/tests'],
          instruction_notes: [],
          skill_directories: [],
          workspace_hooks: [],
          workspace_commands: [],
        },
        workspace_operational_memory: {
          summary: 'Workspace repo | melhor executor recente codex (3 sucesso(s)) | falha recorrente external_executor: gateway timeout',
          successful_executors: [{ executor: 'codex', count: 3 }],
          repeated_failures: [{ executor: 'external_executor', summary: 'gateway timeout' }],
          approved_paths: [{ path: 'C:/repo/assets' }],
        },
      },
    });
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(deps.executionGateway.submit).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        assumptions: expect.arrayContaining([
          expect.stringMatching(/Resumo do workspace|Workspace summary/i),
        ]),
        notes: expect.arrayContaining([
          expect.stringMatching(/Comando de build comum|Common build command|build|Perfil do workspace/i),
          expect.stringMatching(/Comando de teste comum|Common test command|test/i),
          expect.stringMatching(/Caminhos importantes|Important paths/i),
          expect.stringMatching(/Executor com melhor historico recente|best recent|melhor historico|melhor executor recente/i),
          expect.stringMatching(/Falha recorrente recente|recurring failure|Recent repeated failure|Failure recorrente/i),
          expect.stringMatching(/Caminhos ja aprovados recentemente|approved paths|ja aprovados|Recently approved/i),
        ]),
      }),
      false,
    );
  });

  it('routes auto-routed web research through the structured web path instead of the gateway', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/task',
      raw_message: '/task pesquise as noticias de tecnologia de hoje',
      normalized_message: '/task pesquise as noticias de tecnologia de hoje',
      status: 'running',
      workspace: 'web',
      executor_used: 'web_research',
      metadata: {
        auto_route_executor: 'web_research',
        auto_route_reason: 'Pedido tem perfil claro de pesquisa web basica e deve usar a rota web estruturada do Zavorth.',
      },
    });
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(deps.applyPersistedPermissionPolicies).not.toHaveBeenCalled();
    expect(deps.executionGateway.submit).not.toHaveBeenCalled();
    expect(task.executor_used).toBe('web_research');
    expect(task.result_summary).toContain('Resposta web estruturada');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Research completed');
    expect(task.metadata.last_user_facing_response).toEqual(
      expect.objectContaining({
        kind: 'research_success',
      }),
    );
    expect(task.metadata.last_operational_response.text).toContain('kind=research_success');
  });

  it('opens a Google AI Studio permission request when Gemini API tools still need approval', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/aistudio',
      raw_message: '/aistudio pesquise as principais noticias de IA',
      normalized_message: '/aistudio pesquise as principais noticias de IA',
      status: 'parsed',
      executor_used: 'aistudio',
      workspace: 'C:/repo',
    });
    const permission = {
      permission_id: 'perm-aistudio-1',
      executor: 'aistudio',
      kind: 'builtin_tool_access',
      scope: 'once',
      requested_value: 'google_search',
      resolved_value: 'google_search',
      metadata: {
        requested_tools: ['google_search'],
      },
    };
    const { controller, deps } = createController({
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({ getMode: jest.fn().mockReturnValue('BUILD') }),
        getPolicyEngine: jest.fn(),
        submit: jest.fn().mockResolvedValue({
          requires_confirmation: false,
          allowed: true,
          reason: 'ok',
          execution_result: {
            success: false,
            error_code: 'AISTUDIO_BUILTIN_TOOL_PERMISSION_REQUIRED',
            error_message: 'O Google AI Studio precisa da sua aprovacao para usar tool(s): google_search.',
            metadata: {
              requested_tools: ['google_search'],
              suggested_model: 'gemini-2.5-pro',
            },
          },
        }),
      },
      createAiStudioPermissionRequest: jest.fn().mockImplementation(async (currentTask: Task) => {
        currentTask.status = 'waiting_approval';
        currentTask.metadata = {
          ...(currentTask.metadata || {}),
          pendingPermissionId: permission.permission_id,
        };
        return permission;
      }),
      permissionService: {
        getRequest: jest.fn().mockResolvedValue(permission),
        findApprovedRequest: jest.fn().mockResolvedValue(null),
        findApprovedExternalExecutorBinding: jest.fn().mockResolvedValue(null),
        listApprovedRequests: jest.fn().mockResolvedValue([]),
      },
      buildPermissionKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [['ok']] }),
      formatPermissionCreatedMessage: jest.fn().mockReturnValue('Permissao do AI Studio criada'),
    });

    await controller.executeImmediate(ctx, task, false);

    expect(deps.createAiStudioPermissionRequest).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        error_code: 'AISTUDIO_BUILTIN_TOOL_PERMISSION_REQUIRED',
      }),
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Google AI Studio wants to use official Gemini API tool(s) before continuing.');
  });

  it('returns a clear message when Google AI Studio asks for an unsupported external service', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/aistudio',
      raw_message: '/aistudio services=drive leia um documento e resuma',
      normalized_message: '/aistudio services=drive leia um documento e resuma',
      status: 'parsed',
      executor_used: 'aistudio',
      workspace: 'C:/repo',
    });
    const { controller, deps } = createController({
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({ getMode: jest.fn().mockReturnValue('BUILD') }),
        getPolicyEngine: jest.fn(),
        submit: jest.fn().mockResolvedValue({
          requires_confirmation: false,
          allowed: true,
          reason: 'ok',
          execution_result: {
            success: false,
            error_code: 'AISTUDIO_EXTERNAL_SERVICE_UNSUPPORTED',
            error_message: 'Este Zavorth suporta apenas tools nativas do Gemini API no /aistudio. Servicos externos como drive ainda nao estao habilitados aqui.',
            metadata: {
              requested_services: ['drive'],
              supported_tools: ['google_search', 'code_execution'],
            },
          },
        }),
      },
    });

    await controller.executeImmediate(ctx, task, false);

    expect(deps.createAiStudioPermissionRequest).not.toHaveBeenCalled();
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('this Zavorth supports only native Gemini API tools in /aistudio');
  });

  it('routes /stitch through the execution gateway and sends generated artifacts', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-stitch-test-');
    const imagePath = path.join(tempDir, 'stitch-preview.png');
    fs.writeFileSync(imagePath, 'fake-image', 'utf8');

    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      replyWithPhoto: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/stitch',
      raw_message: '/stitch gere um app mobile de tarefas',
      normalized_message: '/stitch gere um app mobile de tarefas',
      status: 'running',
      workspace: 'C:/repo',
    });
    const { controller, deps } = createController({
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({ getMode: jest.fn().mockReturnValue('BUILD') }),
        getPolicyEngine: jest.fn(),
        submit: jest.fn().mockResolvedValue({
          requires_confirmation: false,
          allowed: true,
          reason: 'ok',
          execution_result: {
            success: true,
            stdout: 'Projeto gerado com sucesso.',
            artifacts: [
              {
                type: 'image',
                kind: 'stitch_screenshot',
                name: 'stitch-preview.png',
                path: imagePath,
                mimeType: 'image/png',
                summary: 'Preview local da tela gerada pelo Stitch',
              },
              {
                type: 'link',
                kind: 'stitch_html_url',
                name: 'stitch-screen.html',
                url: 'https://example.com/stitch-screen.html',
                summary: 'Download remoto do HTML gerado pelo Stitch',
              },
            ],
          },
        }),
      },
    });

    try {
      await controller.resumeTaskExecution(ctx, task);

      expect(deps.applyPersistedPermissionPolicies).toHaveBeenCalledWith(task, 'stitch');
      expect(deps.executionGateway.submit).toHaveBeenCalledWith(
        task,
        expect.objectContaining({
          executor_recommendation: 'stitch',
          workspace_recommendation: 'C:/repo',
        }),
        false,
      );
      expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Google Stitch: generation completed.');
      expect(ctx.replyWithPhoto).toHaveBeenCalled();
      expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Entrega visual ready:');
      expect(task.artifacts[0]).toEqual(
        expect.objectContaining({
          name: 'stitch-preview.png',
          deliveryChannel: 'photo',
          kind: 'stitch_screenshot',
        }),
      );
      expect(task.metadata.artifact_manifest).toEqual(
        expect.objectContaining({
          total: 2,
          photos: 1,
          links: 1,
        }),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('does not re-request explicit confirmation after a task approval was already registered', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/external',
      raw_message: '/external revise esta pasta',
      normalized_message: '/external revise esta pasta',
      status: 'running',
      workspace: 'C:/repo',
      requires_approval: false,
      approval_status: 'approved',
      risk_level: 2,
    });
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(deps.executionGateway.submit).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        executor_recommendation: 'external_executor',
        requires_approval: false,
      }),
      false,
    );
  });

  it('executes planned tool steps through ToolRuntimeService before local shell commands', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/task',
      raw_message: '/task leia o readme e rode npm test',
      normalized_message: '/task leia o readme e rode npm test',
      status: 'running',
      workspace: 'C:/repo',
      actions_planned: [
        {
          step_id: 'tool-step-1',
          type: 'tool',
          description: 'Ler README',
          tool: 'read_file',
          args: { path: 'README.md' },
          command: null,
          file_targets: ['C:/repo/README.md'],
          expected_output: 'Conteudo do readme',
          sensitive: false,
        },
      ],
    });
    const toolRuntime = {
      executeTool: jest.fn().mockResolvedValue('conteudo README'),
    };
    const { controller } = createController({
      toolRuntime,
    });

    await controller.resumeTaskExecution(ctx, task);

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
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('[tool:read_file]');
  });

  it('routes /jules through the execution gateway with the Jules executor', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/jules',
      raw_message: '/jules abra uma sessao de automacao',
      normalized_message: '/jules abra uma sessao de automacao',
      status: 'running',
      workspace: 'C:/repo',
    });
    const { controller, deps } = createController();

    await controller.resumeTaskExecution(ctx, task);

    expect(deps.applyPersistedPermissionPolicies).toHaveBeenCalledWith(task, 'jules');
    expect(deps.executionGateway.submit).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        executor_recommendation: 'jules',
        workspace_recommendation: 'C:/repo',
      }),
      false,
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Jules: ready.');
  });

  it('keeps Jules tasks in waiting_approval when the external plan still needs approval', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/jules',
      raw_message: '/jules abra uma sessao de automacao',
      normalized_message: '/jules abra uma sessao de automacao',
      status: 'running',
      workspace: 'C:/repo',
    });
    const { controller, deps } = createController({
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({ getMode: jest.fn().mockReturnValue('BUILD') }),
        getPolicyEngine: jest.fn(),
        submit: jest.fn().mockResolvedValue({
          requires_confirmation: false,
          allowed: true,
          reason: 'ok',
          execution_result: {
            success: false,
            error_code: 'JULES_AWAITING_APPROVAL',
            error_message: 'Sessao Jules aguarda aprovacao do plano. SessionId: sessions/abc123',
            metadata: {
              jules_session_id: 'sessions/abc123',
            },
          },
        }),
      },
    });

    await controller.resumeTaskExecution(ctx, task);

    expect(task.status).toBe('waiting_approval');
    expect(task.metadata).toEqual(
      expect.objectContaining({
        jules_session_id: 'sessions/abc123',
        jules_requires_approval: true,
        jules_pending: false,
      }),
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Jules started the session, but its plan still needs external approval.');
  });

  it('keeps Jules tasks in delivery_pending when the remote session is still running', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;
    const task = createTask({
      command_type: '/jules',
      raw_message: '/jules abra uma sessao de automacao',
      normalized_message: '/jules abra uma sessao de automacao',
      status: 'running',
      workspace: 'C:/repo',
    });
    const { controller } = createController({
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({ getMode: jest.fn().mockReturnValue('BUILD') }),
        getPolicyEngine: jest.fn(),
        submit: jest.fn().mockResolvedValue({
          requires_confirmation: false,
          allowed: true,
          reason: 'ok',
          execution_result: {
            success: false,
            error_code: 'JULES_PENDING',
            error_message: 'Sessao Jules iniciada e ainda em andamento. SessionId: sessions/pending123',
            metadata: {
              jules_session_id: 'sessions/pending123',
            },
          },
        }),
      },
    });

    await controller.resumeTaskExecution(ctx, task);

    expect(task.status).toBe('delivery_pending');
    expect(task.metadata).toEqual(
      expect.objectContaining({
        jules_session_id: 'sessions/pending123',
        jules_requires_approval: false,
        jules_pending: true,
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Jules started the session and it is still running in the remote service.'),
      expect.objectContaining({}),
    );
  });
});
