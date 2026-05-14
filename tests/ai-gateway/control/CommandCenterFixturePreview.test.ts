import { readFileSync } from 'fs';
import { join } from 'path';
import {
  COMMAND_CENTER_FIXTURE_PREVIEW_QUERY_PARAM,
  buildDashboardCommandCenterFixturePreviewViewModel,
  listDashboardCommandCenterFixturePreviewOptions,
  resolveDashboardCommandCenterFixturePreviewId,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/preview/commandCenterFixturePreview.js';
import {
  DASHBOARD_COMMAND_CENTER_FIXTURE_IDS,
  type DashboardCommandCenterFixtureId,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/fixtures/dashboardCommandCenterFixtures.js';

const rootDir = process.cwd();
const commandCenterDir = join(
  rootDir,
  'src/ai-gateway/app/(dashboard)/control/command-center',
);

describe('CommandCenterFixturePreview', () => {
  it('uses an explicit query param for visual contract preview', () => {
    expect(COMMAND_CENTER_FIXTURE_PREVIEW_QUERY_PARAM).toBe('fixture');
    expect(resolveDashboardCommandCenterFixturePreviewId('awaiting-approval')).toBe('awaiting-approval');
    expect(resolveDashboardCommandCenterFixturePreviewId('fake-dashboard')).toBeNull();
  });

  it('lists every official fixture as a selectable preview option', () => {
    const options = listDashboardCommandCenterFixturePreviewOptions();

    expect(options.map((option) => option.id)).toEqual(DASHBOARD_COMMAND_CENTER_FIXTURE_IDS);
    expect(options.every((option) => option.label && option.description)).toBe(true);
  });

  it('builds renderable preview view models without changing the contract version', () => {
    DASHBOARD_COMMAND_CENTER_FIXTURE_IDS.forEach((fixtureId: DashboardCommandCenterFixtureId) => {
      const viewModel = buildDashboardCommandCenterFixturePreviewViewModel(fixtureId);

      expect(viewModel.contractVersion).toBe('command-center-runtime-contract/v1');
      expect(viewModel.adapterSource.label).toBe('Command Center Contract Preview');
      expect(viewModel.adapterSource.notes).toContain('Fixture oficial');
      expect(viewModel.logs[0]).toEqual(expect.objectContaining({
        source: 'command-center-preview',
      }));
      expect(viewModel.counts.logs).toBe(viewModel.logs.length);
    });
  });

  it('includes the Remote Mesh MCP approval fixture for the real button preview', () => {
    const viewModel = buildDashboardCommandCenterFixturePreviewViewModel('remote-mesh-mcp-approval');

    expect(viewModel.remoteMeshApprovalUx?.cards[0]).toEqual(expect.objectContaining({
      surface: 'command-center',
      title: 'Approve Docker restart',
    }));
    expect(viewModel.remoteMeshApprovalUx?.cards[0]?.commandCenter.primaryActionLabel).toBe('Aplicar no MCP');
    expect(viewModel.remoteMeshApprovalUx?.commands.commandCenterProxyPath).toBe('/api/web/remote-mesh/notebook/mcp');
  });

  it('exposes the authorized web route that applies Remote Mesh approvals through the server proxy', () => {
    const runtimeRoutes = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts'),
      'utf8',
    );

    expect(runtimeRoutes).toContain('/api/web/remote-mesh/notebook/mcp');
    expect(runtimeRoutes).toContain('RemoteMeshNotebookMcpProxyService.fromEnv().apply');
  });

  it('keeps fixture preview out of the real Command Center shell', () => {
    const shell = readFileSync(
      join(commandCenterDir, 'components/CommandCenterControlShell.tsx'),
      'utf8',
    );
    const operationsPanel = readFileSync(
      join(commandCenterDir, 'components/CommandCenterOperationsPanel.tsx'),
      'utf8',
    );
    const stylesheet = readFileSync(
      join(commandCenterDir, 'styles/commandCenter.css'),
      'utf8',
    );

    expect(shell).not.toContain('CommandCenterFixturePreviewBar');
    expect(shell).not.toContain('buildDashboardCommandCenterFixturePreviewViewModel');
    expect(shell).not.toContain('COMMAND_CENTER_FIXTURE_PREVIEW_QUERY_PARAM');
    expect(shell).toContain('COMMAND_CENTER_BLOCKED_FIXTURE_QUERY_PARAM');
    expect(operationsPanel).toContain('previewMode');
    expect(operationsPanel).toContain('viewModel.approvals');
    expect(stylesheet).toContain('.bcc-fixture-preview');
  });
});
