import { TaskResourcePlannerService } from '../../src/services/TaskResourcePlannerService';

describe('TaskResourcePlannerService', () => {
  it('detects heavy capabilities and companion dependencies for sandboxed visual work', async () => {
    const service = new TaskResourcePlannerService({
      capabilityLifecycle: {
        getManifest: jest.fn((capabilityId: string) => {
          if (capabilityId === 'qa') {
            return {
              id: 'qa',
              label: 'QA visual',
              activationMode: 'lazy',
              approvalRequired: true,
              estimatedFootprint: {
                ramIdleMb: 160,
                diskMb: 1024,
                processCount: 1,
                notes: 'Playwright e browsers.',
              },
              fallbackBehavior: 'Mantem smoke textual.',
              provisioningRecipe: null,
            };
          }
          if (capabilityId === 'sandbox') {
            return {
              id: 'sandbox',
              label: 'Sandbox',
              activationMode: 'sidecar',
              approvalRequired: true,
              estimatedFootprint: {
                ramIdleMb: 192,
                diskMb: 1536,
                processCount: 1,
                notes: 'Docker e isolamento.',
              },
              fallbackBehavior: 'Executa no host local guardado.',
              provisioningRecipe: null,
            };
          }
          return null;
        }),
      } as any,
      desktopResources: {
        readLatest: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          host: {
            pressure: 'high',
          },
        })),
        inspectLive: jest.fn(),
      } as any,
    });

    const impact = await service.planChatTask('Abra o browser, tire um screenshot visual e rode isso em sandbox docker');

    expect(impact.heavy).toBe(true);
    expect(impact.approvalRequired).toBe(true);
    expect(impact.budget.capabilityIds).toEqual(expect.arrayContaining(['qa', 'sandbox']));
    expect(impact.budget.companionDependencies).toEqual(expect.arrayContaining(['wsl', 'docker-desktop']));
    expect(impact.userFacingSummary).toContain('QA visual');
    expect(impact.warnings.join(' ')).toContain('Host em pressao high');
  });

  it('builds a capability impact plan with fallback and dependency details', async () => {
    const service = new TaskResourcePlannerService({
      capabilityLifecycle: {
        getManifest: jest.fn(() => ({
          id: 'sandbox',
          label: 'Sandbox',
          activationMode: 'sidecar',
          approvalRequired: true,
          estimatedFootprint: {
            ramIdleMb: 192,
            diskMb: 1536,
            processCount: 1,
            notes: 'Pode subir microVM ou Docker sandbox.',
          },
          fallbackBehavior: 'Executa no modo local guardado sem expandir isolamento pesado.',
          provisioningRecipe: {
            notes: 'Provisiona somente quando o operador aprova.',
          },
        })),
      } as any,
    });

    const impact = await service.planCapabilityEnable('sandbox', {
      intent: 'Habilitar sandbox para tarefa sensivel.',
    });

    expect(impact).not.toBeNull();
    expect(impact?.budget.companionDependencies).toEqual(expect.arrayContaining(['wsl', 'docker-desktop']));
    expect(impact?.budget.fallback).toContain('modo local guardado');
    expect(impact?.budget.externalExposure).toBe('local');
  });
});
