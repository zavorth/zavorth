import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthMutationPlaneService } from '../../src/services/ZavorthMutationPlaneService.js';

describe('ZavorthMutationPlaneService', () => {
  it('persists redacted mutation plans and advances approval/apply state', () => {
    const plansDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mutation-plane-'));
    try {
      const service = new ZavorthMutationPlaneService({
        plansDir,
        now: () => new Date('2026-04-12T10:00:00.000Z'),
      });

      const plan = service.createPlan({
        domain: 'watch',
        actionId: 'allow-site',
        title: 'Allow site',
        summary: 'Liberar site no Watch Mode.',
        requestedBy: 'tester',
        approvalRequired: true,
        payload: {
          site: 'example.com',
          apiToken: 'secret-value',
        },
      });

      expect(plan.status).toBe('waiting_approval');
      expect(plan.payload.apiToken).toBe('***');
      expect(service.readPlan(plan.id)?.id).toBe(plan.id);

      const withApproval = service.attachApproval(plan.id, {
        permissionId: 'perm-1',
        status: 'pending',
      });
      expect(withApproval.approval.permissionId).toBe('perm-1');

      const approved = service.approvePlan(plan.id, {
        permissionId: 'perm-1',
        approvedBy: 'owner',
        scope: 'host',
      });
      expect(approved.status).toBe('approved');
      expect(approved.approval.defaultScope).toBe('host');

      const applied = service.markApplied(plan.id, 'Aplicado.', ['allow-site']);
      expect(applied.status).toBe('applied');
      expect(applied.audit.some((entry) => entry.event === 'plan.applied')).toBe(true);
    } finally {
      fs.rmSync(plansDir, { recursive: true, force: true });
    }
  });
});
