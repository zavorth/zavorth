import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AutonomousHousekeepingAgentService } from '../../src/domain/ops/infrastructure/AutonomousHousekeepingAgentService.js';

describe('AutonomousHousekeepingAgentService', () => {
  it('runs housekeeping operations and prepares a supervised refactor preview', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-housekeeping-runtime-cycle-'));
    const runtimeDir = path.join(tempDir, 'runtime');
    const smokeDir = path.join(runtimeDir, 'visual-smoke', 'profile-1');
    fs.mkdirSync(smokeDir, { recursive: true });
    fs.writeFileSync(path.join(runtimeDir, 'oversized.log'), 'x'.repeat(200), 'utf8');
    fs.writeFileSync(path.join(smokeDir, 'artifact.txt'), 'stale', 'utf8');

    const service = new AutonomousHousekeepingAgentService({
      architectureScorecard: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-18T10:00:00.000Z',
          workspaceRoot: tempDir,
          srcRoot: tempDir,
          summary: {
            posture: 'attention',
          },
          gate: {
            status: 'warning',
          },
          actions: [
            {
              id: 'trim-services',
              label: 'Esvaziar facades de compatibilidade',
              severity: 'warn',
              reason: 'Ainda existem facades temporarias para remover.',
              command: 'npm run qa:architecture',
            },
          ],
          narrative: {
            operatorSummary: 'Arquitetura pede mais uma rodada de limpeza.',
            nextAction: 'Rodar qa:architecture.',
          },
        })),
      } as any,
      logMaintenanceService: {
        rotateOversizedLogs: jest.fn(() => [
          {
            file: path.join(runtimeDir, 'oversized.log'),
            rotated: true,
            sizeBytes: 200,
          },
        ]),
      } as any,
      artifactMaintenanceService: {
        cleanupVisualSmokeProfiles: jest.fn(() => ({
          deletedEntries: 1,
          freedBytes: 5,
        })),
      } as any,
      maintenanceAutomationService: {
        triggerNow: jest.fn(() => ({
          lastActionId: 'scheduled-maintenance',
          note: 'ok',
        })),
      } as any,
      selfModificationCommandService: {
        createGoalPreview: jest.fn(async (goal: string) => ({
          success: true,
          previewId: 'preview-runtime-cycle',
          artifactId: 'preview-runtime-cycle',
          summary: `Preview pronta para: ${goal}`,
          reason: 'ok',
        })),
      } as any,
      now: () => new Date('2026-04-18T10:00:00.000Z'),
    });

    const snapshot = await service.runCycle({
      requestedBy: 'runtime-cycle-smoke',
      triggerMaintenance: true,
      prepareRefactorPreview: true,
    });

    expect(snapshot.posture).toBe('attention');
    expect(snapshot.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'log-rotation',
        status: 'completed',
      }),
      expect.objectContaining({
        id: 'scheduled-maintenance',
        artifactId: 'scheduled-maintenance',
      }),
      expect.objectContaining({
        id: 'refactor-preview',
        artifactId: 'preview-runtime-cycle',
      }),
    ]));
    expect(snapshot.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'run',
        source: 'automation',
      }),
    ]));
  });
});
