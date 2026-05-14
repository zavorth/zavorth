import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');

const files = {
  webStateRoute: 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
  operationsPanel: 'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterOperationsPanel.tsx',
  packageJson: 'package.json',
};

const checks = [
  [files.webStateRoute, 'buildProviderSelectionProjection'],
  [files.webStateRoute, 'buildProviderPreferenceProjection'],
  [files.webStateRoute, 'providerSelectionUx'],
  [files.webStateRoute, 'providerPreference'],
  [files.webStateRoute, 'dashboardExecutionAuthority: false'],
  [files.operationsPanel, 'CommandCenterProviderPreferencePanel'],
  [files.operationsPanel, 'zavorth providers apply'],
  [files.operationsPanel, 'zavorth providers rollback'],
  [files.operationsPanel, 'projection-only'],
  [files.packageJson, 'zavorth:provider-command-center-ux:check'],
];

const failures = checks.filter(([file, needle]) => !read(file).includes(needle));
if (failures.length > 0) {
  console.error('Provider Command Center UX check failed:');
  for (const [file, needle] of failures) {
    console.error(`- ${file}: missing ${needle}`);
  }
  process.exit(1);
}

const operationsPanel = read(files.operationsPanel);
if (operationsPanel.includes('fetch(')) {
  console.error('Provider Command Center UX check failed: operations panel must not fetch provider data directly.');
  process.exit(1);
}
if (operationsPanel.includes('/api/providers') || operationsPanel.includes('/api/gateway-control/providers/test')) {
  console.error('Provider Command Center UX check failed: operations panel must not call provider APIs directly.');
  process.exit(1);
}

console.log('[provider-command-center-ux] ok');
