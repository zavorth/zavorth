import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');

const files = {
  contract: 'src/contracts/ZavorthVisualReceiptUxContract.ts',
  service: 'src/services/ZavorthVisualReceiptUxService.ts',
  webStateRoute: 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
  operationsPanel: 'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlOperationsPanel.tsx',
  script: 'scripts/zavorth-visual-receipts-ux.ts',
  test: 'tests/services/ZavorthVisualReceiptUxService.test.ts',
  packageJson: 'package.json',
};

const checks = [
  [files.contract, "surface: 'visual-receipt-ux'"],
  [files.contract, 'zavorthControlCanExecute: false'],
  [files.service, 'rawSecretsSerialized: false'],
  [files.service, 'zavorthControlCanExecute: false'],
  [files.service, 'sanitizeReceiptText'],
  [files.webStateRoute, 'buildVisualReceiptsProjection'],
  [files.webStateRoute, 'visualReceipts'],
  [files.operationsPanel, 'ZavorthControlVisualReceiptsPanel'],
  [files.operationsPanel, 'projection-only'],
  [files.operationsPanel, 'onDraftCommand(asText(action.command'],
  [files.script, 'ZavorthVisualReceiptUxService'],
  [files.test, '[REDACTED_SECRET]'],
  [files.packageJson, 'zavorth:visual-receipts:check'],
];

const failures = checks.filter(([file, needle]) => !read(file).includes(needle));
if (failures.length > 0) {
  console.error('Visual receipts UX check failed:');
  for (const [file, needle] of failures) {
    console.error(`- ${file}: missing ${needle}`);
  }
  process.exit(1);
}

const operationsPanel = read(files.operationsPanel);
if (operationsPanel.includes('fetch(')) {
  console.error('Visual receipts UX check failed: operations panel must not fetch receipt data directly.');
  process.exit(1);
}

const output = execFileSync(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-visual-receipts-ux.ts', '--json'],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
const parsed = JSON.parse(output);
if (parsed.surface !== 'visual-receipt-ux') {
  throw new Error('visual receipts script did not return the expected surface');
}
if (parsed.zavorthControlProjection?.executionAuthority !== false || parsed.summary?.rawSecretsSerialized !== false) {
  throw new Error('visual receipts safety invariants failed');
}
if (/\bsk-[A-Za-z0-9_-]{12,}\b/.test(output)) {
  throw new Error('visual receipts output appears to contain a raw secret');
}

console.log('[visual-receipts-ux] ok');
