import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = {
  contract: 'src/contracts/ZavorthApprovalActionCardsUxContract.ts',
  service: 'src/services/ZavorthApprovalActionCardsUxService.ts',
  script: 'scripts/zavorth-approval-action-cards-ux.ts',
  route: 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
  panel: 'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlOperationsPanel.tsx',
  test: 'tests/services/ZavorthApprovalActionCardsUxService.test.ts',
};

const rules = [];
for (const [id, file] of Object.entries(files)) {
  rules.push({ id: `file:${id}`, status: existsSync(file) ? 'passed' : 'failed', summary: file });
}

const route = existsSync(files.route) ? readFileSync(files.route, 'utf8') : '';
const panel = existsSync(files.panel) ? readFileSync(files.panel, 'utf8') : '';
const contract = existsSync(files.contract) ? readFileSync(files.contract, 'utf8') : '';
const packageJson = existsSync('package.json') ? readFileSync('package.json', 'utf8') : '';

rules.push(
  {
    id: 'route:projection',
    status: route.includes('approvalActionCardsUx') && route.includes('/api/approval-action-cards') ? 'passed' : 'failed',
    summary: 'Web runtime exposes approval action cards projection.',
  },
  {
    id: 'panel:cards',
    status: panel.includes('approvalActionCardsUx') && panel.includes('Allow once') && !panel.includes('fetch(') ? 'passed' : 'failed',
    summary: 'ZavorthControl renders approval cards without direct fetch or arbitrary execution.',
  },
  {
    id: 'contract:target-action-blocked',
    status: contract.includes('zavorthControlCanExecuteTargetAction: false') && contract.includes('approvalResolutionAuthority') ? 'passed' : 'failed',
    summary: 'Contract allows gateway-mediated approval resolution but blocks direct target action execution.',
  },
  {
    id: 'workspace:gate',
    status: packageJson.includes('zavorth:approval-action-cards-ux:check') && packageJson.includes('qa:zavorth-approval-action-cards-ux') ? 'passed' : 'failed',
    summary: 'Package scripts expose approval action cards certification gate.',
  },
);

const smoke = runJson([
  '--request=edit one file with OPENAI_API_KEY=sk-test',
  '--json',
]);

const firstCard = smoke?.cards?.[0];
rules.push(
  {
    id: 'smoke:actions',
    status: Array.isArray(firstCard?.actions)
      && ['allow_once', 'deny', 'view_preview', 'view_receipt'].every((kind) => firstCard.actions.some((action) => action.kind === kind))
      ? 'passed'
      : 'failed',
    summary: 'Approval card exposes allow once, deny, preview and receipt actions.',
  },
  {
    id: 'smoke:no-target-execute',
    status: firstCard?.actions?.every((action) => action.zavorthControlCanExecuteTargetAction === false) ? 'passed' : 'failed',
    summary: 'Approval cards cannot execute the target action directly.',
  },
  {
    id: 'smoke:no-raw-secret',
    status: JSON.stringify(smoke || {}).includes('sk-test') ? 'failed' : 'passed',
    summary: 'Approval card UX does not serialize raw secret-like values.',
  },
);

const failed = rules.filter((rule) => rule.status !== 'passed');

console.log('[approval-action-cards-ux] certification');
for (const rule of rules) {
  console.log(`[approval-action-cards-ux] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
}

if (failed.length > 0) {
  console.error(`[approval-action-cards-ux] failed rules: ${failed.map((rule) => rule.id).join(', ')}`);
  process.exit(1);
}

function runJson(extraArgs) {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-approval-action-cards-ux.ts', ...extraArgs]
    : ['tsx', 'scripts/zavorth-approval-action-cards-ux.ts', ...extraArgs];
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
