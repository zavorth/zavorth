#!/usr/bin/env node
/**
 * Smoke: monorepo terminal capabilities on bare `zavorth <cmd>`.
 *
 *   node scripts/smoke-cli-capabilities.mjs
 *   npm run code:capabilities:smoke
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const capsPath = path.join(root, 'bin/lib/zavorth-capabilities.cjs');
assert(fs.existsSync(capsPath), 'zavorth-capabilities.cjs missing');
const caps = require(capsPath);

const inventory = caps.listCapabilities();
assert(inventory.length >= 20, `expected rich inventory, got ${inventory.length}`);
assert(
  inventory.some((d) => d.command === 'doctor' && d.strategy === 'native'),
  'doctor must be native',
);
assert(
  inventory.some((d) => d.command === 'setup' && d.strategy === 'hybrid'),
  'setup must be hybrid',
);
assert(
  inventory.some((d) => d.command === 'providers' && d.strategy === 'hybrid'),
  'providers must be hybrid',
);
assert(
  inventory.some((d) => d.command === 'models' && d.strategy === 'hybrid'),
  'models must be hybrid',
);
assert(
  inventory.some((d) => d.command === 'channels' && d.strategy === 'hybrid'),
  'channels must be hybrid',
);
assert(
  inventory.some((d) => d.command === 'approve' && d.strategy === 'hybrid'),
  'approve must be hybrid',
);
assert(
  inventory.some((d) => d.command === 'trust' && d.strategy === 'hybrid'),
  'trust must be hybrid',
);
assert(
  inventory.some((d) => d.command === 'inspect' && d.strategy === 'hybrid'),
  'inspect must be hybrid (native snapshot)',
);
pass(`inventory size=${inventory.length}`);

const doctor = caps.resolveCapability(['doctor']);
assert(doctor.hit && doctor.def.strategy === 'native', 'resolve doctor');
const setupCap = caps.resolveCapability(['setup', '--help']);
assert(setupCap.hit && setupCap.def.command === 'setup', 'resolve setup');
assert(!caps.resolveCapability(['mcp']).hit, 'mcp stays coding-owned');
assert(!caps.resolveCapability([]).hit, 'empty not capability');
assert(caps.wantsNativeSummary([]), 'bare wants native summary');
assert(caps.wantsNativeSummary(['--json']), 'flags-only wants native summary');
assert(!caps.wantsNativeSummary(['add']), 'subcommand does not want native summary');
assert(caps.wantsNativeForCommand(setupCap.def, []), 'setup bare is native');
assert(caps.wantsNativeForCommand(setupCap.def, ['status']), 'setup status is native');
assert(caps.wantsNativeForCommand(setupCap.def, ['interactive']), 'setup interactive is native');
assert(caps.wantsNativeForCommand(setupCap.def, ['apply']), 'setup apply is native');
assert(typeof caps.resolveStateDir === 'function', 'resolveStateDir exported');
assert(typeof caps.setupLocalEnvPath === 'function', 'setupLocalEnvPath exported');
pass('resolveCapability routing');

function spawnZavorth(args, envExtra) {
  return spawnSync(process.execPath, [path.join(root, 'bin/zavorth.js'), ...args], {
    cwd: root,
    env: { ...process.env, ZAVORTH_TAGLINE: 'off', ...(envExtra || {}) },
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const home = spawnZavorth(['home']);
assert(home.status === 0, `home exit ${home.status} stderr=${home.stderr}`);
assert(/Zavorth home|Next:/i.test(home.stdout || ''), `home output unexpected: ${home.stdout}`);
pass('zavorth home (native)');

const status = spawnZavorth(['status']);
assert(typeof status.status === 'number', 'status spawned');
assert(/Zavorth status|ready:/i.test(status.stdout || ''), `status output: ${status.stdout}`);
pass('zavorth status (native)');

const doctorRun = spawnZavorth(['doctor']);
assert(typeof doctorRun.status === 'number', 'doctor spawned');
assert(/Zavorth doctor|code-tui|Code TUI/i.test(doctorRun.stdout || ''), `doctor output: ${doctorRun.stdout}`);
pass('zavorth doctor (native)');

const capsList = spawnZavorth(['capabilities']);
assert(capsList.status === 0, `capabilities exit ${capsList.status}`);
assert(/setup-health|models-providers|channels-memory|approvals-trust/i.test(capsList.stdout || ''), 'capabilities clusters');
assert(/hybrid/i.test(capsList.stdout || ''), 'capabilities lists hybrid strategy');
pass('zavorth capabilities (native)');

const setupRun = spawnZavorth(['setup'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(typeof setupRun.status === 'number', 'setup spawned');
assert(/Zavorth setup|ready:|Next:/i.test(setupRun.stdout || ''), `setup output: ${setupRun.stdout}`);
pass('zavorth setup (native hybrid status)');

const setupHelp = spawnZavorth(['setup', 'help']);
assert(setupHelp.status === 0, `setup help exit ${setupHelp.status}`);
assert(/Usage: zavorth setup/i.test(setupHelp.stdout || ''), 'setup help usage');
pass('zavorth setup help (native)');

const providers = spawnZavorth(['providers'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(providers.status === 0, `providers exit ${providers.status} stderr=${providers.stderr}`);
assert(/Zavorth providers|configured:/i.test(providers.stdout || ''), `providers output: ${providers.stdout}`);
pass('zavorth providers (native hybrid summary)');

const models = spawnZavorth(['models'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(models.status === 0, `models exit ${models.status} stderr=${models.stderr}`);
assert(/Zavorth models|gateway:/i.test(models.stdout || ''), `models output: ${models.stdout}`);
pass('zavorth models (native hybrid summary)');

const channels = spawnZavorth(['channels'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(channels.status === 0, `channels exit ${channels.status} stderr=${channels.stderr}`);
assert(/Zavorth channels|Env readiness|gateway:/i.test(channels.stdout || ''), `channels output: ${channels.stdout}`);
pass('zavorth channels (native hybrid summary)');

const approveList = spawnZavorth(['approve', 'list'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(typeof approveList.status === 'number', 'approve list spawned');
assert(/gatewayBaseUrl|pendingEstimate|controlUrl/i.test(approveList.stdout || ''), `approve list: ${approveList.stdout?.slice(0, 200)}`);
pass('zavorth approve list (native/json snapshot)');

const approve = spawnZavorth(['approve'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(approve.status === 0, `approve exit ${approve.status} stderr=${approve.stderr}`);
assert(/Zavorth approve|control:|pending/i.test(approve.stdout || ''), `approve output: ${approve.stdout}`);
pass('zavorth approve (native hybrid summary)');

const trust = spawnZavorth(['trust'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(trust.status === 0, `trust exit ${trust.status} stderr=${trust.stderr}`);
assert(/Zavorth trust|policy authority|control:/i.test(trust.stdout || ''), `trust output: ${trust.stdout}`);
pass('zavorth trust (native hybrid summary)');

const inspect = spawnZavorth(['inspect'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
  ZAVORTH_RUNTIME_SOURCE: 'workspace',
});
assert(typeof inspect.status === 'number', 'inspect spawned');
assert(/Zavorth inspect|routing:|providers configured/i.test(inspect.stdout || ''), `inspect: ${inspect.stdout?.slice(0, 300)}`);
pass('zavorth inspect (native hybrid snapshot)');

const providersList = spawnZavorth(['providers', 'list'], {
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(providersList.status === 0, `providers list exit ${providersList.status}`);
pass('zavorth providers list (native)');

assert(caps.wantsNativeForCommand(caps.resolveCapability(['inspect']).def, []), 'inspect bare native');
assert(caps.wantsNativeForCommand(caps.resolveCapability(['setup']).def, ['token']), 'setup token native');

// Isolated home so smoke never writes secrets under the real user state tree
const smokeHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'zavorth-caps-smoke-'));
const smokeEnv = {
  ZAVORTH_SETUP_NONINTERACTIVE: '1',
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
  ZAVORTH_HOME: smokeHome,
};

// Native interactive setup (non-TTY path via env) — must not write secrets
const interactive = spawnZavorth(['setup', 'interactive'], smokeEnv);
assert(typeof interactive.status === 'number', 'setup interactive spawned');
const interactiveOut = (interactive.stdout || '') + (interactive.stderr || '');
assert(
  /interactive|template|Configured|Missing|No secrets/i.test(interactiveOut),
  `setup interactive output: ${interactiveOut.slice(0, 300)}`,
);
assert(
  /No secrets written|template \+ status only|User-local secrets path/i.test(interactiveOut),
  `noninteractive should state no secrets written: ${interactiveOut.slice(0, 400)}`,
);
// Ensure secret value never appears (sanity — we did not pass any)
assert(!/sk-live|sk-test-secret/i.test(interactiveOut), 'interactive must not leak secret-like tokens');
pass('zavorth setup interactive (native non-TTY / no secrets)');
const envExample = path.join(root, 'data', 'setup.env.example');
assert(fs.existsSync(envExample), 'data/setup.env.example should be written');
const exampleBody = fs.readFileSync(envExample, 'utf8');
assert(/no secrets|template/i.test(exampleBody), 'template should describe no-secrets policy');
// Template lines for keys should remain comments only
assert(!/^OPENAI_API_KEY=\S+/m.test(exampleBody), 'template must not contain live OPENAI_API_KEY values');
pass('setup env template written (secret-free)');

// setup apply with empty state dir
const applyEmpty = spawnZavorth(['setup', 'apply'], {
  ZAVORTH_HOME: smokeHome,
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(typeof applyEmpty.status === 'number', 'setup apply spawned');
const applyEmptyOut = (applyEmpty.stdout || '') + (applyEmpty.stderr || '');
assert(
  /setup apply|No user-local env|setup\.local\.env|Load/i.test(applyEmptyOut),
  `setup apply empty: ${applyEmptyOut.slice(0, 300)}`,
);
pass('zavorth setup apply (no file yet)');

// Unit-level: write a key under isolated ZAVORTH_HOME and apply shows name not value
const secretValue = 'sk-smoke-should-never-print-this-value';
const written = caps.writeSetupLocalEnvKey({
  env: { ZAVORTH_HOME: smokeHome },
  key: 'OPENAI_API_KEY',
  value: secretValue,
});
assert(fs.existsSync(written.path), 'setup.local.env created under state');
assert(written.path.includes(path.join(smokeHome, 'state')), 'local env under ZAVORTH_HOME/state');
const onDisk = fs.readFileSync(written.path, 'utf8');
assert(onDisk.includes('OPENAI_API_KEY='), 'key name present on disk');
assert(onDisk.includes(secretValue), 'value stored on disk for apply');

const applyReady = spawnZavorth(['setup', 'apply'], {
  ZAVORTH_HOME: smokeHome,
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
const applyOut = (applyReady.stdout || '') + (applyReady.stderr || '');
assert(applyReady.status === 0, `setup apply with keys exit ${applyReady.status}`);
assert(/OPENAI_API_KEY/.test(applyOut), 'apply lists key names');
assert(
  !applyOut.includes(secretValue),
  'apply must never print secret values',
);
assert(/set -a|Get-Content|Load into your shell/i.test(applyOut), 'apply prints load instructions');
pass('zavorth setup apply (key names only, load instructions)');

const applyJson = spawnZavorth(['setup', 'apply', '--json'], {
  ZAVORTH_HOME: smokeHome,
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(applyJson.status === 0, `setup apply --json exit ${applyJson.status}`);
assert(/"keyNames"/i.test(applyJson.stdout || ''), 'apply --json has keyNames');
assert(!(applyJson.stdout || '').includes(secretValue), 'apply --json must omit secret values');
pass('zavorth setup apply --json (no secrets)');

// setup token status (no create with print in smoke — avoids secret in logs)
const tokenStatus = spawnZavorth(['setup', 'token'], {
  ZAVORTH_HOME: smokeHome,
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
});
assert(tokenStatus.status === 0, `setup token exit ${tokenStatus.status}`);
assert(/setup token|management|user-local/i.test(tokenStatus.stdout || ''), `token status: ${tokenStatus.stdout?.slice(0, 200)}`);
pass('zavorth setup token (status)');

const tokenCreate = spawnZavorth(['setup', 'token', 'create'], {
  ZAVORTH_HOME: smokeHome,
  ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
  ZAVORTH_SETUP_NONINTERACTIVE: '1',
});
assert(tokenCreate.status === 0, `setup token create exit ${tokenCreate.status} ${tokenCreate.stderr}`);
const tokenOut = (tokenCreate.stdout || '') + (tokenCreate.stderr || '');
assert(/Created ZAVORTH_MANAGEMENT_TOKEN|user-local/i.test(tokenOut), `token create: ${tokenOut.slice(0, 300)}`);
// Without --print, the random token body should not be echoed as bare assignment of unknown value
// (we only check process didn't crash and wrote under isolated home)
const localEnv = caps.setupLocalEnvPath({ ZAVORTH_HOME: smokeHome });
assert(fs.existsSync(localEnv), 'token create wrote setup.local.env');
const localBody = fs.readFileSync(localEnv, 'utf8');
assert(/ZAVORTH_MANAGEMENT_TOKEN=/.test(localBody), 'local env contains management token key');
assert(!tokenOut.includes(localBody.match(/ZAVORTH_MANAGEMENT_TOKEN=(.+)/)?.[1] || '___never___'), 'create without --print must not echo token');
pass('zavorth setup token create (user state only, no print)');

// cleanup isolated home (best effort)
try {
  fs.rmSync(smokeHome, { recursive: true, force: true });
} catch {
  // ignore
}

console.log('capabilities smoke ok');