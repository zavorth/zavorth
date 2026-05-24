import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApprovalDecisionCacheService } from '../../src/services/ApprovalDecisionCacheService';

describe('ApprovalDecisionCacheService', () => {
  it('caches bounded non-destructive approval signatures and supports revocation', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-approval-cache-'));
    const filePath = path.join(root, 'approval-cache.json');
    const service = new ApprovalDecisionCacheService({ filePath });
    const input = {
      domain: 'trust' as const,
      actionId: 'set-skill-default',
      approvalScope: 'session' as const,
      riskLevel: 'medium' as const,
      payload: { defaultPolicy: 'deny' },
    };

    const entry = service.remember(input, null, 'test approval');

    expect(entry).toBeTruthy();
    expect(service.find(input)?.signature).toBe(entry!.signature);
    expect(service.revoke(entry!.id)).toBe(true);
    expect(service.find(input)).toBeNull();
  });

  it('does not cache destructive actions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-approval-cache-'));
    const service = new ApprovalDecisionCacheService({ filePath: path.join(root, 'approval-cache.json') });

    const entry = service.remember({
      domain: 'workspace',
      actionId: 'delete-file',
      approvalScope: 'session',
      riskLevel: 'medium',
      payload: { path: 'src/index.ts' },
    }, null, 'never cache');

    expect(entry).toBeNull();
  });
});
