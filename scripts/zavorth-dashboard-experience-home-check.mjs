import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthControlExperienceHomeContract.ts',
  'src/services/ZavorthControlExperienceHomeService.ts',
  'scripts/zavorth-control-experience-home.ts',
  'tests/services/ZavorthControlExperienceHomeService.test.ts',
  'src/zavorth-control/app/(zavorthControl)/control/HomePageClient.tsx',
  'assets/zavorth-control/index.html',
  'assets/zavorth-control/styles/chat.css',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-control-experience-home.ts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'zavorthControl-experience-home') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.route !== '/zavorthControl') {
  throw new Error(`unexpected route ${snapshot.route}`);
}
if (snapshot.safety.zavorthControlCanExecuteTargetAction !== false) {
  throw new Error('zavorthControl home must not execute target actions');
}
if (!Array.isArray(snapshot.simpleNavigation?.areas) || snapshot.simpleNavigation.areas.length !== 5) {
  throw new Error('zavorthControl home must expose the five simple product areas');
}
if (snapshot.gettingStarted?.title !== 'Primeiros passos') {
  throw new Error('zavorthControl home must expose Primeiros passos');
}
if (!snapshot.gettingStarted.steps.some((entry) => entry.command === 'zavorth setup --dry-run')) {
  throw new Error('zavorthControl home must point first-time users to setup dry-run');
}
if (!snapshot.gettingStarted.steps.some((entry) => entry.command === 'zavorth go')) {
  throw new Error('zavorthControl home must keep go as the daily entrypoint');
}
if (!snapshot.gettingStarted.steps.some((entry) => entry.command === 'zavorth demo browser' && entry.optional === true)) {
  throw new Error('zavorthControl home must keep demo optional');
}
if (!snapshot.gettingStarted.steps.some((entry) => entry.command === 'zavorth connectors doctor')) {
  throw new Error('zavorthControl home must point first-time users to connector doctor');
}
  'Permissions',
  throw new Error('zavorthControl home must expose permission polish panel');
}
for (const item of ['permissions', 'auto-approvals', 'extreme-mode', 'revoke', 'receipts']) {
  if (!snapshot.permissionPanel.items.some((entry) => entry.id === item)) {
    throw new Error(`permission panel item missing: ${item}`);
  }
}
for (const area of ['inbox', 'tasks', 'approvals', 'receipts', 'connectors']) {
  if (!snapshot.simpleNavigation.areas.some((entry) => entry.id === area)) {
    throw new Error(`zavorthControl home area missing: ${area}`);
  }
}

const home = [
  readFileSync(path.join(root, 'src/zavorth-control/app/(zavorthControl)/control/HomePageClient.tsx'), 'utf8'),
  readFileSync(path.join(root, 'assets/zavorth-control/index.html'), 'utf8'),
  readFileSync(path.join(root, 'assets/zavorth-control/styles/chat.css'), 'utf8'),
].join('\n');
for (const marker of [
  'chat-console-bar',
  'Ask normally. Zavorth will answer, preview risky work, and ask before acting.',
  'Provider',
  'Channel',
  'Zavorth Home',
  'Primeiros passos',
  'zavorth setup --dry-run',
  'zavorth demo browser',
  'zavorth connectors doctor',
  'Receipts',
  'Connectors',
  'Permissions',
  'Auto-approvals',
  'Modo extremo',
  'Revogar',
  'home-profile-grid',
  'home-readiness-strip',
  'Organize my day',
]) {
  if (!home.includes(marker)) {
    throw new Error(`zavorthControl home marker missing: ${marker}`);
  }
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthControlExperienceHomeService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-control-experience-home-check] ok');
