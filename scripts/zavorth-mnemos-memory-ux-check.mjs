import fs from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthMnemosMemoryUxContract.ts',
  'src/services/ZavorthMnemosMemoryUxService.ts',
  'scripts/zavorth-mnemos-memory-ux.ts',
  'tests/services/ZavorthMnemosMemoryUxService.test.ts',
  'src/ai-gateway/app/(zavorthControl)/zavorthControl/HomePageClient.tsx',
  'src/telegram/TelegramCommandRoutingService.ts',
  'src/telegram/controllers/TelegramMnemosMemoryUxController.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const service = fs.existsSync(requiredFiles[1]) ? fs.readFileSync(requiredFiles[1], 'utf8') : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';
const zavorthControl = fs.existsSync(requiredFiles[4]) ? fs.readFileSync(requiredFiles[4], 'utf8') : '';
const telegram = fs.existsSync(requiredFiles[5]) ? fs.readFileSync(requiredFiles[5], 'utf8') : '';

for (const marker of [
  'zavorthControlCanWriteMemory: false',
  'cliWriteRequiresApproval: true',
  'telegramWriteRequiresApproval: true',
  'rawJsonHiddenByDefault: true',
  'Memory Health',
  'Procedural Rules',
  'Wiki Query',
  'Revocation',
]) {
  if (!service.includes(marker)) failures.push(`memory ux marker missing: ${marker}`);
}

for (const marker of ['mnemos:ux', 'mnemos:ux:check']) {
  if (!packageJson.includes(marker)) failures.push(`package script missing: ${marker}`);
}

for (const marker of ['Mnemos Memory', 'Memory Health', 'Procedural Rules', 'Wiki Query']) {
  if (!zavorthControl.includes(marker)) failures.push(`zavorthControl marker missing: ${marker}`);
}

if (!telegram.includes("case '/mnemos'")) failures.push('telegram /mnemos route missing');

if (!failures.length) {
  const output = execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npx', process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx tsx scripts/zavorth-mnemos-memory-ux.ts --json']
    : ['tsx', 'scripts/zavorth-mnemos-memory-ux.ts', '--json'], { encoding: 'utf8' });
  const snapshot = JSON.parse(output);
  if (snapshot.version !== 'zavorth-mnemos-memory-ux-v1') failures.push('unexpected memory ux version');
  if (snapshot.safety.zavorthControlCanWriteMemory !== false) failures.push('zavorthControl must remain read-only');
}

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ZavorthMnemosMemoryUxService.test.ts', 'tests/telegram/TelegramCommandRoutingService.test.ts', 'tests/telegram/controllers/TelegramMnemosMemoryUxController.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) failures.push(`jest failed with exit code ${jest.status}`);
}

if (failures.length) {
  console.error('[zavorth-mnemos-memory-ux-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-memory-ux-check] ok');
