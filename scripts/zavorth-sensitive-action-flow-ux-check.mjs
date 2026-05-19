import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = {
  contract: 'src/contracts/ZavorthSensitiveActionFlowUxContract.ts',
  service: 'src/services/ZavorthSensitiveActionFlowUxService.ts',
  script: 'scripts/zavorth-sensitive-action-flow-ux.ts',
  route: 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
  panel: 'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterOperationsPanel.tsx',
  test: 'tests/services/ZavorthSensitiveActionFlowUxService.test.ts',
};

const rules = [];

for (const [id, file] of Object.entries(files)) {
  rules.push({
    id: `file:${id}`,
    status: existsSync(file) ? 'passed' : 'failed',
    summary: file,
  });
}

const route = existsSync(files.route) ? readFileSync(files.route, 'utf8') : '';
const panel = existsSync(files.panel) ? readFileSync(files.panel, 'utf8') : '';
const contract = existsSync(files.contract) ? readFileSync(files.contract, 'utf8') : '';
const service = existsSync(files.service) ? readFileSync(files.service, 'utf8') : '';
const packageJson = existsSync('package.json') ? readFileSync('package.json', 'utf8') : '';

rules.push(
  {
    id: 'route:projection',
    status: route.includes('sensitiveActionFlowUx') && route.includes('/api/sensitive-action-flow') ? 'passed' : 'failed',
    summary: 'Web runtime exposes sensitive action UX as projection-only API and Command Center state.',
  },
  {
    id: 'panel:card',
    status: panel.includes('CommandCenterSensitiveActionFlowPanel') && panel.includes('onDraftCommand') && !panel.includes('fetch(') ? 'passed' : 'failed',
    summary: 'Command Center renders the sensitive flow as action-card drafts, not direct execution.',
  },
  {
    id: 'contract:safety',
    status: contract.includes('commandCenterCanExecute: false') && contract.includes('rawSecretsSerialized: false') ? 'passed' : 'failed',
    summary: 'Contract preserves projection-only and no raw secret serialization invariants.',
  },
  {
    id: 'service:actions',
    status: service.includes('Allow once') && service.includes('Deny') && service.includes('Inspect receipt') ? 'passed' : 'failed',
    summary: 'Service builds approve, deny, preview and receipt actions.',
  },
  {
    id: 'workspace:gate',
    status: packageJson.includes('zavorth:sensitive-action-flow-ux:check') && packageJson.includes('qa:zavorth-sensitive-action-flow-ux') ? 'passed' : 'failed',
    summary: 'Package scripts expose the Intent model5 certification gate.',
  },
);

const smoke = runJson([
  '--request=edit 2 files and run npm test with OPENAI_API_KEY=sk-test',
  '--json',
]);

rules.push(
  {
    id: 'smoke:needs-approval',
    status: smoke?.card?.approval?.required === true && smoke?.card?.execution?.executed === false ? 'passed' : 'failed',
    summary: 'Mutable request becomes approval-gated projection without execution.',
  },
  {
    id: 'smoke:no-raw-secret',
    status: JSON.stringify(smoke || {}).includes('sk-test') ? 'failed' : 'passed',
    summary: 'Raw secret-like content is not serialized in the UX snapshot.',
  },
  {
    id: 'smoke:no-dashboard-authority',
    status: smoke?.card?.safety?.commandCenterCanExecute === false && smoke?.commandCenterProjection?.executionAuthority === false ? 'passed' : 'failed',
    summary: 'Dashboard can render and draft commands, but has no execution authority.',
  },
);

const failed = rules.filter((rule) => rule.status !== 'passed');

console.log('[sensitive-action-flow-ux] certification');
for (const rule of rules) {
  console.log(`[sensitive-action-flow-ux] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
}

if (failed.length > 0) {
  console.error(`[sensitive-action-flow-ux] failed rules: ${failed.map((rule) => rule.id).join(', ')}`);
  process.exit(1);
}

function runJson(extraArgs) {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-sensitive-action-flow-ux.ts', ...extraArgs]
    : ['tsx', 'scripts/zavorth-sensitive-action-flow-ux.ts', ...extraArgs];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    return null;
  }
  return JSON.parse(result.stdout);
}
