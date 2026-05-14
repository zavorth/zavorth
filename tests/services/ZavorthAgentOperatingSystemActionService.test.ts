import { ZavorthAgentOperatingSystemActionService } from '../../src/services/ZavorthAgentOperatingSystemActionService';

describe('ZavorthAgentOperatingSystemActionService', () => {
  it('starts an SDD loop through the workflow controller', async () => {
    const handleWorkflow = jest.fn(async (_ctx: any, args: string) => {
      expect(args).toBe('sdd multisurface/shared-command-contract');
    });

    const service = new ZavorthAgentOperatingSystemActionService({
      workflowController: {
        handleWorkflow,
      },
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          teams: [
            {
              id: 'sdd',
              label: 'SDD Loop Team',
            },
          ],
        })),
      } as any,
      agentOperatingSystemService: {
        buildSnapshot: jest.fn(() => ({
          summary: { loops: 1 },
        })),
      } as any,
      capabilityCatalogService: {
        buildSnapshot: jest.fn(() => ({
          agentOs: { summary: { loops: 1 } },
        })),
      } as any,
    });

    const result = await service.execute({
      actionId: 'start_loop',
      teamId: 'sdd',
      featureId: 'multisurface/shared-command-contract',
    });

    expect(handleWorkflow).toHaveBeenCalledTimes(1);
    expect(result.action).toEqual(
      expect.objectContaining({
        actionId: 'start_loop',
        teamId: 'sdd',
        command: '/workflow sdd multisurface/shared-command-contract',
      }),
    );
    expect(result.capabilities).toEqual(
      expect.objectContaining({
        agentOs: expect.any(Object),
      }),
    );
  });

  it('resumes a loop through the workflow controller', async () => {
    const handleWorkflow = jest.fn(async (_ctx: any, args: string) => {
      expect(args).toBe('resume wf-sdd-001 spec');
    });

    const service = new ZavorthAgentOperatingSystemActionService({
      workflowController: {
        handleWorkflow,
      },
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          teams: [
            {
              id: 'sdd',
              label: 'SDD Loop Team',
            },
          ],
        })),
      } as any,
      agentOperatingSystemService: {
        buildSnapshot: jest.fn(() => ({
          summary: { loops: 1 },
        })),
      } as any,
    });

    const result = await service.execute({
      actionId: 'resume_loop',
      workflowRunId: 'wf-sdd-001',
      resumeStageId: 'spec',
      teamId: 'sdd',
    });

    expect(handleWorkflow).toHaveBeenCalledTimes(1);
    expect(result.action).toEqual(
      expect.objectContaining({
        actionId: 'resume_loop',
        workflowRunId: 'wf-sdd-001',
        command: '/workflow resume wf-sdd-001 spec',
      }),
    );
  });
});
