import { PtyInputPolicyService } from '../../src/services/PtyInputPolicyService';
import { WorkspaceTaskMandateService } from '../../src/services/WorkspaceTaskMandateService';
import { Database } from '../../src/storage/Database';

describe('PtyInputPolicyService', () => {
  let service: PtyInputPolicyService;

  beforeAll(async () => {
    const db = await Database.getInstance();
    const mandateService = new WorkspaceTaskMandateService(db);
    service = new PtyInputPolicyService(mandateService);
  });

  it('blocks dangerous inputs like rm -rf /', () => {
    const result = service.classifyInput('ws1', 'rm -rf /', true, '.');
    expect(result.blocked).toBe(true);
    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.strongConfirmationRequired).toBe(true);
  });

  it('flags npm install as HIGH risk', () => {
    const result = service.classifyInput('ws1', 'npm install express', true, '.');
    expect(result.riskLevel).toBe('HIGH');
  });
});
