#!/usr/bin/env node
/**
 * Canonical Control shell asset sync.
 *
 * Source of truth: apps/zavorth-control-vite-shell
 * Runtime output:  src/zavorth-control/public/zavorth-control-vite-shell (vite outDir)
 * Legacy mirrors:  assets/zavorth-control, assets/command-center
 *                  (generated from source; do not hand-edit as primary)
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'apps', 'zavorth-control-vite-shell');
const staticShellRoot = path.join(root, 'src', 'zavorth-control', 'public', 'zavorth-control-vite-shell');
const aiGatewayShellRoot = path.join(root, 'src', 'ai-gateway', 'public', 'zavorth-control-vite-shell');
const legacyAssetRoots = [
  path.join(root, 'assets', 'zavorth-control'),
  path.join(root, 'assets', 'command-center'),
];
const normalizeOnly = process.argv.includes('--normalize-only');
const afterBuild = process.argv.includes('--after-build');

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
  'src/dashboard-surface-registry.ts',
  'src/diff-review-rail.ts',
  'src/guided-flow-cards.ts',
  'src/html-utils.ts',
  'src/local-preview-responses.ts',
  'src/memory-browser-ui.ts',
  'src/neural-feed-interactions.ts',
  'src/next-action-ui.ts',
  'src/overlay-controller.ts',
  'src/pages.ts',
  'src/policy-simulator-ui.ts',
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
  'src/session-trust-score.ts',
  'src/shell-navigation.ts',
  'src/signal-transmitter.ts',
  'src/skills-popover.ts',
  'src/text-utils.ts',
  'src/theme.ts',
  'src/trace-renderer.ts',
  'src/trace-utils.ts',
  'src/trust-rail-mobile.ts',
  'src/voice-dictation.ts',
  'src/workboard-lite.ts',
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

function isTextAsset(filePath) {
  return ['.html', '.css', '.js', '.json', '.svg', '.txt', '.md', '.mjs', '.map'].includes(
    path.extname(filePath).toLowerCase(),
  );
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (isTextAsset(source)) {
    const text = fs.readFileSync(source, 'utf8').replace(/\r\n.../g, '\n');
    fs.writeFileSync(target, text, 'utf8');
    return;
  }
  fs.copyFileSync(source, target);
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) return;
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

function emptyDirectory(target) {
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(entryPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(entryPath);
    }
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
    const normalized = text.replace(/\r\n.../g, '\n');
    if (normalized !== text) fs.writeFileSync(entryPath, normalized, 'utf8');
  }
}

/** Pre-build: copy static public assets into Next public shell path for legacy readers. */
function syncSourcePublicAssets(targetRoot) {
  fs.mkdirSync(targetRoot, { recursive: true });
  copyFile(path.join(sourceRoot, 'index.html'), path.join(targetRoot, 'index.html'));
  copyDirectory(path.join(sourceRoot, 'public', 'styles'), path.join(targetRoot, 'styles'));
  copyDirectory(path.join(sourceRoot, 'public', 'assets'), path.join(targetRoot, 'assets'));
  // Keep public/scripts only if present (legacy plain JS fallback; vite TS is canonical)
  const scriptsDir = path.join(sourceRoot, 'public', 'scripts');
  if (fs.existsSync(scriptsDir)) {
    copyDirectory(scriptsDir, path.join(targetRoot, 'scripts'));
  }
}

/**
 * After vite build, mirror the built shell into legacy asset roots so runtime
 * and older checks share one compiled surface.
 */
function mirrorBuiltShellToLegacyAssets() {
  if (!fs.existsSync(staticShellRoot) || !fs.existsSync(path.join(staticShellRoot, 'index.html'))) {
    console.warn('[zavorth-control-vite-sync] skip legacy mirror: built shell missing (run vite build first)');
    return;
  }

  for (const legacyRoot of legacyAssetRoots) {
    fs.mkdirSync(legacyRoot, { recursive: true });
    // Preserve nothing hand-written: full replace with built shell
    emptyDirectory(legacyRoot);
    copyDirectory(staticShellRoot, legacyRoot);
    const stamp = [
      '# Generated control shell',
      '',
      'This directory is produced by `npm run zavorth-control-vite:build`.',
      'Edit only: `apps/zavorth-control-vite-shell`.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(legacyRoot, 'GENERATED.md'), stamp, 'utf8');
    console.log(`[zavorth-control-vite-sync] mirrored build -> ${path.relative(root, legacyRoot)}`);
  }

  // Also publish under ai-gateway public if that tree exists
  if (fs.existsSync(path.dirname(aiGatewayShellRoot))) {
    emptyDirectory(aiGatewayShellRoot);
    copyDirectory(staticShellRoot, aiGatewayShellRoot);
    console.log('[zavorth-control-vite-sync] mirrored build -> src/ai-gateway/public/zavorth-control-vite-shell');
  }
}

if (normalizeOnly) {
  normalizeExistingTextFiles(staticShellRoot);
  for (const legacyRoot of legacyAssetRoots) normalizeExistingTextFiles(legacyRoot);
  console.log('[zavorth-control-vite-sync] normalized text assets');
  process.exit(0);
}

if (afterBuild) {
  mirrorBuiltShellToLegacyAssets();
  normalizeExistingTextFiles(staticShellRoot);
  process.exit(0);
}

assertSourceExists();
syncSourcePublicAssets(staticShellRoot);

console.log('[zavorth-control-vite-sync] synced apps/zavorth-control-vite-shell public assets -> runtime shell path');
console.log('[zavorth-control-vite-sync] source of truth: apps/zavorth-control-vite-shell');
console.log('[zavorth-control-vite-sync] runtime outDir: src/zavorth-control/public/zavorth-control-vite-shell (via vite build)');
