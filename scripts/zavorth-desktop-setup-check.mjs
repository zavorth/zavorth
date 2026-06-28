#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const requiredFiles = [
  'apps/zavorth-desktop/package.json',
  'apps/zavorth-desktop/electron/main.cjs',
  'apps/zavorth-desktop/electron/preload.cjs',
  'apps/zavorth-desktop/src/apiClient.ts',
  'apps/zavorth-desktop/src/App.tsx',
  'apps/zavorth-desktop/src/slashCommands.ts',
  'apps/zavorth-desktop/src/styles.css',
  'apps/zavorth-setup/package.json',
  'apps/zavorth-setup/src/App.tsx',
  'apps/zavorth-setup/src/store.ts',
  'apps/zavorth-setup/src-tauri/tauri.conf.json',
  'apps/zavorth-setup/src-tauri/src/bootstrap.rs',
  'apps/zavorth-setup/src-tauri/src/lib.rs',
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`missing required file: ${file}`);
  }
}

if (failures.length === 0) {
  const rootPkg = readJson('package.json');
  for (const scriptName of [
    'zavorth-desktop:dev',
    'zavorth-desktop:check',
    'zavorth-setup:dev',
    'zavorth-setup:check',
    'zavorth:desktop-setup:check',
  ]) {
    if (!rootPkg.scripts?.[scriptName]) {
      failures.push(`missing root package script: ${scriptName}`);
    }
  }

  const desktopPkg = readJson('apps/zavorth-desktop/package.json');
  for (const scriptName of ['dev', 'build', 'check', 'check:electron', 'package:dir']) {
    if (!desktopPkg.scripts?.[scriptName]) {
      failures.push(`missing desktop package script: ${scriptName}`);
    }
  }
  if (!desktopPkg.devDependencies?.electron || !desktopPkg.devDependencies?.['electron-builder']) {
    failures.push('desktop package must declare Electron packaging dependencies');
  }

  const main = read('apps/zavorth-desktop/electron/main.cjs');
  for (const needle of [
    'contextIsolation: true',
    'nodeIntegration: false',
    'sandbox: true',
    'Notification',
    "preload: path.join(__dirname, 'preload.cjs')",
    'trustedWorkspaceRoots',
    'isTrustedWorkspacePath',
    'validateRendererUrl',
    'setWindowOpenHandler',
    'will-navigate',
    'resolveZavorthHome',
    'startZavorthRuntime',
    'buildRuntimeBaseUrl',
    'zavorth:api:request',
    '/api/experience/home',
    'X-Zavorth-Desktop-Bridge',
  ]) {
    if (!main.includes(needle)) {
      failures.push(`desktop main missing contract: ${needle}`);
    }
  }
  if (/console\.log\([^)]*token/iu.test(main) || /rememberLog\([^)]*token/iu.test(main)) {
    failures.push('desktop main must not log dashboard tokens');
  }
  if (/loadURL\(next\.dashboardUrl\)|buildDashboardUrl|dashboardUrl|\/dashboard/iu.test(main)) {
    failures.push('desktop main must not load dashboard as the chat surface');
  }
  if (!main.includes("Folder is not trusted for desktop file browsing.")) {
    failures.push('desktop main must reject untrusted file-tree roots');
  }

  const preload = read('apps/zavorth-desktop/electron/preload.cjs');
  for (const needle of [
    "contextBridge.exposeInMainWorld('zavorthDesktop'",
    'getRuntimeStatus',
    'apiRequest',
    'repairAccess',
    'startSetup',
    'openLogs',
    'onBootEvent',
  ]) {
    if (!preload.includes(needle)) {
      failures.push(`desktop preload missing bridge API: ${needle}`);
    }
  }

  const app = [
    read('apps/zavorth-desktop/src/App.tsx'),
    read('apps/zavorth-desktop/src/shell/DesktopShell.tsx'),
    read('apps/zavorth-desktop/src/composer/DesktopCommandBar.tsx'),
    read('apps/zavorth-desktop/src/views/DesktopWorkspaceView.tsx'),
    read('apps/zavorth-desktop/src/thread/ThreadView.tsx'),
    read('apps/zavorth-desktop/src/useDesktopAppState.ts'),
  ].join('\n');
  for (const needle of [
    'sendMessage',
    'resolveApproval',
    'resolveLearning',
    'DesktopCommandBar',
    'MemoryView',
    'Memory protection',
    'Advanced protection active',
    'runMemoryEncryptionMigration',
    'SkillsView',
    'ChannelsView',
    'SettingsView',
  ]) {
    if (!app.includes(needle)) {
      failures.push(`desktop app missing native surface: ${needle}`);
    }
  }

  const apiClient = read('apps/zavorth-desktop/src/apiClient.ts');
  for (const needle of [
    '/api/experience/home',
    '/api/experience/ask',
    '/api/experience/approvals',
    '/api/experience/learning',
    '/api/experience/memory/encryption',
    '/api/v2/echo/tools',
    '/api/v2/nexus/status',
    'loadMemoryEncryptionStatus',
    'dispatchRuntimeStateAction',
    '/api/experience/runtime-state/action',
    'apiRequest',
  ]) {
    if (!apiClient.includes(needle)) {
      failures.push(`desktop api client missing endpoint: ${needle}`);
    }
  }

  const commands = read('apps/zavorth-desktop/src/slashCommands.ts');
  for (const command of ['/stop', '/model', '/effort', '/profile', '/steer', '/usage', '/go', '/workflows', '/memory', '/skills', '/channels', '/settings']) {
    if (!commands.includes(command)) {
      failures.push(`desktop slash commands missing ${command}`);
    }
  }

  const setupConfig = readJson('apps/zavorth-setup/src-tauri/tauri.conf.json');
  if (setupConfig.productName !== 'Zavorth Setup') {
    failures.push('setup productName must be Zavorth Setup');
  }
  if (!String(setupConfig.app?.security?.csp || '').includes("default-src 'self'")) {
    failures.push('setup CSP must be local-first and explicit');
  }

  const bootstrap = read('apps/zavorth-setup/src-tauri/src/bootstrap.rs');
  for (const needle of [
    'StartBootstrapArgs',
    'start_bootstrap',
    'cancel_bootstrap',
    'get_bootstrap_status',
    'launch_zavorth_desktop',
    'scripts/install-zavorth',
  ]) {
    if (!bootstrap.includes(needle)) {
      failures.push(`setup bootstrap missing contract: ${needle}`);
    }
  }

  const legacyDaemon = read('scripts/launch-daemon.vbs');
  if (/npm run dev/iu.test(legacyDaemon)) {
    failures.push('legacy daemon launcher must not start npm run dev');
  }
  const registerDaemon = read('scripts/register-zavorth-daemon.ps1');
  for (const needle of ['install-windows-startup.ps1', '-AllowInstall']) {
    if (!registerDaemon.includes(needle)) {
      failures.push(`daemon registration must delegate to guarded startup installer: ${needle}`);
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ status: 'fail', failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: 'pass', checkedFiles: requiredFiles.length }, null, 2));
