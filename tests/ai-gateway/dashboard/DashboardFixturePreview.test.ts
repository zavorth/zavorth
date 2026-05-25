import { readFileSync } from 'fs';
import { join } from 'path';
import {
  COMMAND_CENTER_FIXTURE_PREVIEW_QUERY_PARAM,
  buildDashboardDashboardFixturePreviewViewModel,
  listDashboardDashboardFixturePreviewOptions,
  resolveDashboardDashboardFixturePreviewId,
} from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/preview/dashboardFixturePreview.js';
import {
  DASHBOARD_COMMAND_CENTER_FIXTURE_IDS,
  type DashboardDashboardFixtureId,
} from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/fixtures/dashboardDashboardFixtures.js';

const rootDir = process.cwd();
const dashboardDir = join(
  rootDir,
  'src/ai-gateway/app/(dashboard)/dashboard/dashboard',
);

describe('DashboardFixturePreview', () => {
  it('uses an explicit query param for visual contract preview', () => {
    expect(COMMAND_CENTER_FIXTURE_PREVIEW_QUERY_PARAM).toBe('fixture');
    expect(resolveDashboardDashboardFixturePreviewId('awaiting-approval')).toBe('awaiting-approval');
    expect(resolveDashboardDashboardFixturePreviewId('fake-dashboard')).toBeNull();
  });

  it('lists every official fixture as a selectable preview option', () => {
    const options = listDashboardDashboardFixturePreviewOptions();

    expect(options.map((option) => option.id)).toEqual(DASHBOARD_COMMAND_CENTER_FIXTURE_IDS);
    expect(options.every((option) => option.label && option.description)).toBe(true);
  });

  it('builds renderable preview view models without changing the contract version', () => {
    DASHBOARD_COMMAND_CENTER_FIXTURE_IDS.forEach((fixtureId: DashboardDashboardFixtureId) => {
      const viewModel = buildDashboardDashboardFixturePreviewViewModel(fixtureId);

      expect(viewModel.contractVersion).toBe('dashboard-runtime-contract/v1');
      expect(viewModel.adapterSource.label).toBe('Dashboard Contract Preview');
      expect(viewModel.adapterSource.notes).toContain('Fixture oficial');
      expect(viewModel.logs[0]).toEqual(expect.objectContaining({
        source: 'dashboard-preview',
      }));
      expect(viewModel.counts.logs).toBe(viewModel.logs.length);
    });
  });

  it('includes the Remote Mesh MCP approval fixture for the real button preview', () => {
    const viewModel = buildDashboardDashboardFixturePreviewViewModel('remote-mesh-mcp-approval');

    expect(viewModel.remoteMeshApprovalUx?.cards[0]).toEqual(expect.objectContaining({
      surface: 'dashboard',
      title: 'Approve Docker restart',
    }));
    expect(viewModel.remoteMeshApprovalUx?.cards[0]?.dashboard.primaryActionLabel).toBe('Aplicar no MCP');
    expect(viewModel.remoteMeshApprovalUx?.commands.dashboardProxyPath).toBe('/api/web/remote-mesh/notebook/mcp');
  });

  it('exposes the authorized web route that applies Remote Mesh approvals through the server proxy', () => {
    const runtimeRoutes = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts'),
      'utf8',
    );

    expect(runtimeRoutes).toContain('/api/web/remote-mesh/notebook/mcp');
    expect(runtimeRoutes).toContain('RemoteMeshNotebookMcpProxyService.fromEnv().apply');
  });

  it('keeps fixture preview out of the real Dashboard shell', () => {
    const shell = readFileSync(
      join(dashboardDir, 'components/DashboardControlShell.tsx'),
      'utf8',
    );
    const operationsPanel = readFileSync(
      join(dashboardDir, 'components/DashboardOperationsPanel.tsx'),
      'utf8',
    );
    const stylesheet = readFileSync(
      join(dashboardDir, 'styles/dashboard.css'),
      'utf8',
    );

    expect(shell).not.toContain('DashboardFixturePreviewBar');
    expect(shell).not.toContain('buildDashboardDashboardFixturePreviewViewModel');
    expect(shell).not.toContain('COMMAND_CENTER_FIXTURE_PREVIEW_QUERY_PARAM');
    expect(shell).toContain('COMMAND_CENTER_BLOCKED_FIXTURE_QUERY_PARAM');
    expect(operationsPanel).toContain('previewMode');
    expect(operationsPanel).toContain('viewModel.approvals');
    expect(stylesheet).toContain('.bcc-fixture-preview');
  });
});
