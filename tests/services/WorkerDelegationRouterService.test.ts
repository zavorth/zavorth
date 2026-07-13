import {
  WorkerDelegationRouterService,
  formatWorkerDelegationGuidance,
} from '../../src/services/WorkerDelegationRouterService.js';
import { formatAgentToolModelGuidance } from '../../src/services/AgentToolModelGuidance.js';
import type { WorkerProfile } from '../../src/contracts/skill/ZavorthSkillWorkerMeshContract.js';
import { ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION } from '../../src/contracts/skill/ZavorthSkillWorkerMeshContract.js';

function internalWorkers(): WorkerProfile[] {
  const now = '2026-07-13T21:00:00.000Z';
  return (['leaf', 'researcher', 'executor'] as const).map((role) => ({
    contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
    kind: 'worker-profile' as const,
    id: `internal:${role}`,
    label: `Internal ${role}`,
    adapter: 'internal' as const,
    how: {
      command: null,
      args: [],
      endpoint: null,
      root: null,
      internalRole: role,
    },
    capabilities: [`delegate.${role}`],
    health: { status: 'healthy' as const, checkedAt: now, detail: 'ok' },
    policy: {
      liveEnabled: true,
      requiresApprovalPerInvoke: true,
      allowNetwork: false,
      isolation: 'internal' as const,
    },
    createdAt: now,
    updatedAt: now,
  }));
}

describe('W5 WorkerDelegationRouterService', () => {
  const router = new WorkerDelegationRouterService();

  it('routes simple file read to local_tools', () => {
    const d = router.route({
      task: 'Read the file README.md and summarize it',
      availableLocalTools: ['read_file', 'list_directory', 'zavorth_action'],
      workers: internalWorkers(),
    });
    expect(d.kind).toBe('local_tools');
    expect(d.suggestedWorkerId).toBeNull();
    expect(d.suggestedLocalTools).toContain('read_file');
    expect(d.reasons.join(' ')).toMatch(/local/i);
  });

  it('routes explicit internal worker to worker_dry_run', () => {
    const d = router.route({
      task: 'Delegate research to internal:researcher about the codebase',
      workers: internalWorkers(),
    });
    expect(d.kind).toBe('worker_dry_run');
    expect(d.suggestedWorkerId).toBe('internal:researcher');
    expect(d.preferDryRun).toBe(true);
    expect(d.requiresApproval).toBe(true);
  });

  it('shell risk requires approval and prefers worker dry-run', () => {
    const d = router.route({
      task: 'Run a shell batch with sudo on the whole monorepo via isolated worker',
      workers: internalWorkers(),
    });
    expect(d.risk).toBe('shell');
    expect(d.requiresApproval).toBe(true);
    expect(d.preferDryRun).toBe(true);
    expect(['worker_dry_run', 'worker_live', 'local_tools']).toContain(d.kind);
    // Should not stay purely local for isolated shell batch
    expect(d.kind).not.toBe('local_tools');
  });

  it('mergeWorkerResultIntoContext wraps as untrusted', () => {
    const block = router.mergeWorkerResultIntoContext({
      workerId: 'internal:leaf',
      receiptId: 'rcpt-1',
      mode: 'dry-run',
      stdoutSummary: 'hello from worker',
      reason: 'dry-run ok',
    });
    expect(block).toMatch(/untrusted_tool_output|hello from worker/i);
    expect(block).toMatch(/internal:leaf/);
  });

  it('guidance mentions workers and dry-run approval', () => {
    const g = formatWorkerDelegationGuidance();
    expect(g).toMatch(/worker mesh/i);
    expect(g).toMatch(/dry-run/i);
    expect(g).toMatch(/approval/i);
    expect(g).not.toMatch(/openclaw|claude code|cursor/i);

    const full = formatAgentToolModelGuidance();
    expect(full).toMatch(/Delegation model/i);
    expect(full).toMatch(/zavorth_action/);
  });

  it('web search stays local when web_search is available', () => {
    const d = router.route({
      task: 'Search the web for current Node LTS version',
      availableLocalTools: ['web_search', 'get_datetime', 'read_file'],
    });
    expect(d.kind).toBe('local_tools');
    expect(d.suggestedLocalTools).toContain('web_search');
  });
});
