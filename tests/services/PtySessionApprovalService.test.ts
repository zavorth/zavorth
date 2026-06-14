import { PtySessionApprovalService } from '../../src/services/PtySessionApprovalService';
import { Database } from '../../src/storage/Database';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger';
import { LogRepository } from '../../src/storage/LogRepository';

describe('PtySessionApprovalService', () => {
  let db: Database;
  let service: PtySessionApprovalService;

  beforeAll(async () => {
    db = await Database.getInstance();
    const logger = new SecurityAuditLogger(new LogRepository());
    service = new PtySessionApprovalService(db, logger);
  });

  it('proposes a session successfully', async () => {
    const proposal = await service.proposeSession('ws1', 'bash', '.', 'HIGH', 'reason');
    expect(proposal.sessionId).toBeDefined();
    expect(proposal.status).toBe('pending');
  });
});
