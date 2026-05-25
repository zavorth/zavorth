import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthDashboardExperienceHomeContract.ts',
  'src/services/ZavorthDashboardExperienceHomeService.ts',
  'scripts/zavorth-dashboard-experience-home.ts',
  'tests/services/ZavorthDashboardExperienceHomeService.test.ts',
  'src/ai-gateway/app/(dashboard)/dashboard/HomePageClient.tsx',
  'assets/dashboard/index.html',
  'assets/dashboard/styles/chat.css',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-dashboard-experience-home.ts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'dashboard-experience-home') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.route !== '/dashboard') {
  throw new Error(`unexpected route ${snapshot.route}`);
}
if (snapshot.safety.dashboardCanExecuteTargetAction !== false) {
  throw new Error('dashboard home must not execute target actions');
}
if (!Array.isArray(snapshot.simpleNavigation?.areas) || snapshot.simpleNavigation.areas.length !== 5) {
  throw new Error('dashboard home must expose the five simple product areas');
}
if (snapshot.gettingStarted?.title !== 'Primeiros passos') {
  throw new Error('dashboard home must expose Primeiros passos');
}
if (!snapshot.gettingStarted.steps.some((entry) => entry.command === 'zavorth setup --dry-run')) {
  throw new Error('dashboard home must point first-time users to setup dry-run');
}
if (!snapshot.gettingStarted.steps.some((entry) => entry.command === 'zavorth go')) {
  throw new Error('dashboard home must keep go as the daily entrypoint');
}
if (!snapshot.gettingStarted.steps.some((entry) => entry.command === 'zavorth demo browser' && entry.optional === true)) {
  throw new Error('dashboard home must keep demo optional');
}
if (!snapshot.gettingStarted.steps.some((entry) => entry.command === 'zavorth connectors doctor')) {
  throw new Error('dashboard home must point first-time users to connector doctor');
}
if (snapshot.permissionPanel?.title !== 'Permissoes') {
  throw new Error('dashboard home must expose permission polish panel');
}
for (const item of ['permissions', 'auto-approvals', 'extreme-mode', 'revoke', 'receipts']) {
  if (!snapshot.permissionPanel.items.some((entry) => entry.id === item)) {
    throw new Error(`permission panel item missing: ${item}`);
  }
}
for (const area of ['inbox', 'tasks', 'approvals', 'receipts', 'connectors']) {
  if (!snapshot.simpleNavigation.areas.some((entry) => entry.id === area)) {
    throw new Error(`dashboard home area missing: ${area}`);
  }
}

const home = [
  readFileSync(path.join(root, 'src/ai-gateway/app/(dashboard)/dashboard/HomePageClient.tsx'), 'utf8'),
  readFileSync(path.join(root, 'assets/dashboard/index.html'), 'utf8'),
  readFileSync(path.join(root, 'assets/dashboard/styles/chat.css'), 'utf8'),
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
  'Permissões',
  'Auto-aprovações',
  'Modo extremo',
  'Revogar',
  'home-profile-grid',
  'home-readiness-strip',
  'Organize my day',
]) {
  if (!home.includes(marker)) {
    throw new Error(`dashboard home marker missing: ${marker}`);
  }
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthDashboardExperienceHomeService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-dashboard-experience-home-check] ok');
