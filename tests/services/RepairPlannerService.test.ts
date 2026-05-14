import { RepairPlannerService } from '../../src/services/RepairPlannerService.js';

describe('RepairPlannerService', () => {
  it('plans dependency installation when a module is missing', () => {
    const service = new RepairPlannerService();
    const proposal = service.planFromFailure({
      stderr: "Error: Cannot find module 'express'",
      command: 'npm run build',
    });

    expect(proposal.kind).toBe('install_dependency');
    expect(proposal.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'install_dependency' }),
      expect.objectContaining({ kind: 'rerun_step' }),
    ]));
  });

  it('plans a patch-oriented repair for TypeScript errors', () => {
    const service = new RepairPlannerService();
    const proposal = service.planFromFailure({
      stderr: 'error TS2304: Cannot find name x.',
      command: 'npm run build',
    });

    expect(proposal.kind).toBe('propose_patch');
    expect(proposal.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'inspect_fs' }),
      expect.objectContaining({ kind: 'propose_patch' }),
      expect.objectContaining({ kind: 'rerun_step' }),
    ]));
  });
});
