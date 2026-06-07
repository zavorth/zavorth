#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const requiredFiles = [
  'apps/zavorth-desktop/package.json',
  'apps/zavorth-desktop/electron/main.cjs',
  'apps/zavorth-desktop/electron/preload.cjs',
  'apps/zavorth-desktop/src/App.tsx',
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
  for (const scriptName of ['dev', 'build', 'check', 'package:dir']) {
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
    "preload: path.join(__dirname, 'preload.cjs')",
    'resolveZavorthHome',
    'startZavorthRuntime',
    'buildDashboardUrl',
  ]) {
    if (!main.includes(needle)) {
      failures.push(`desktop main missing contract: ${needle}`);
    }
  }
  if (/console\.log\([^)]*token/iu.test(main) || /rememberLog\([^)]*token/iu.test(main)) {
    failures.push('desktop main must not log dashboard tokens');
  }

  const preload = read('apps/zavorth-desktop/electron/preload.cjs');
  for (const needle of [
    "contextBridge.exposeInMainWorld('zavorthDesktop'",
    'getRuntimeStatus',
    'repairAccess',
    'startSetup',
    'openLogs',
    'onBootEvent',
  ]) {
    if (!preload.includes(needle)) {
      failures.push(`desktop preload missing bridge API: ${needle}`);
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
}

if (failures.length > 0) {
  console.error(JSON.stringify({ status: 'fail', failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: 'pass', checkedFiles: requiredFiles.length }, null, 2));
