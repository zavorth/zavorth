import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = {
  contract: 'src/contracts/ZavorthActiveMissionUxContract.ts',
  service: 'src/services/ZavorthActiveMissionUxService.ts',
  script: 'scripts/zavorth-active-mission-ux.ts',
  route: 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
  panel: 'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlOperationsPanel.tsx',
  test: 'tests/services/ZavorthActiveMissionUxService.test.ts',
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
const packageJson = existsSync('package.json') ? readFileSync('package.json', 'utf8') : '';

rules.push(
  {
    id: 'route:projection',
    status: route.includes('activeMissionUx') && route.includes('/api/active-mission') ? 'passed' : 'failed',
    summary: 'Web runtime publishes active mission UX projection.',
  },
  {
    id: 'panel:timeline',
    status: panel.includes('ZavorthControlActiveMissionPanel') && panel.includes('activeMissionUx') && !panel.includes('fetch(') ? 'passed' : 'failed',
    summary: 'ZavorthControl renders active mission timeline without direct fetch/execution.',
  },
  {
    id: 'contract:safety',
    status: contract.includes('zavorthControlCanExecute: false') && contract.includes('rawSecretsSerialized: false') ? 'passed' : 'failed',
    summary: 'Contract keeps mission timeline projection-only and secret-safe.',
  },
  {
    id: 'workspace:gate',
    status: packageJson.includes('zavorth:active-mission-ux:check') && packageJson.includes('qa:zavorth-active-mission-ux') ? 'passed' : 'failed',
    summary: 'Package scripts expose active mission UX gate.',
  },
);

const smoke = runJson([
  '--running',
  '--request=edit files and run npm test with OPENAI_API_KEY=sk-test',
  '--json',
]);

rules.push(
  {
    id: 'smoke:timeline',
    status: Array.isArray(smoke?.timeline) && smoke.timeline.length >= 4 ? 'passed' : 'failed',
    summary: 'Active mission snapshot combines run, sensitive flow, receipt and provider timeline.',
  },
  {
    id: 'smoke:approval',
    status: smoke?.status === 'needs_approval' && smoke?.counts?.approvalsPending >= 1 ? 'passed' : 'failed',
    summary: 'Mutable mission surfaces approval pending state.',
  },
  {
    id: 'smoke:no-execution-authority',
    status: smoke?.safety?.zavorthControlCanExecute === false && smoke?.zavorthControlProjection?.executionAuthority === false ? 'passed' : 'failed',
    summary: 'ZavorthControl has no active mission execution authority.',
  },
  {
    id: 'smoke:no-raw-secret',
    status: JSON.stringify(smoke || {}).includes('sk-test') ? 'failed' : 'passed',
    summary: 'Mission UX does not serialize raw secret-like values.',
  },
);

const failed = rules.filter((rule) => rule.status !== 'passed');

console.log('[active-mission-ux] certification');
for (const rule of rules) {
  console.log(`[active-mission-ux] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
}

if (failed.length > 0) {
  console.error(`[active-mission-ux] failed rules: ${failed.map((rule) => rule.id).join(', ')}`);
  process.exit(1);
}

function runJson(extraArgs) {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-active-mission-ux.ts', ...extraArgs]
    : ['tsx', 'scripts/zavorth-active-mission-ux.ts', ...extraArgs];
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
