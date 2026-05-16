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
  'assets/command-center/index.html',
  'assets/command-center/styles/chat.css',
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

const home = [
  readFileSync(path.join(root, 'src/ai-gateway/app/(dashboard)/dashboard/HomePageClient.tsx'), 'utf8'),
  readFileSync(path.join(root, 'assets/command-center/index.html'), 'utf8'),
  readFileSync(path.join(root, 'assets/command-center/styles/chat.css'), 'utf8'),
].join('\n');
for (const marker of [
  'Hello, Operator',
  'Choose a mode, then start a mission.',
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
