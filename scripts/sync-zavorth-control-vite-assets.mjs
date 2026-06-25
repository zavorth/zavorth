#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'apps', 'zavorth-control-vite-shell');
const staticShellRoot = path.join(root, 'src', 'zavorth-control', 'public', 'zavorth-control-vite-shell');
const normalizeOnly = process.argv.includes('--normalize-only');

const requiredSourceFiles = [
  'index.html',
  'src/app.ts',
  'src/approval-artifact-cards.ts',
  'src/chat-renderer.ts',
  'src/chat-surface-renderers.ts',
  'src/composer-attachments.ts',
  'src/composer-event-wiring.ts',
  'src/composer-settings.ts',
  'src/conversation-export.ts',
  'src/control-sheets.ts',
  'src/dashboard-live-view.ts',
  'src/guided-flow-cards.ts',
  'src/html-utils.ts',
  'src/local-preview-responses.ts',
  'src/neural-feed-interactions.ts',
  'src/overlay-controller.ts',
  'src/pages.ts',
  'src/runtime-artifact-utils.ts',
  'src/runtime-auth-session.ts',
  'src/runtime-bridge.ts',
  'src/runtime-http.ts',
  'src/runtime-model-profile.ts',
  'src/runtime-operations-panels.ts',
  'src/runtime-provider-panels.ts',
  'src/runtime-refresh.ts',
  'src/runtime-realtime.ts',
  'src/runtime-run-replay.ts',
  'src/runtime-session-ui.ts',
  'src/shell-navigation.ts',
  'src/signal-transmitter.ts',
  'src/skills-popover.ts',
  'src/text-utils.ts',
  'src/theme.ts',
  'src/trace-renderer.ts',
  'src/trace-utils.ts',
  'src/voice-dictation.ts',
  'public/scripts/app.js',
  'public/scripts/pages.js',
  'public/scripts/runtime-bridge.js',
  'public/styles/base.css',
  'public/styles/layout.css',
  'public/styles/components.css',
  'public/styles/chat.css',
  'public/styles/pages.css',
  'public/styles/overlays.css',
  'public/assets/zavorth-icon.svg',
];

function assertSourceExists() {
  const missing = requiredSourceFiles.filter((file) => !fs.existsSync(path.join(sourceRoot, file)));
  if (missing.length) {
    console.error('[zavorth-control-vite-sync] missing source files');
    for (const file of missing) console.error(`- ${file}`);
    process.exit(1);
  }
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (isTextAsset(source)) {
    const text = fs.readFileSync(source, 'utf8').replace(/\r\n?/g, '\n');
    fs.writeFileSync(target, text, 'utf8');
    return;
  }
  fs.copyFileSync(source, target);
}

function isTextAsset(filePath) {
  return ['.html', '.css', '.js', '.json', '.svg', '.txt', '.md'].includes(path.extname(filePath).toLowerCase());
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) copyFile(sourcePath, targetPath);
  }
}

function normalizeExistingTextFiles(targetRoot) {
  if (!fs.existsSync(targetRoot)) return;
  for (const entry of fs.readdirSync(targetRoot, { withFileTypes: true })) {
    const entryPath = path.join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      normalizeExistingTextFiles(entryPath);
      continue;
    }
    if (!entry.isFile() || !isTextAsset(entryPath)) continue;
    const text = fs.readFileSync(entryPath, 'utf8');
    const normalized = text.replace(/\r\n?/g, '\n');
    if (normalized !== text) fs.writeFileSync(entryPath, normalized, 'utf8');
  }
}

function syncTo(targetRoot, options = {}) {
  copyFile(path.join(sourceRoot, 'index.html'), path.join(targetRoot, 'index.html'));
  copyDirectory(path.join(sourceRoot, 'public', 'scripts'), path.join(targetRoot, 'scripts'));
  copyDirectory(path.join(sourceRoot, 'public', 'styles'), path.join(targetRoot, 'styles'));
  copyDirectory(path.join(sourceRoot, 'public', 'assets'), path.join(targetRoot, 'assets'));

  if (options.includePublicFolder) {
    copyDirectory(path.join(sourceRoot, 'public'), path.join(targetRoot, 'public'));
  }
}

if (normalizeOnly) {
  normalizeExistingTextFiles(staticShellRoot);
  console.log('[zavorth-control-vite-sync] normalized text assets in Next Vite shell output');
  process.exit(0);
}

assertSourceExists();
syncTo(staticShellRoot);

console.log('[zavorth-control-vite-sync] synced apps/zavorth-control-vite-shell -> Next Vite shell assets');
console.log('[zavorth-control-vite-sync] app module source: apps/zavorth-control-vite-shell/src/app.ts');
console.log('[zavorth-control-vite-sync] pages module source: apps/zavorth-control-vite-shell/src/pages.ts');
console.log('[zavorth-control-vite-sync] runtime bridge module source: apps/zavorth-control-vite-shell/src/runtime-bridge.ts');
