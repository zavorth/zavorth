import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Task } from '../../src/contracts/TaskContract';
import { WorkspaceOperationalMemoryService } from '../../src/services/WorkspaceOperationalMemoryService';

jest.setTimeout(15000);

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-1',
    created_at: '2026-03-28T00:00:00.000Z',
    updated_at: '2026-03-28T00:00:00.000Z',
    source: 'telegram',
    chat_id: '42',
    user_id: '42',
    raw_message: '/run npm test',
    normalized_message: '/run npm test',
    command_type: '/run',
    intent: 'exec',
    target: null,
    workspace: 'C:/repo',
    risk_level: 1,
    status: 'completed',
    requires_planning: false,
    requires_approval: false,
    approval_status: 'not_required',
    planner_used: null,
    executor_used: 'codex',
    fallback_used: false,
    parent_task_id: null,
    actions_planned: [],
    actions_executed: [],
    target_files: [],
    artifacts: [],
    stdout_summary: null,
    stderr_summary: null,
    diff_summary: null,
    result_summary: 'ok',
    error_summary: null,
    rollback_available: false,
    metadata: {},
    ...overrides,
  };
}

describe('WorkspaceOperationalMemoryService', () => {
  it('builds operational memory from recent tasks and approved paths', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-operational-memory-'));
    try {
      const service = new WorkspaceOperationalMemoryService(
        {
          getRecentTasks: jest.fn().mockReturnValue([
            createTask({
              task_id: 'task-success-1',
              workspace: 'C:/repo',
              executor_used: 'codex',
              status: 'completed',
              updated_at: '2026-03-28T03:00:00.000Z',
              metadata: {
                direct_response_last_run: {
                  taskKind: 'code',
                  taskSubtype: 'testing',
                  providerName: 'openrouter',
                  modelName: 'anthropic/claude-3.5-sonnet:beta',
                },
              },
            }),
            createTask({
              task_id: 'task-success-2',
              workspace: 'C:/repo',
              executor_used: 'codex',
              status: 'completed',
              updated_at: '2026-03-28T04:00:00.000Z',
              metadata: {
                direct_response_last_run: {
                  taskKind: 'code',
                  taskSubtype: 'testing',
                  providerName: 'openrouter',
                  modelName: 'anthropic/claude-3.5-sonnet:beta',
                },
              },
            }),
            createTask({
              task_id: 'task-fail-1',
              workspace: 'C:/repo',
              executor_used: 'external_executor',
              status: 'failed',
              updated_at: '2026-03-28T05:00:00.000Z',
              error_summary: 'gateway timeout while listing files',
            }),
            createTask({
              task_id: 'task-reject-1',
              workspace: 'C:/repo',
              executor_used: 'external_executor',
              status: 'rejected',
              approval_status: 'rejected',
              updated_at: '2026-03-28T05:30:00.000Z',
              raw_message: '/task publique a versao final',
              metadata: {
                security_posture: {
                  high_risk_confirmation_required: true,
                  permission_history_count: 0,
                  pending_permission: false,
                },
                approval_history: [
                  {
                    action: 'reject',
                    at: '2026-03-28T05:29:00.000Z',
                    required_high_risk_pin: true,
                  },
                ],
              },
            }),
            createTask({
              task_id: 'task-auto-1',
              workspace: 'C:/repo',
              executor_used: 'god_mode',
              planner_used: 'supervisor_graph',
              status: 'completed',
              updated_at: '2026-03-28T06:00:00.000Z',
              result_summary: 'Arquitetura reorganizada com sucesso.',
              metadata: {
                autonomous_graph_last_run: {
                  taskGoal: 'revisar a arquitetura',
                  traceId: 'trace-123',
                  status: 'approved',
                  approved: true,
                  providerName: 'AIGateway',
                  modelName: 'gpt-4o',
                  iterations: 2,
                  workspaceStrategy: {
                    preferredExecutor: 'codex',
                  },
                  finishedAt: '2026-03-28T06:00:00.000Z',
                },
              },
            }),
            createTask({
              task_id: 'task-active-1',
              workspace: 'C:/repo',
              executor_used: 'codex',
              status: 'waiting_approval',
              approval_status: 'pending',
              updated_at: '2026-03-28T07:00:00.000Z',
              raw_message: '/task finalize o briefing final',
              result_summary: 'Finalizar briefing final com ajustes de posicionamento.',
              artifacts: [
                {
                  id: 'artifact-1',
                  key: 'briefing-final',
                  type: 'file',
                  kind: 'report',
                  name: 'briefing-final.md',
                  source: 'workspace',
                  path: 'C:/repo/artifacts/briefing-final.md',
                  url: null,
                  mimeType: 'text/markdown',
                  summary: 'Briefing executivo consolidado.',
                  description: null,
                  previewText: '# Briefing final',
                  sizeBytes: 1024,
                  exists: true,
                  deliveryChannel: 'document',
                  createdAt: '2026-03-28T07:00:00.000Z',
                },
              ],
              metadata: {
                security_posture: {
                  high_risk_confirmation_required: true,
                  permission_history_count: 1,
                  pending_permission: true,
                },
                approval_history: [
                  {
                    action: 'approve',
                    at: '2026-03-28T06:59:00.000Z',
                    required_high_risk_pin: true,
                  },
                ],
                permission_history: [
                  {
                    permission_id: 'perm-req-1',
                    action: 'grant',
                    at: '2026-03-28T06:58:00.000Z',
                    executor: 'codex',
                    kind: 'workspace_access',
                  },
                ],
              },
            }),
            createTask({
              task_id: 'task-approved-delivery-1',
              workspace: 'C:/repo',
              executor_used: 'codex',
              status: 'completed',
              approval_status: 'approved',
              updated_at: '2026-03-28T07:30:00.000Z',
              raw_message: '/task publique o briefing final',
              result_summary: 'Briefing final publicado com sucesso.',
              artifacts: [
                {
                  id: 'artifact-2',
                  key: 'briefing-published',
                  type: 'file',
                  kind: 'report',
                  name: 'briefing-publicado.md',
                  source: 'workspace',
                  path: 'C:/repo/artifacts/briefing-publicado.md',
                  url: null,
                  mimeType: 'text/markdown',
                  summary: 'Versao final publicada.',
                  description: null,
                  previewText: '# Briefing publicado',
                  sizeBytes: 2048,
                  exists: true,
                  deliveryChannel: 'document',
                  createdAt: '2026-03-28T07:30:00.000Z',
                },
              ],
              metadata: {
                security_posture: {
                  high_risk_confirmation_required: false,
                  permission_history_count: 1,
                  pending_permission: false,
                },
                approval_history: [
                  {
                    action: 'approve',
                    at: '2026-03-28T07:10:00.000Z',
                    required_high_risk_pin: false,
                  },
                ],
                permission_history: [
                  {
                    permission_id: 'perm-req-2',
                    action: 'grant',
                    at: '2026-03-28T07:12:00.000Z',
                    executor: 'codex',
                    kind: 'workspace_access',
                  },
                ],
              },
            }),
          ]),
        },
        {
          listApprovedRequests: jest.fn().mockResolvedValue([
            {
              permission_id: 'perm-1',
              created_at: '2026-03-28T01:00:00.000Z',
              updated_at: '2026-03-28T05:30:00.000Z',
              task_id: 'task-success-2',
              executor: 'external_executor',
              kind: 'workspace_access',
              status: 'approved',
              scope: 'workspace',
              workspace: 'C:/repo',
              requested_value: 'C:/repo/assets',
              resolved_value: 'C:/repo/assets',
              reason: 'listar assets',
              requested_by: '42',
              decided_by: '42',
              decision_note: 'ok',
              metadata: {},
            },
          ]),
        },
        root,
        {
          listRuns: jest.fn().mockReturnValue([
            {
              workflow_run_id: 'wf-ship-1',
              workflow_name: 'ship',
              objective: 'Concluir entrega final',
              workspace: 'C:/repo',
              created_at: '2026-03-28T06:30:00.000Z',
              updated_at: '2026-03-28T08:00:00.000Z',
              status: 'approval_pending',
              phases: [
                {
                  id: 'maker',
                  label: 'Codex Maker',
                  executor: 'codex',
                  role: 'maker',
                  index: 0,
                  status: 'completed',
                  objective: 'Implementar entrega final',
                  handoff_summary: null,
                  started_at: '2026-03-28T06:30:00.000Z',
                  finished_at: '2026-03-28T07:00:00.000Z',
                  result_summary: 'Implementacao concluida.',
                  artifact_count: 1,
                },
                {
                  id: 'reviewer',
                  label: 'ExternalExecutor Reviewer',
                  executor: 'external_executor',
                  role: 'reviewer',
                  index: 1,
                  status: 'approval_pending',
                  objective: 'Revisar entrega final',
                  handoff_summary: 'Implementacao concluida.',
                  started_at: '2026-03-28T07:05:00.000Z',
                  finished_at: '2026-03-28T08:00:00.000Z',
                  result_summary: 'Aguardando sua aprovacao.',
                  artifact_count: 0,
                },
              ],
              artifacts: [],
              artifacts_manifest: {
                total: 1,
                primary_artifact_name: 'briefing-final.md',
              },
              resume_stage: {
                id: 'reviewer',
                label: 'ExternalExecutor Reviewer',
                executor: 'external_executor',
                status: 'approval_pending',
                index: 1,
                attempt_count: 1,
                task_id: 'task-active-1',
                objective: 'Revisar entrega final',
                handoff_summary: 'Implementacao concluida.',
                result_summary: 'Aguardando sua aprovacao.',
                reason: 'aguarda sua confirmacao para seguir',
              },
            },
          ]),
        },
      );

      const memory = await service.getMemory('C:/repo', '42');

      expect(memory).toBeTruthy();
      expect(memory?.successful_executors[0]).toEqual(expect.objectContaining({
        executor: 'codex',
        count: 4,
      }));
      expect(memory?.repeated_failures[0]).toEqual(expect.objectContaining({
        executor: 'external_executor',
      }));
      expect(memory?.task_kind_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'code',
            preferred_executor: 'codex',
            success_count: 4,
          }),
        ]),
      );
      expect(memory?.task_subtype_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'code',
            subtype: 'testing',
            preferred_executor: 'codex',
            success_count: 3,
          }),
        ]),
      );
      expect(memory?.approved_paths[0]).toEqual(expect.objectContaining({
        path: 'C:/repo/assets',
      }));
      expect(memory?.approved_policies?.[0]).toEqual(expect.objectContaining({
        executor: 'external_executor',
        kind: 'workspace_access',
      }));
      expect(memory?.route_outcomes?.[0]).toEqual(expect.objectContaining({
        executor: 'codex',
        task_kind: 'code',
        source_surface: 'telegram',
        success_rate: expect.any(Number),
        friction_rate: expect.any(Number),
        average_approval_wait_ms: expect.any(Number),
        average_post_approval_recovery_ms: expect.any(Number),
        average_artifact_delivery_after_approval_ms: expect.any(Number),
        operator_cost_score: expect.any(Number),
      }));
      expect(memory?.route_outcomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            executor: 'codex',
            gated_completion_count: 1,
            gated_artifactful_count: 1,
          }),
        ]),
      );
      expect(memory?.autonomous_outcomes[0]).toEqual(expect.objectContaining({
        status: 'approved',
        approved: true,
        iterations: 2,
        task_kind: 'code',
        task_subtype: 'review',
        preferred_executor: 'codex',
      }));
      expect(memory?.autonomous_mode_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'code',
            subtype: 'review',
            preferred_mode: 'autonomous',
            approved_count: 1,
            failed_count: 0,
          }),
        ]),
      );
      expect(memory?.direct_response_style_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'code',
            subtype: 'testing',
            preferred_style: 'findings_first',
            success_count: 3,
          }),
          expect.objectContaining({
            kind: 'code',
            subtype: 'review',
            preferred_style: 'findings_first',
            success_count: 1,
          }),
        ]),
      );
      expect(memory?.task_kind_llm_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'code',
            preferred_provider: 'openrouter',
            preferred_model: 'anthropic/claude-3.5-sonnet:beta',
            success_count: 2,
          }),
        ]),
      );
      expect(memory?.task_subtype_llm_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'code',
            subtype: 'testing',
            preferred_provider: 'openrouter',
            preferred_model: 'anthropic/claude-3.5-sonnet:beta',
            success_count: 2,
          }),
          expect.objectContaining({
            kind: 'code',
            subtype: 'review',
            preferred_provider: 'AIGateway',
            preferred_model: 'gpt-4o',
            success_count: 1,
          }),
        ]),
      );
      expect(memory?.active_focuses[0]).toEqual(
        expect.objectContaining({
          task_id: 'task-active-1',
          executor: 'codex',
          kind: 'code',
          subtype: 'testing',
        }),
      );
      expect(memory?.recent_artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            task_id: 'task-approved-delivery-1',
            name: 'briefing-publicado.md',
          }),
        ]),
      );
      expect(memory?.recent_workflow_runs[0]).toEqual(
        expect.objectContaining({
          workflow_run_id: 'wf-ship-1',
          workflow_name: 'ship',
          status: 'approval_pending',
          completed_stages: 1,
          total_stages: 2,
          resume_stage_label: 'ExternalExecutor Reviewer',
          resume_stage_status: 'approval_pending',
        }),
      );
      expect(memory?.workflow_recommendations[0]).toEqual(
        expect.objectContaining({
          workflow: 'ship',
          pending_count: 1,
        }),
      );
      expect(memory?.workflow_recommendations[0]?.rationale).toContain('Etapa mais sensivel agora: ExternalExecutor Reviewer');
      expect(memory?.workflow_executor_recommendations?.[0]).toEqual(
        expect.objectContaining({
          workflow: 'ship',
          executor: 'codex',
        }),
      );
      expect(memory?.workflow_stage_executor_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            workflow: 'ship',
            role: 'maker',
            executor: 'codex',
            success_count: 1,
          }),
          expect.objectContaining({
            workflow: 'ship',
            role: 'reviewer',
            executor: 'external_executor',
            pending_count: 1,
          }),
        ]),
      );
      expect(memory?.workflow_friction_recommendations?.[0]).toEqual(
        expect.objectContaining({
          workflow: 'ship',
          approval_pending_count: 1,
          last_resume_stage_label: 'ExternalExecutor Reviewer',
        }),
      );
      expect(memory?.approval_friction_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            executor: 'external_executor',
            kind: 'code',
            rejected_count: 2,
            high_risk_count: 1,
          }),
          expect.objectContaining({
            executor: 'codex',
            kind: 'code',
            subtype: 'testing',
            pending_count: 1,
            permission_count: 2,
            high_risk_count: 1,
            granted_count: 4,
            delivered_after_approval_count: 1,
            average_wait_ms: expect.any(Number),
            average_recovery_ms: expect.any(Number),
          }),
        ]),
      );
      expect(memory?.route_outcomes?.some((entry) => String(entry?.rationale || '').includes('espera media'))).toBe(true);
      expect(memory?.continuity_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'resolve_approval',
            task_id: 'task-active-1',
          }),
          expect.objectContaining({
            kind: 'resume_workflow',
            label: 'Retomar workflow ship em ExternalExecutor Reviewer',
            artifact_name: 'briefing-final.md',
          }),
          expect.objectContaining({
            kind: 'revisit_failure',
            executor: 'external_executor',
          }),
        ]),
      );
      expect(memory?.summary).toContain('melhor executor recente codex');
      expect(memory?.summary).toContain('falha recorrente external_executor');
      expect(memory?.summary).toContain('preferencia code -> codex');
      expect(memory?.summary).toContain('subtipo testing -> codex');
      expect(memory?.summary).toContain('llm testing -> openrouter/anthropic/claude-3.5-sonnet:beta');
      expect(memory?.summary).toContain('foco ativo Finalizar briefing final com ajustes de posicionamento.');
      expect(memory?.summary).toContain('entrega recente briefing-publicado.md');
      expect(memory?.summary).toContain('workflow recente ship (approval_pending)');
      expect(memory?.summary).toContain('workflow sugerido ship');
      expect(memory?.summary).toContain('executor por workflow ship -> codex');
      expect(memory?.summary).toContain('friccao workflow ship -> ExternalExecutor Reviewer');
      expect(memory?.summary).toContain('friccao code');
      expect(memory?.summary).toContain('proximo passo Resolver task-act');
      expect(memory?.summary).toContain('ultimo ciclo autonomo approved');
      expect(memory?.summary).toContain('modo sugerido review -> autonomous');
      expect(memory?.summary).toContain('formato direto testing -> findings_first');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('learns when a workflow completed after an interruption and turns that into continuity', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-operational-memory-recovery-'));
    try {
      const service = new WorkspaceOperationalMemoryService(
        {
          getRecentTasks: jest.fn().mockReturnValue([
            createTask({
              task_id: 'task-success-recovery-1',
              workspace: 'C:/repo',
              executor_used: 'external_executor',
              status: 'completed',
              updated_at: '2026-03-29T10:05:00.000Z',
              result_summary: 'Briefing final publicado com sucesso.',
              metadata: {
                workflow_run_id: 'wf-ship-recovered-1',
                workspace_route_outcome: {
                  final_executor: 'external_executor',
                  source_surface: 'telegram',
                  source: 'workflow_memory',
                  strategy: 'workflow_resume',
                  workflow_name: 'ship',
                  task_kind: 'code',
                  task_subtype: 'review',
                },
              },
              artifacts: [
                {
                  id: 'artifact-final-1',
                  key: 'briefing-final',
                  type: 'file',
                  kind: 'report',
                  name: 'briefing-final.md',
                  source: 'workspace',
                  path: 'C:/repo/artifacts/briefing-final.md',
                  url: null,
                  mimeType: 'text/markdown',
                  summary: 'Entrega final pronta.',
                  description: null,
                  previewText: '# Briefing final',
                  sizeBytes: 1024,
                  exists: true,
                  deliveryChannel: 'document',
                  createdAt: '2026-03-29T10:05:00.000Z',
                },
              ],
            }),
          ]),
        },
        {
          listApprovedRequests: jest.fn().mockResolvedValue([]),
        },
        root,
        {
          listRuns: jest.fn().mockReturnValue([
            {
              workflow_run_id: 'wf-ship-recovered-1',
              workflow_name: 'ship',
              objective: 'Publicar o briefing final',
              workspace: 'C:/repo',
              created_at: '2026-03-29T09:00:00.000Z',
              updated_at: '2026-03-29T10:05:00.000Z',
              status: 'completed',
              phases: [
                {
                  id: 'maker',
                  label: 'Codex Maker',
                  executor: 'codex',
                  role: 'maker',
                  index: 0,
                  status: 'completed',
                  objective: 'Preparar briefing final',
                  handoff_summary: null,
                  started_at: '2026-03-29T09:00:00.000Z',
                  finished_at: '2026-03-29T09:25:00.000Z',
                  result_summary: 'Rascunho pronto.',
                  artifact_count: 1,
                },
                {
                  id: 'reviewer',
                  label: 'ExternalExecutor Reviewer',
                  executor: 'external_executor',
                  role: 'reviewer',
                  index: 1,
                  status: 'completed',
                  objective: 'Revisar e publicar briefing final',
                  handoff_summary: 'Rascunho pronto.',
                  started_at: '2026-03-29T09:30:00.000Z',
                  finished_at: '2026-03-29T10:05:00.000Z',
                  result_summary: 'Briefing final publicado.',
                  artifact_count: 1,
                },
              ],
              artifacts: [],
              artifacts_manifest: {
                total: 1,
                primary_artifact_name: 'briefing-final.md',
              },
              resume_stage: null,
              resume_prompt: null,
              externalized_state: {
                run_dir: 'C:/tmp/wf-ship-recovered-1',
                state_file: 'C:/tmp/wf-ship-recovered-1/state.json',
                compatibility_state_file: 'C:/tmp/wf-ship-recovered-1.json',
                checkpoints_file: 'C:/tmp/wf-ship-recovered-1/checkpoints.ndjson',
                ledger_file: 'C:/tmp/wf-ship-recovered-1/ledger.json',
                latest_checkpoint_id: 'cp-4',
                checkpoint_count: 4,
                latest_state_hash: 'hash-4',
                latest_chain_hash: 'chain-4',
                last_event: 'stage_completed',
                recent_checkpoints: [
                  {
                    checkpoint_id: 'cp-4',
                    sequence: 4,
                    event: 'stage_completed',
                    status: 'completed',
                    updated_at: '2026-03-29T10:05:00.000Z',
                    resume_stage_id: null,
                    chain_hash: 'chain-4',
                    previous_chain_hash: 'chain-3',
                  },
                  {
                    checkpoint_id: 'cp-3',
                    sequence: 3,
                    event: 'stage_started',
                    status: 'running',
                    updated_at: '2026-03-29T09:40:00.000Z',
                    resume_stage_id: 'reviewer',
                    chain_hash: 'chain-3',
                    previous_chain_hash: 'chain-2',
                  },
                  {
                    checkpoint_id: 'cp-2',
                    sequence: 2,
                    event: 'stage_interrupted',
                    status: 'approval_pending',
                    updated_at: '2026-03-29T09:35:00.000Z',
                    resume_stage_id: 'reviewer',
                    chain_hash: 'chain-2',
                    previous_chain_hash: 'chain-1',
                  },
                ],
              },
            },
          ]),
        },
      );

      const memory = await service.getMemory('C:/repo', '42');

      expect(memory?.recent_workflow_runs[0]).toEqual(
        expect.objectContaining({
          workflow_run_id: 'wf-ship-recovered-1',
          workflow_name: 'ship',
          status: 'completed',
          recovered_from_interruption: true,
          interruption_count: 1,
          last_interrupted_stage_label: 'ExternalExecutor Reviewer',
        }),
      );
      expect(memory?.workflow_recommendations[0]).toEqual(
        expect.objectContaining({
          workflow: 'ship',
          success_count: 1,
          recovered_count: 1,
          last_recovered_stage_label: 'ExternalExecutor Reviewer',
        }),
      );
      expect(memory?.workflow_recommendations[0]?.rationale).toContain('recuperacao(oes) recente(s) fecharam bem');
      expect(memory?.route_outcomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            executor: 'external_executor',
            workflow_name: 'ship',
            task_kind: 'code',
            task_subtype: 'review',
            workflow_recovered_count: 1,
            workflow_recovery_success_count: 1,
            workflow_recovery_artifactful_count: 1,
          }),
        ]),
      );
      expect(memory?.route_outcomes?.[0]?.rationale).toContain('retomada(s) concluida(s)');
      expect(memory?.route_outcomes?.[0]?.rationale).toContain('entrega(s) finais');
      expect(memory?.continuity_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'continue_from_success',
            label: 'Continuar apos ship em ExternalExecutor Reviewer',
            artifact_name: 'briefing-final.md',
          }),
        ]),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('learns when a workflow recovers after an interruption and closes successfully', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-operational-memory-recovery-'));
    try {
      const service = new WorkspaceOperationalMemoryService(
        {
          getRecentTasks: jest.fn().mockReturnValue([]),
        },
        {
          listApprovedRequests: jest.fn().mockResolvedValue([]),
        },
        root,
        {
          listRuns: jest.fn().mockReturnValue([
            {
              workflow_run_id: 'wf-ship-recovered',
              workflow_name: 'ship',
              objective: 'Publicar briefing final',
              workspace: 'C:/repo',
              created_at: '2026-04-02T09:00:00.000Z',
              updated_at: '2026-04-02T09:20:00.000Z',
              status: 'completed',
              phases: [
                {
                  id: 'maker',
                  label: 'Codex Maker',
                  executor: 'codex',
                  role: 'maker',
                  index: 0,
                  status: 'completed',
                  attempt_count: 1,
                  objective: 'Preparar briefing final',
                  handoff_summary: null,
                  started_at: '2026-04-02T09:00:00.000Z',
                  finished_at: '2026-04-02T09:08:00.000Z',
                  result_summary: 'Rascunho pronto.',
                  artifact_count: 1,
                },
                {
                  id: 'reviewer',
                  label: 'ExternalExecutor Reviewer',
                  executor: 'external_executor',
                  role: 'reviewer',
                  index: 1,
                  status: 'completed',
                  attempt_count: 2,
                  objective: 'Revisar briefing final',
                  handoff_summary: 'Rascunho pronto.',
                  started_at: '2026-04-02T09:10:00.000Z',
                  finished_at: '2026-04-02T09:20:00.000Z',
                  result_summary: 'Briefing aprovado e publicado.',
                  artifact_count: 1,
                },
              ],
              artifacts: [],
              artifacts_manifest: {
                total: 1,
                primary_artifact_name: 'briefing-final.md',
              },
              externalized_state: {
                checkpoint_count: 4,
                last_event: 'stage_completed',
                latest_chain_hash: 'hash-final',
                recent_checkpoints: [
                  {
                    checkpoint_id: 'chk-4',
                    sequence: 4,
                    event: 'stage_completed',
                    status: 'completed',
                    updated_at: '2026-04-02T09:20:00.000Z',
                    resume_stage_id: null,
                    chain_hash: 'hash-final',
                    previous_chain_hash: 'hash-3',
                  },
                  {
                    checkpoint_id: 'chk-3',
                    sequence: 3,
                    event: 'stage_started',
                    status: 'running',
                    updated_at: '2026-04-02T09:15:00.000Z',
                    resume_stage_id: 'reviewer',
                    chain_hash: 'hash-3',
                    previous_chain_hash: 'hash-2',
                  },
                  {
                    checkpoint_id: 'chk-2',
                    sequence: 2,
                    event: 'stage_interrupted',
                    status: 'approval_pending',
                    updated_at: '2026-04-02T09:12:00.000Z',
                    resume_stage_id: 'reviewer',
                    chain_hash: 'hash-2',
                    previous_chain_hash: 'hash-1',
                  },
                ],
              },
              resume_stage: null,
            },
          ]),
        },
      );

      const memory = await service.getMemory('C:/repo', '42');

      expect(memory?.recent_workflow_runs[0]).toEqual(
        expect.objectContaining({
          workflow_run_id: 'wf-ship-recovered',
          recovered_from_interruption: true,
          interruption_count: 1,
          last_interrupted_stage_label: 'ExternalExecutor Reviewer',
        }),
      );
      expect(memory?.workflow_recommendations[0]).toEqual(
        expect.objectContaining({
          workflow: 'ship',
          success_count: 1,
          recovered_count: 1,
        }),
      );
      expect(memory?.workflow_recommendations[0]?.rationale).toContain('recuperacao(oes) recente(s)');
      expect(memory?.workflow_executor_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            workflow: 'ship',
            executor: 'external_executor',
            recovered_count: 1,
          }),
        ]),
      );
      expect(memory?.workflow_stage_executor_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            workflow: 'ship',
            role: 'reviewer',
            executor: 'external_executor',
            recovered_count: 1,
          }),
        ]),
      );
      expect(memory?.continuity_recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'continue_from_success',
            artifact_name: 'briefing-final.md',
          }),
        ]),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not suggest resuming a workflow after the operator closes it', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-operational-memory-closed-workflow-'));
    try {
      const service = new WorkspaceOperationalMemoryService(
        {
          getRecentTasks: jest.fn().mockReturnValue([]),
        },
        {
          listApprovedRequests: jest.fn().mockResolvedValue([]),
        },
        root,
        {
          listRuns: jest.fn().mockReturnValue([
            {
              workflow_run_id: 'wf-ship-closed-1',
              workflow_name: 'ship',
              objective: 'Publicar briefing final',
              workspace: 'C:/repo',
              created_at: '2026-04-02T09:00:00.000Z',
              updated_at: '2026-04-02T09:20:00.000Z',
              status: 'blocked',
              operator_state: 'closed',
              operator_close_reason: 'Operador preferiu encerrar a retomada.',
              phases: [
                {
                  id: 'review',
                  label: 'ExternalExecutor Reviewer',
                  executor: 'external_executor',
                  role: 'reviewer',
                  strategy_note: null,
                  index: 0,
                  status: 'blocked',
                  task_id: 'task-review-closed',
                  attempt_count: 1,
                  objective: 'Validar a entrega final.',
                  handoff_summary: 'Checklist pronto para liberar.',
                  started_at: '2026-04-02T09:05:00.000Z',
                  finished_at: '2026-04-02T09:10:00.000Z',
                  result_summary: 'Bloqueado aguardando decisao do operador.',
                  artifact_count: 0,
                },
              ],
              resume_stage: null,
              actionable_stages: [],
              resume_prompt: null,
              artifacts: [],
              artifacts_manifest: {},
              externalized_state: null,
            },
          ]),
        } as any,
      );

      const memory = await service.getMemory('C:/repo', '42');

      expect(memory?.recent_workflow_runs[0]).toEqual(
        expect.objectContaining({
          workflow_run_id: 'wf-ship-closed-1',
          operator_state: 'closed',
          operator_close_reason: 'Operador preferiu encerrar a retomada.',
        }),
      );
      expect(memory?.continuity_recommendations.some((entry) => entry.kind === 'resume_workflow')).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
