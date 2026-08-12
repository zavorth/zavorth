import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ZAVORTH_CONTROL_FIXTURE_PREVIEW_QUERY_PARAM,
  buildZavorthControlZavorthControlFixturePreviewViewModel,
  listZavorthControlZavorthControlFixturePreviewOptions,
  resolveZavorthControlZavorthControlFixturePreviewId,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/preview/zavorthControlFixturePreview.js';
import {
  ZAVORTH_CONTROL_FIXTURE_IDS,
  type ZavorthControlZavorthControlFixtureId,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/fixtures/ZavorthControlFixtures.js';

const rootDir = process.cwd();
const zavorthControlDir = join(
  rootDir,
  'src/ai-gateway/app/(zavorthControl)/control/zavorth-control',
);

describe('ZavorthControlFixturePreview', () => {
  it('uses an explicit query param for visual contract preview', () => {
    expect(ZAVORTH_CONTROL_FIXTURE_PREVIEW_QUERY_PARAM).toBe('fixture');
    expect(resolveZavorthControlZavorthControlFixturePreviewId('awaiting-approval')).toBe('awaiting-approval');
    expect(resolveZavorthControlZavorthControlFixturePreviewId('fake-zavorthControl')).toBeNull();
  });

  it('lists every official fixture as a selectable preview option', () => {
    const options = listZavorthControlZavorthControlFixturePreviewOptions();

    expect(options.map((option) => option.id)).toEqual(ZAVORTH_CONTROL_FIXTURE_IDS);
    expect(options.every((option) => option.label && option.description)).toBe(true);
  });

  it('builds renderable preview view models without changing the contract version', () => {
    ZAVORTH_CONTROL_FIXTURE_IDS.forEach((fixtureId: ZavorthControlZavorthControlFixtureId) => {
      const viewModel = buildZavorthControlZavorthControlFixturePreviewViewModel(fixtureId);

      expect(viewModel.contractVersion).toBe('zavorthControl-runtime-contract/v1');
      expect(viewModel.adapterSource.label).toBe('ZavorthControl Contract Preview');
      expect(viewModel.adapterSource.notes).toContain('Fixture oficial');
      expect(viewModel.logs[0]).toEqual(expect.objectContaining({
        source: 'zavorthControl-preview',
      }));
      expect(viewModel.counts.logs).toBe(viewModel.logs.length);
    });
  });

  it('includes the Remote Mesh MCP approval fixture for the real button preview', () => {
    const viewModel = buildZavorthControlZavorthControlFixturePreviewViewModel('remote-mesh-mcp-approval');

    expect(viewModel.remoteMeshApprovalUx?.cards[0]).toEqual(expect.objectContaining({
      surface: 'zavorthControl',
      title: 'Approve Docker restart',
    }));
    expect(viewModel.remoteMeshApprovalUx?.cards[0]?.zavorthControl.primaryActionLabel).toBe('Apply to MCP');
    expect(viewModel.remoteMeshApprovalUx?.commands.zavorthControlProxyPath).toBe('/api/web/remote-mesh/notebook/mcp');
  });

  it('exposes the authorized web route that applies Remote Mesh approvals through the server proxy', () => {
    const runtimeRoutes = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts'),
      'utf8',
    );

    expect(runtimeRoutes).toContain('/api/web/remote-mesh/notebook/mcp');
    expect(runtimeRoutes).toContain('RemoteMeshNotebookMcpProxyService.fromEnv().apply');
  });

  it('keeps fixture preview out of the real ZavorthControl shell', () => {
    const shell = readFileSync(
      join(zavorthControlDir, 'components/ZavorthControlControlShell.tsx'),
      'utf8',
    );
    const operationsPanel = readFileSync(
      join(zavorthControlDir, 'components/ZavorthControlOperationsPanel.tsx'),
      'utf8',
    );
    const stylesheet = readFileSync(
      join(zavorthControlDir, 'styles/zavorthControl.css'),
      'utf8',
    );

    expect(shell).not.toContain('ZavorthControlFixturePreviewBar');
    expect(shell).not.toContain('buildZavorthControlZavorthControlFixturePreviewViewModel');
    expect(shell).not.toContain('ZAVORTH_CONTROL_FIXTURE_PREVIEW_QUERY_PARAM');
    expect(shell).toContain('ZAVORTH_CONTROL_BLOCKED_FIXTURE_QUERY_PARAM');
    expect(operationsPanel).toContain('previewMode');
    expect(operationsPanel).toContain('viewModel.approvals');
    expect(stylesheet).toContain('.bcc-fixture-preview');
  });
});
