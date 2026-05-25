import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const files = {
  contracts: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardObservabilityContracts.ts',
  adapter: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.ts',
  providerSnapshots: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapterProviderSnapshots.ts',
  runtimeProjection: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/dashboardRuntimeProjection.ts',
  gatewayProjection: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.ts',
  metadata: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShellMetadata.ts',
  operationsPanel: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardOperationsPanel.tsx',
  browserPreview: 'scripts/dashboard-browser-preview.ts',
  visualQa: 'scripts/dashboard-provider-cockpit-visual-qa.ts',
  liveSmoke: 'scripts/dashboard-provider-cockpit-live-smoke.ts',
  webStateRoute: 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
  test: 'tests/ai-gateway/dashboard/DashboardProviderCockpitVisualImplementation.test.ts',
};

const checks = [
  [files.contracts, 'DashboardProviderCockpitSnapshot'],
  [files.adapter, 'buildProviderCockpit(input)'],
  [files.providerSnapshots, 'normalRenderMakesNoNetworkCalls'],
  [files.runtimeProjection, 'providerCockpit?: DashboardProviderCockpitSnapshot | null'],
  [files.gatewayProjection, 'mapProviderCockpit(activeRun, snapshot)'],
  [files.metadata, 'providerCockpit: metadata?.providerCockpit'],
  [files.operationsPanel, 'DashboardProviderCockpitPanel'],
  [files.operationsPanel, 'onDraftCommand(liveAction.command)'],
  [files.browserPreview, 'renderProviderCockpitPanel'],
  [files.browserPreview, 'data-zavorth-provider-cockpit="ready"'],
  [files.visualQa, '01-provider-cockpit-desktop.png'],
  [files.visualQa, '02-provider-cockpit-mobile.png'],
  [files.liveSmoke, 'live-probe-blocked-from-dashboard-route'],
  [files.liveSmoke, '/api/providers/readiness'],
  [files.webStateRoute, "pathname === '/api/providers/readiness'"],
  [files.webStateRoute, 'provider_live_probe_requires_explicit_operator_cli_or_approved_api'],
  [files.test, 'dashboardCannotExecuteProviderCalls'],
];

const failures = checks.filter(([file, needle]) => !read(file).includes(needle));

if (failures.length > 0) {
  console.error('Provider cockpit visual check failed:');
  for (const [file, needle] of failures) {
    console.error(`- ${file}: missing ${needle}`);
  }
  process.exit(1);
}

if (read(files.operationsPanel).includes('fetch(')) {
  console.error('Provider cockpit visual check failed: operations panel must not fetch provider data directly.');
  process.exit(1);
}

console.log('Provider cockpit visual implementation check passed.');
