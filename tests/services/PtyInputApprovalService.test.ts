import { PtyInputApprovalService } from '../../src/services/PtyInputApprovalService';
import { Database } from '../../src/storage/Database';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger';
import { LogRepository } from '../../src/storage/LogRepository';

describe('PtyInputApprovalService', () => {
  let db: Database;
  let service: PtyInputApprovalService;

  beforeAll(async () => {
    db = await Database.getInstance();
    const logger = new SecurityAuditLogger(new LogRepository());
    service = new PtyInputApprovalService(db, logger);
  });

  it('proposes HIGH input and consumes it after approval', async () => {
    const proposal = await service.proposeInput('ws1', 's1', 'npm test', 'npm test', 'HIGH', false);
    
    // Attempt to consume before approval should fail
    const isConsumedFirst = await service.consumeApprovedInputHash('ws1', 's1', 'npm test');
    expect(isConsumedFirst).toBe(false);

    await service.resolveProposal('ws1', proposal.operationId, true);
    
    // Now it should consume successfully
    const isConsumedSecond = await service.consumeApprovedInputHash('ws1', 's1', 'npm test');
    expect(isConsumedSecond).toBe(true);
    
    // Replay should fail
    const isConsumedThird = await service.consumeApprovedInputHash('ws1', 's1', 'npm test');
    expect(isConsumedThird).toBe(false);
  });

  it('proposes CRITICAL input and requires RUN phrase', async () => {
    const proposal = await service.proposeInput('ws1', 's1', 'rm -rf /', 'rm -rf /', 'CRITICAL', true);
    
    // Wrong phrase
    await expect(service.resolveProposal('ws1', proposal.operationId, true, 'WRONG')).rejects.toThrow(/Strong confirmation failed/);
    
    // Correct phrase
    await expect(service.resolveProposal('ws1', proposal.operationId, true, 'RUN')).resolves.not.toThrow();
  });
});
