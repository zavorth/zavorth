#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const files = {
  contract: 'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/contracts/zavorthControlAdvancedInteractionContracts.ts',
  component: 'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlAdvancedInteractionPanel.tsx',
  chat: 'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlChatSurface.tsx',
  shell: 'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlControlShell.tsx',
  hook: 'src/ai-gateway/app/(zavorthControl)/zavorthControl/useControlPageClient.ts',
  types: 'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControlPageClient.types.ts',
  css: 'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/styles/zavorthControl.css',
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

check('contract:versioned', contract.includes('zavorth-control-advanced-interaction/v1'), 'Zavorth-native advanced projection has a versioned contract');
check('contract:tool-cards', contract.includes('ZavorthControlAdvancedInteractionToolCallCard'), 'Tool call cards are modeled');
check('contract:subagent-cards', contract.includes('ZavorthControlAdvancedInteractionSubagentCard'), 'Subagent cards are modeled');
check('contract:approval-cards', contract.includes('ZavorthControlAdvancedInteractionApprovalCard'), 'Rich approval cards are modeled');
check('contract:context-meter', contract.includes('ZavorthControlAdvancedInteractionContextMeter'), 'Context/token/cost meter is modeled');
check('contract:mermaid', contract.includes('ZavorthControlAdvancedInteractionMermaidDiagram'), 'Mermaid rendering contract exists');
check('contract:message-queue', contract.includes('ZavorthControlAdvancedInteractionMessageQueueItem'), 'Message queue is modeled');
check('component:projection', component.includes('buildZavorthControlAdvancedInteractionProjection'), 'Projection builder is implemented');
check('component:tool-call-renderer', component.includes('ZavorthControlToolCallCards'), 'Tool call cards render in the zavorthControl');
check('component:subagent-renderer', component.includes('ZavorthControlSubagentCards'), 'Subagent cards render in the zavorthControl');
check('component:approval-renderer', component.includes('ZavorthControlRichApprovalCards'), 'Approval cards render with approve/reject');
check('component:mermaid-renderer', component.includes('ZavorthControlMermaidRenderer'), 'Mermaid execution graph renders in a safe subset');
check('component:queue-renderer', component.includes('ZavorthControlMessageQueue'), 'Message queue renders');
check('chat:edit-retry', chat.includes('Retry draft') && chat.includes('Edit'), 'Messages expose edit/retry draft actions');
check('chat:embedded', chat.includes('<ZavorthControlAdvancedInteractionPanel'), 'Chat surface embeds Zavorth-native advanced panel');
check('shell:reconnect-props', shell.includes('wsReconnectAttempt={model.wsReconnectAttempt}'), 'Control shell passes reconnect state');
check('hook:auto-reconnect', hook.includes('scheduleReconnect') && hook.includes('reconnectTimeoutRef'), 'WebSocket reconnect is automatic and capped');
check('types:reconnect-state', types.includes('wsReconnectAttempt: number'), 'Client model exposes reconnect attempt');
check('css:visual-system', css.includes('.bcc-advanced-interaction') && css.includes('.bcc-context-meter') && css.includes('.bcc-mermaid-render'), 'Zavorth-native advanced visual CSS is present');
check('scripts:package', packageJson.scripts?.['zavorth:zavorth-control-advanced-interaction:check'] === 'node scripts/zavorth-control-advanced-interaction-check.mjs', 'Package script is registered');
check('product-gate:wired', productGate.includes('zavorth-control-advanced-interaction'), 'Product readiness gate includes Zavorth-native advanced ZavorthControl');

const failed = checks.filter((entry) => !entry.ok);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    contractVersion: 'zavorth-control-advanced-interaction-check/1',
    generatedAt: new Date().toISOString(),
    status: failed.length ? 'failed' : 'passed',
    checks,
  }, null, 2));
} else {
  for (const entry of checks) {
    console.log(`[zavorth-control-advanced-interaction] ${entry.ok ? 'ok' : 'fail'} ${entry.id}: ${entry.summary}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}
