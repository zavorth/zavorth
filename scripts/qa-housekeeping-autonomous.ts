import assert from 'node:assert/strict';
import { AutonomousHousekeepingAgentService } from '../src/domain/ops/application/AutonomousHousekeepingAgentService.js';

async function main(): Promise<void> {
  const service = new AutonomousHousekeepingAgentService({
    architectureScorecard: {
      buildSnapshot: () => ({
        generatedAt: '2026-04-18T10:00:00.000Z',
        workspaceRoot: process.cwd(),
        srcRoot: process.cwd(),
        summary: {
          posture: 'attention',
        },
        gate: {
          status: 'warning',
        },
        actions: [
          {
            id: 'runtime-cycle-followup',
            label: 'Preparar pequeno refactor supervisionado',
            severity: 'warn',
            reason: 'A runtime cycle segue experimental e precisa de preview supervisionada.',
            command: 'npm run qa:architecture',
          },
        ],
        narrative: {
          operatorSummary: 'Arquitetura em atencao controlada para trilhas experimentais.',
          nextAction: 'Rodar qa:architecture.',
        },
      }),
    } as any,
    logMaintenanceService: {
      rotateOversizedLogs: () => [],
    } as any,
    artifactMaintenanceService: {
      cleanupVisualSmokeProfiles: () => ({
        deletedEntries: 0,
        freedBytes: 0,
      }),
    } as any,
    maintenanceAutomationService: {
      triggerNow: () => ({
        lastActionId: 'scheduled-maintenance',
        note: 'ok',
      }),
    } as any,
    selfModificationCommandService: {
      createGoalPreview: async (goal: string) => ({
        success: true,
        previewId: 'runtime-cycle-housekeeping-preview',
        artifactId: 'runtime-cycle-housekeeping-preview',
        summary: `Preview pronta para: ${goal}`,
        reason: 'ok',
      }),
    } as any,
  });

  const snapshot = await service.runCycle({
    requestedBy: 'qa-runtime-cycle',
    triggerMaintenance: true,
    prepareRefactorPreview: true,
  });

  assert.equal(snapshot.posture, 'attention');
  assert.ok(snapshot.operations.some((entry) => entry.id === 'refactor-preview' && entry.status === 'completed'));

  console.log(JSON.stringify({
    ok: true,
    posture: snapshot.posture,
    operations: snapshot.operations.map((entry) => ({
      id: entry.id,
      status: entry.status,
      artifactId: entry.artifactId,
    })),
    summary: snapshot.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error('[qa:housekeeping-autonomous] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
