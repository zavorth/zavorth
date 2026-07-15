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

describe('WorkerDelegationRouterService', () => {
  const router = new WorkerDelegationRouterService();

  it('routes to local_tools only with structured preferLocalTools', () => {
    const d = router.route({
      task: 'Read the file README.md and summarize it',
      preferLocalTools: true,
      risk: 'observation',
      availableLocalTools: ['read_file', 'list_directory', 'zavorth_action'],
      workers: internalWorkers(),
    });
    expect(d.kind).toBe('local_tools');
    expect(d.suggestedWorkerId).toBeNull();
    expect(d.suggestedLocalTools).toContain('read_file');
    expect(d.reasons.join(' ')).toMatch(/preferLocalTools|local/i);
  });

  it('does not keyword-route free-text to local_tools without structured flags', () => {
    const d = router.route({
      task: 'Read the file README.md and summarize it',
      availableLocalTools: ['read_file', 'list_directory', 'zavorth_action'],
      workers: internalWorkers(),
    });
    // Unstructured free text → worker dry-run default, not keyword local match
    expect(d.kind).toBe('worker_dry_run');
    expect(d.risk).toBe('unknown');
  });

  it('routes explicit structured workerId to worker_dry_run', () => {
    const d = router.route({
      task: 'Delegate research about the codebase',
      workerId: 'internal:researcher',
      workers: internalWorkers(),
    });
    expect(d.kind).toBe('worker_dry_run');
    expect(d.suggestedWorkerId).toBe('internal:researcher');
    expect(d.preferDryRun).toBe(true);
    expect(d.requiresApproval).toBe(true);
  });

  it('shell risk is structured only and prefers worker dry-run', () => {
    const d = router.route({
      task: 'Run a shell batch on the monorepo',
      risk: 'shell',
      workers: internalWorkers(),
    });
    expect(d.risk).toBe('shell');
    expect(d.requiresApproval).toBe(true);
    expect(d.preferDryRun).toBe(true);
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

  it('guidance mentions workers and dry-run approval without free-text keyword routing', () => {
    const g = formatWorkerDelegationGuidance();
    expect(g).toMatch(/worker mesh/i);
    expect(g).toMatch(/dry-run/i);
    expect(g).toMatch(/approval/i);
    expect(g).toMatch(/Free text does not keyword/i);

    const full = formatAgentToolModelGuidance();
    expect(full).toMatch(/Delegation model/i);
    expect(full).toMatch(/zavorth_action/);
  });

  it('web search stays local only when preferLocalTools is structured', () => {
    const d = router.route({
      task: 'Search the web for current Node LTS version',
      preferLocalTools: true,
      risk: 'observation',
      availableLocalTools: ['web_search', 'get_datetime', 'read_file'],
    });
    expect(d.kind).toBe('local_tools');
    expect(d.suggestedLocalTools).toContain('web_search');
  });
});
