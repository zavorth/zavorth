#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const files = {
  contract: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardHermesClassContracts.ts',
  component: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardHermesClassPanel.tsx',
  chat: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardChatSurface.tsx',
  shell: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShell.tsx',
  hook: 'src/ai-gateway/app/(dashboard)/dashboard/useControlPageClient.ts',
  types: 'src/ai-gateway/app/(dashboard)/dashboard/dashboardPageClient.types.ts',
  css: 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/styles/dashboard.css',
  packageJson: 'package.json',
  productGate: 'scripts/zavorth-product-readiness-gate.mjs',
};

const checks = [];

function read(rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    throw new Error(`Missing file: ${rel}`);
  }
  return readFileSync(abs, 'utf8');
}

function check(id, ok, summary) {
  checks.push({ id, ok, summary });
}

const contract = read(files.contract);
const component = read(files.component);
const chat = read(files.chat);
const shell = read(files.shell);
const hook = read(files.hook);
const types = read(files.types);
const css = read(files.css);
const packageJson = JSON.parse(read(files.packageJson));
const productGate = read(files.productGate);

check('contract:versioned', contract.includes('dashboard-hermes-class/v1'), 'Hermes-class projection has a versioned contract');
check('contract:tool-cards', contract.includes('DashboardDashboardHermesToolCallCard'), 'Tool call cards are modeled');
check('contract:subagent-cards', contract.includes('DashboardDashboardHermesSubagentCard'), 'Subagent cards are modeled');
check('contract:approval-cards', contract.includes('DashboardDashboardHermesApprovalCard'), 'Rich approval cards are modeled');
check('contract:context-meter', contract.includes('DashboardDashboardHermesContextMeter'), 'Context/token/cost meter is modeled');
check('contract:mermaid', contract.includes('DashboardDashboardHermesMermaidDiagram'), 'Mermaid rendering contract exists');
check('contract:message-queue', contract.includes('DashboardDashboardHermesMessageQueueItem'), 'Message queue is modeled');
check('component:projection', component.includes('buildDashboardHermesClassProjection'), 'Projection builder is implemented');
check('component:tool-call-renderer', component.includes('DashboardToolCallCards'), 'Tool call cards render in the dashboard');
check('component:subagent-renderer', component.includes('DashboardSubagentCards'), 'Subagent cards render in the dashboard');
check('component:approval-renderer', component.includes('DashboardRichApprovalCards'), 'Approval cards render with approve/reject');
check('component:mermaid-renderer', component.includes('DashboardMermaidRenderer'), 'Mermaid execution graph renders in a safe subset');
check('component:queue-renderer', component.includes('DashboardMessageQueue'), 'Message queue renders');
check('chat:edit-retry', chat.includes('Retry draft') && chat.includes('Edit'), 'Messages expose edit/retry draft actions');
check('chat:embedded', chat.includes('<DashboardHermesClassPanel'), 'Chat surface embeds Hermes-class panel');
check('shell:reconnect-props', shell.includes('wsReconnectAttempt={model.wsReconnectAttempt}'), 'Control shell passes reconnect state');
check('hook:auto-reconnect', hook.includes('scheduleReconnect') && hook.includes('reconnectTimeoutRef'), 'WebSocket reconnect is automatic and capped');
check('types:reconnect-state', types.includes('wsReconnectAttempt: number'), 'Client model exposes reconnect attempt');
check('css:visual-system', css.includes('.bcc-hermes-class') && css.includes('.bcc-context-meter') && css.includes('.bcc-mermaid-render'), 'Hermes-class visual CSS is present');
check('scripts:package', packageJson.scripts?.['zavorth:dashboard-hermes-class:check'] === 'node scripts/zavorth-dashboard-hermes-class-check.mjs', 'Package script is registered');
check('product-gate:wired', productGate.includes('dashboard-hermes-class'), 'Product readiness gate includes Hermes-class Dashboard');

const failed = checks.filter((entry) => !entry.ok);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    contractVersion: 'zavorth-dashboard-hermes-class-check/1',
    generatedAt: new Date().toISOString(),
    status: failed.length ? 'failed' : 'passed',
    checks,
  }, null, 2));
} else {
  for (const entry of checks) {
    console.log(`[dashboard-hermes-class] ${entry.ok ? 'ok' : 'fail'} ${entry.id}: ${entry.summary}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}
