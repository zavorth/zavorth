import assert from 'node:assert/strict';
import { DynamicHierarchySwarmService } from '../src/domain/execution/application/DynamicHierarchySwarmService.js';

function main(): void {
  const launchSwarm = (input: any) => ({
    swarmId: input.swarmId,
    status: 'running',
    objective: input.objective,
    roles: input.roles.map((role: any) => ({
      roleId: role.id,
      label: role.label,
      status: 'PROCESSING',
      output: [],
      startedAt: '2026-04-18T10:00:00.000Z',
      finishedAt: null,
    })),
    startedAt: '2026-04-18T10:00:00.000Z',
    finishedAt: null,
    synthesizedOutput: null,
  });

  const service = new DynamicHierarchySwarmService({
    swarmLauncher: { launchSwarm } as any,
  });
  const result = service.launchHierarchy({
    hierarchyId: 'runtime-cycle-hierarchy-smoke',
    objective: 'Fechar a runtime cycle com swarm de hierarquia dinamica, sandbox profundo e housekeeping autonomo.',
    complexity: 'high',
    maxDepth: 2,
    maxLeafRoles: 6,
    requestedBy: 'qa-runtime-cycle',
  });

  assert.equal(result.plan.hierarchyId, 'runtime-cycle-hierarchy-smoke');
  assert.equal(result.plan.complexity, 'high');
  assert.ok(result.plan.totalNodes > 3);
  assert.ok(result.plan.leafRoles.length > 3);
  assert.equal(result.snapshot.swarmId, 'runtime-cycle-hierarchy-smoke');

  console.log(JSON.stringify({
    ok: true,
    hierarchyId: result.plan.hierarchyId,
    totalNodes: result.plan.totalNodes,
    leafRoles: result.plan.leafRoles.map((role) => role.label),
  }, null, 2));
}

main();
