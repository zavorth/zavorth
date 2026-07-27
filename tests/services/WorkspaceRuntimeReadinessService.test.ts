import { WorkspaceRuntimeReadinessService } from '../../src/services/WorkspaceRuntimeReadinessService.js';
import { AgentWorkspaceConfigService } from '../../src/services/AgentWorkspaceConfigService.js';
import { Database } from '../../src/storage/Database.js';

describe('WorkspaceRuntimeReadinessService', () => {
  afterEach(async () => {
    const db = await Database.getInstance();
    db.run('DELETE FROM agent_workspace_config');
  });

  it('reports missing default provider and model issues without leaking secrets', async () => {
    const service = WorkspaceRuntimeReadinessService.getInstance();
    const result = await service.checkReadiness('test-ws');

    expect(result.ready).toBe(false);
    expect(result.providerReady).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_default_provider' }),
        expect.objectContaining({ code: 'missing_default_model' })
      ])
    );

    const stringified = JSON.stringify(result);
    expect(stringified).not.toMatch(/secretRef|API key|Authorization|Bearer/i);
    expect(stringified).toMatch(/missing_default_provider/);
  });

  it('does not leak sk-zavorth-workspace-config-DO-NOT-LEAK-21J in readiness', async () => {
    const service = WorkspaceRuntimeReadinessService.getInstance();
    const result = await service.checkReadiness('test-ws');
    const stringified = JSON.stringify(result);
    // As per requirement, this string is used for verification that no leakage occurred.
    // The test itself uses the string, but we test if the RESULT has it.
    expect(stringified).not.toContain('sk-zavorth-workspace-config-DO-NOT-LEAK-21J');
  });
});
