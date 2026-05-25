import fs from 'fs';
import path from 'path';
import { getApprovals, getReceiptCards } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboardPageClient.utils';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Dashboard approval inbox and receipt UX refinement', () => {
  it('prefers Runtime API v1 approvals and receipts over legacy dashboard-only snapshots', () => {
    const state = {
      runtimeApiV1: {
        contracts: {
          approvals: {
            data: [{
              permission_id: 'approval-v1',
              status: 'pending',
              metadata: { risk: 'medium', policy: 'workspace.write.requires_approval' },
            }],
          },
          receipts: {
            cards: [{
              id: 'receipt-v1',
              status: 'recorded',
              simpleText: 'Approval decision recorded.',
            }],
          },
        },
      },
      approvalPlane: {
        pending: [{ permission_id: 'approval-legacy', status: 'pending' }],
      },
      agentRuntime: {
        visualReceipts: {
          cards: [{ id: 'receipt-legacy', simpleText: 'Legacy receipt.' }],
        },
      },
    } as any;

    expect(getApprovals(state).map((entry) => entry.permission_id)).toEqual([
      'approval-v1',
      'approval-legacy',
    ]);
    expect(getReceiptCards(state).map((entry) => entry.id)).toEqual([
      'receipt-v1',
      'receipt-legacy',
    ]);
  });

  it('renders approval and receipt language as product UX, not raw JSON only', () => {
    const sidebar = read('src/ai-gateway/app/(dashboard)/dashboard/dashboardPageClient.sidebar.tsx');
    const main = read('src/ai-gateway/app/(dashboard)/dashboard/dashboardPageClient.main.tsx');

    expect(sidebar).toContain('Approval Inbox');
    expect(sidebar).toContain('Approve once');
    expect(sidebar).toContain('Policy:');
    expect(sidebar).toContain('Approval ID:');
    expect(main).toContain('Readable evidence from governed actions');
    expect(main).toContain('Receipts will appear after approvals');
    expect(main).toContain('Rollback:');
  });
});
