import { ZavorthAgentOperatingSystemService } from '../../src/services/ZavorthAgentOperatingSystemService';

describe('ZavorthAgentOperatingSystemService', () => {
  it('builds a limited agent OS snapshot from the team catalog', () => {
    const service = new ZavorthAgentOperatingSystemService({
      now: () => new Date('2026-04-03T18:00:00.000Z'),
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-03T17:59:00.000Z',
          summary: {
            total: 2,
            active: 1,
            resumable: 1,
            completedRecently: 1,
            executors: ['codex', 'external_executor'],
          },
          teams: [
            {
              id: 'sdd',
              label: 'SDD Loop Team',
              entryCommand: '/workflow sdd <feature-id>',
              status: 'resumable',
              members: [{}, {}, {}, {}],
              runStats: {
                active: 0,
                resumable: 1,
              },
              latestRun: {
                workflowRunId: 'wf-sdd-1',
                resumeStageLabel: 'Execution Agent',
                resumeAvailable: true,
              },
            },
            {
              id: 'ship',
              label: 'Ship Team',
              entryCommand: '/workflow ship <objetivo>',
              status: 'active',
              members: [{}, {}],
              runStats: {
                active: 1,
                resumable: 0,
              },
              latestRun: {
                workflowRunId: 'wf-ship-1',
                resumeStageLabel: null,
                resumeAvailable: false,
              },
            },
          ],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot).toEqual(
      expect.objectContaining({
        generatedAt: '2026-04-03T18:00:00.000Z',
        kernel: expect.objectContaining({
          label: 'Limited Agent OS',
        }),
        summary: expect.objectContaining({
          roles: 4,
          loops: 2,
          activeLoops: 1,
          resumableLoops: 1,
          sddLoopReady: true,
        }),
        roles: expect.arrayContaining([
          expect.objectContaining({ id: 'spec', executor: 'codex' }),
          expect.objectContaining({ id: 'review', executor: 'external_executor' }),
        ]),
        loops: expect.arrayContaining([
          expect.objectContaining({
            id: 'sdd',
            status: 'resumable',
            actions: expect.arrayContaining([
              expect.objectContaining({ id: 'start_loop', requiresInput: true }),
              expect.objectContaining({ id: 'resume_loop', requiresInput: false }),
            ]),
          }),
          expect.objectContaining({
            id: 'ship',
            status: 'active',
            actions: expect.arrayContaining([
              expect.objectContaining({ id: 'start_loop', requiresInput: true }),
            ]),
          }),
        ]),
      }),
    );
  });
});
