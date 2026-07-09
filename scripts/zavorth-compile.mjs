#!/usr/bin/env node

/**
 * zavorth-compile.mjs — Standalone binary compilation script.
 *
 * Pipeline:
 *   1. esbuild bundles dist/zavorth-cli.js → dist-standalone/zavorth-bundle.cjs
 *   2. Copy platform-specific better_sqlite3.node sidecar
 *   3. Generate Node SEA (Single Executable Application) blob
 *   4. Inject blob into node binary copy → dist-standalone/zavorth[.exe]
 *
 * Requires Node >= 20. Run with: node scripts/zavorth-compile.mjs
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distStandalone = path.join(projectRoot, 'dist-standalone');
const bundlePath = path.join(distStandalone, 'zavorth-bundle.cjs');
const seaConfigPath = path.join(distStandalone, 'sea-config.json');
const seaBlobPath = path.join(distStandalone, 'sea-prep.blob');
const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';
const binaryName = isWindows ? 'zavorth.exe' : 'zavorth';
const binaryPath = path.join(distStandalone, binaryName);

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function log(msg) {
  console.log(`${CYAN}[compile]${RESET} ${msg}`);
}

function success(msg) {
  console.log(`${GREEN}✅ ${msg}${RESET}`);
}

function fail(msg) {
  console.error(`${RED}❌ ${msg}${RESET}`);
}

// ---------------------------------------------------------------------------
// Step 0: Preflight checks
// ---------------------------------------------------------------------------
function preflight() {
  const nodeVersion = process.versions.node.split('.').map(Number);
  if (nodeVersion[0] < 20) {
    fail(`Node >= 20 required for Single Executable Applications. Found: ${process.version}`);
    process.exit(1);
  }

  const cliEntry = path.join(projectRoot, 'dist', 'zavorth-cli.js');
  if (!fs.existsSync(cliEntry)) {
    fail('dist/zavorth-cli.js not found. Run `npm run build` first.');
    process.exit(1);
  }

  const esbuildBin = path.join(projectRoot, 'node_modules', 'esbuild', 'bin', 'esbuild');
  if (!fs.existsSync(esbuildBin)) {
    fail('esbuild not found. Run `npm install` first.');
    process.exit(1);
  }

  log(`Node ${process.version} — preflight passed.`);
}

// ---------------------------------------------------------------------------
// Step 1: esbuild bundle
// ---------------------------------------------------------------------------
function bundleWithEsbuild() {
  log('Patching ink to remove top-level await...');
  const inkReconcilerPath = path.join(projectRoot, 'node_modules', 'ink', 'build', 'reconciler.js');
  if (fs.existsSync(inkReconcilerPath)) {
    let content = fs.readFileSync(inkReconcilerPath, 'utf8');
    content = content.replace(/await import\('\.\/devtools\.js'\);/g, '// removed devtools await');
    content = content.replace(/await loadPackageJson\(\);/g, '{}; // removed loadPackageJson await');
    fs.writeFileSync(inkReconcilerPath, content);
  }

  log('Patching yoga-layout to remove top-level await...');
  const yogaPath = path.join(projectRoot, 'node_modules', 'yoga-layout', 'dist', 'src', 'index.js');
  if (fs.existsSync(yogaPath)) {
    let content = fs.readFileSync(yogaPath, 'utf8');
    content = content.replace(/wrapAssembly\(await loadYoga\(\)\)/g, 'wrapAssembly(loadYoga() /* removed await */)');
    fs.writeFileSync(yogaPath, content);
  }

  log('Bundling with esbuild...');

  fs.mkdirSync(distStandalone, { recursive: true });

  const esbuildArgs = [
    path.join(projectRoot, 'dist', 'zavorth-cli.js'),
    '--bundle',
    '--platform=node',
    `--outfile=${bundlePath}`,
    '--format=cjs',
    '--target=node20',
    // Externalize native addons and optional heavy deps
    '--external:better-sqlite3',
    '--external:better-sqlite3-multiple-ciphers',
    '--external:node-gyp',
    '--external:fsevents',
    '--external:readline/promises',
    '--external:playwright-core',
    '--external:chromium-bidi/*',
    '--external:../execution/ExternalExecutor.js',
    // ESM natively supports import.meta.url, no polyfill needed
    '--log-level=warning',
  ];

  const esbuildBin = path.join(projectRoot, 'node_modules', 'esbuild', 'bin', 'esbuild');
  const result = spawnSync(process.execPath, [esbuildBin, ...esbuildArgs], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120000,
  });

  if (result.error) {
    fail(`esbuild failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    fail(`esbuild failed:\n${result.stderr || result.stdout || 'Unknown error (no output)'}`);
    process.exit(1);
  }

  const size = fs.statSync(bundlePath).size;
  log(`Bundle created: ${(size / 1024 / 1024).toFixed(1)} MB`);
}

// ---------------------------------------------------------------------------
// Step 2: Copy native addon sidecar
// ---------------------------------------------------------------------------
function copyNativeAddon() {
  log('Locating better-sqlite3 native addon...');

  // Find the .node file in node_modules
  const candidates = [
    path.join(projectRoot, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    path.join(projectRoot, 'node_modules', 'better-sqlite3', 'prebuilds', `${os.platform()}-${os.arch()}`, 'better_sqlite3.node'),
  ];

  // Also search prebuilds with various naming patterns
  const prebuildsDir = path.join(projectRoot, 'node_modules', 'better-sqlite3', 'prebuilds');
  if (fs.existsSync(prebuildsDir)) {
    for (const dir of fs.readdirSync(prebuildsDir)) {
      const fullDir = path.join(prebuildsDir, dir);
      if (fs.statSync(fullDir).isDirectory()) {
        for (const file of fs.readdirSync(fullDir)) {
          if (file.endsWith('.node')) {
            candidates.push(path.join(fullDir, file));
          }
        }
      }
    }
  }

  let found = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      found = candidate;
      break;
    }
  }

  if (!found) {
    log('⚠️  better-sqlite3 native addon not found — binary will require it at runtime.');
    return;
  }

  const targetDir = path.join(distStandalone, 'native');
  fs.mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, 'better_sqlite3.node');
  fs.copyFileSync(found, targetFile);
  log(`Native addon copied: ${path.relative(projectRoot, targetFile)}`);
}

// ---------------------------------------------------------------------------
// Step 3: Generate SEA blob
// ---------------------------------------------------------------------------
function generateSeaBlob() {
  log('Generating Node SEA configuration...');

  const seaConfig = {
    main: bundlePath,
    output: seaBlobPath,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
  };

  fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

  log('Generating SEA preparation blob...');
  const result = spawnSync(process.execPath, ['--experimental-sea-config', seaConfigPath], {
    cwd: distStandalone,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 60000,
  });

  if (result.status !== 0) {
    fail(`SEA blob generation failed:\n${result.stderr || result.stdout}`);
    process.exit(1);
  }

  if (!fs.existsSync(seaBlobPath)) {
    fail('SEA blob was not generated.');
    process.exit(1);
  }

  const size = fs.statSync(seaBlobPath).size;
  log(`SEA blob: ${(size / 1024 / 1024).toFixed(1)} MB`);
}

// ---------------------------------------------------------------------------
// Step 4: Inject into node binary
// ---------------------------------------------------------------------------
function injectIntoNodeBinary() {
  log('Copying Node binary...');
  fs.copyFileSync(process.execPath, binaryPath);

  // Make writable
  fs.chmodSync(binaryPath, 0o755);

  if (isMac) {
    log('Removing macOS code signature...');
    spawnSync('codesign', ['--remove-signature', binaryPath], { stdio: 'pipe' });
  }

  log('Injecting SEA blob into binary...');
  const injectResult = spawnSync(process.execPath, [
    '-e',
    `require('node:sea').inject('${binaryPath.replace(/\\/g, '\\\\')}', '${seaBlobPath.replace(/\\/g, '\\\\')}', { sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2' })`,
  ], {
    cwd: distStandalone,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 60000,
  });

  // Alternative injection via postject if the programmatic API isn't available
  if (injectResult.status !== 0) {
    log('Trying injection via npx postject...');
    const sentinel = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
    const postjectArgs = [
      '-y',
      'postject',
      path.basename(binaryPath),
      'NODE_SEA_BLOB',
      path.basename(seaBlobPath),
      '--sentinel-fuse', sentinel,
    ];
    if (isMac) {
      postjectArgs.push('--macho-segment-name', 'NODE_SEA');
    }
    const postjectResult = spawnSync('npx', postjectArgs, {
      cwd: distStandalone,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60000,
      shell: isWindows,
    });
    if (postjectResult.error) {
      fail(`SEA injection failed to spawn postject: ${postjectResult.error.message}`);
      process.exit(1);
    }
    if (postjectResult.status !== 0) {
      fail(`SEA injection failed:\n${postjectResult.stderr || postjectResult.stdout || 'Unknown error'}`);
      process.exit(1);
    }
  }

  if (isMac) {
    log('Re-signing macOS binary (ad-hoc)...');
    spawnSync('codesign', ['--sign', '-', binaryPath], { stdio: 'pipe' });
  }

  const size = fs.statSync(binaryPath).size;
  success(`Binary created: ${binaryPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

// ---------------------------------------------------------------------------
// Step 5: Summary
// ---------------------------------------------------------------------------
function summary() {
  console.log('');
  console.log(`${BOLD}╭──────────────────────────────────────────╮${RESET}`);
  console.log(`${BOLD}│    Zavorth Standalone Binary              │${RESET}`);
  console.log(`${BOLD}╰──────────────────────────────────────────╯${RESET}`);
  console.log('');
  console.log(`  Binary:   ${binaryPath}`);
  console.log(`  Platform: ${os.platform()}-${os.arch()}`);
  console.log(`  Size:     ${(fs.statSync(binaryPath).size / 1024 / 1024).toFixed(1)} MB`);
  console.log('');

  const nativeAddon = path.join(distStandalone, 'native', 'better_sqlite3.node');
  if (fs.existsSync(nativeAddon)) {
    console.log(`  ${DIM}Note: Distribute the 'native/' folder alongside the binary.${RESET}`);
  }

  console.log('');
  console.log(`  Verify:   ${isWindows ? '.\\dist-standalone\\zavorth.exe' : './dist-standalone/zavorth'} --version`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes('--check')) {
  preflight();
  success('All prerequisites met. Ready to compile.');
  process.exit(0);
}

preflight();
bundleWithEsbuild();
copyNativeAddon();
generateSeaBlob();
injectIntoNodeBinary();
summary();
