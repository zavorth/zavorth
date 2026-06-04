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
  'apps/zavorth-control-vite-shell/index.html',
  'apps/zavorth-control-vite-shell/src/pages.ts',
  'apps/zavorth-control-vite-shell/public/styles/chat.css',
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
if (snapshot.route !== '/control') {
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
for (const command of ['zavorth setup --dry-run', 'zavorth go', 'zavorth demo browser', 'zavorth connectors doctor']) {
  if (!snapshot.gettingStarted.steps.some((entry) => entry.command === command)) {
    throw new Error(`getting started command missing: ${command}`);
  }
}
if (snapshot.permissionPanel?.title !== 'Permissoes') {
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
  readFileSync(path.join(root, 'apps/zavorth-control-vite-shell/index.html'), 'utf8'),
  readFileSync(path.join(root, 'apps/zavorth-control-vite-shell/src/pages.ts'), 'utf8'),
  readFileSync(path.join(root, 'apps/zavorth-control-vite-shell/public/styles/chat.css'), 'utf8'),
].join('\n');
for (const marker of [
  'chat-console-bar',
  'Check memory',
  'Zavorth Home',
  'Zavorth memory',
  'Receipts',
  'Connectors',
  'runtime adapter control',
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
