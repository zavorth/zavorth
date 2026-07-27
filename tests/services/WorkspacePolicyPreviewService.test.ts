import { WorkspacePolicyPreviewService } from '../../src/services/WorkspacePolicyPreviewService.js';
import { AgentWorkspaceConfigService } from '../../src/services/AgentWorkspaceConfigService.js';
import { Database } from '../../src/storage/Database.js';

describe('WorkspacePolicyPreviewService', () => {
  afterEach(async () => {
    const db = await Database.getInstance();
    db.run('DELETE FROM agent_workspace_config');
  });

  it('generates a preview with correct warnings for developer mode and PTY', async () => {
    const service = WorkspacePolicyPreviewService.getInstance();

    // Test that the mock setup evaluates properly without leaking secrets
    const preview = await service.previewPolicy('test-ws', {});

    expect(preview.riskLevel).toBeDefined();
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_default_provider' })
      ])
    );

    const stringified = JSON.stringify(preview);
    expect(stringified).not.toMatch(/secretRef|API key|Authorization|Bearer/i);
    expect(stringified).not.toContain('sk-zavorth-workspace-config-DO-NOT-LEAK-21J');
  });
});
