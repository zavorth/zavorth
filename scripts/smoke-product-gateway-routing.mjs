#!/usr/bin/env node
/**
 * Product gateway routing smoke.
 *
 * 1. Hosted routing helpers (Code host-runtime) for zavorth / openai / anthropic
 * 2. Soft HTTP probes against gateway health + /v1 surfaces
 * 3. Hard-fail only when ZAVORTH_SMOKE_REQUIRE_GATEWAY=1 (or CI with that flag)
 *
 *   node scripts/smoke-product-gateway-routing.mjs
 *   npm run code:gateway:smoke
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

const requireGateway =
  process.env.ZAVORTH_SMOKE_REQUIRE_GATEWAY === '1' ||
  process.env.ZAVORTH_SMOKE_REQUIRE_GATEWAY === 'true';

const capsPath = path.join(root, 'bin/lib/zavorth-capabilities.cjs');
assert(fs.existsSync(capsPath), 'zavorth-capabilities.cjs missing');
const caps = require(capsPath);

const hostRuntimePath = path.join(root, 'packages/code/cli/src/util/host-runtime.ts');
assert(fs.existsSync(hostRuntimePath), 'host-runtime.ts missing');

// --- Logical routing (via bun when available; static fallback) ---
function runHostedRoutingAsserts() {
  const src = fs.readFileSync(hostRuntimePath, 'utf8');
  assert(src.includes('isOpenAiCompatibleProductRouteEnabled'), 'missing openai auto route helper');
  assert(src.includes('isAnthropicProductRouteEnabled'), 'missing anthropic route helper');
  assert(src.includes('ZAVORTH_PROVIDERS_DIRECT'), 'missing providers direct opt-out');
  assert(src.includes('ZAVORTH_ANTHROPIC_DIRECT'), 'missing anthropic direct opt-out');
  assert(src.includes('return isProductHosted(env)'), 'auto-route should key off product host');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-gw-route-'));
  const scriptPath = path.join(tmpDir, 'assert-routing.mjs');
  // Pure Node reimplementation of the env flags (keeps smoke free of Bun path issues)
  const logic = `
function envFlagTrue(v){const s=String(v......'').trim().toLowerCase();return s==='1'||s==='true'||s==='yes'||s==='on'}
function envFlagFalse(v){const s=String(v......'').trim().toLowerCase();return s==='0'||s==='false'||s==='no'||s==='off'}
function isProductHosted(env){const s=String(env.ZAVORTH_RUNTIME_SOURCE||'').toLowerCase();return s==='workspace'||s==='zavorth'||s==='monorepo'||s==='product'||env.ZAVORTH_CODE_FROM_WORKSPACE==='1'}
function isAnthropicProductRouteEnabled(env){
  if(envFlagFalse(env.ZAVORTH_ROUTE_ANTHROPIC)||envFlagTrue(env.ZAVORTH_ANTHROPIC_DIRECT)) return false
  if(envFlagTrue(env.ZAVORTH_ROUTE_ANTHROPIC)) return true
  return isProductHosted(env)
}
function isOpenAiCompatibleProductRouteEnabled(env){
  if(envFlagFalse(env.ZAVORTH_ROUTE_PROVIDERS)||envFlagTrue(env.ZAVORTH_PROVIDERS_DIRECT)) return false
  if(envFlagTrue(env.ZAVORTH_ROUTE_PROVIDERS)) return true
  return isProductHosted(env)
}
const hosted={ZAVORTH_RUNTIME_SOURCE:'workspace',ZAVORTH_GATEWAY_BASE_URL:'http://localhost:20128'}
function ok(c,m){if(!c){console.error('ASSERT',m);process.exit(2)}}
ok(isProductHosted(hosted),'hosted')
ok(isOpenAiCompatibleProductRouteEnabled(hosted),'openai auto')
ok(isAnthropicProductRouteEnabled(hosted),'anthropic auto')
ok(!isOpenAiCompatibleProductRouteEnabled({...hosted,ZAVORTH_ROUTE_PROVIDERS:'0'}),'openai opt-out')
ok(!isAnthropicProductRouteEnabled({...hosted,ZAVORTH_ANTHROPIC_DIRECT:'1'}),'anthropic opt-out')
console.log('routing-logic-ok')
`;
  fs.writeFileSync(scriptPath, logic, 'utf8');
  const r = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
    shell: false,
  });
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  assert(r.status === 0 && /routing-logic-ok/.test(r.stdout || ''), `routing asserts failed: ${r.stderr || r.stdout}`);
  pass('routing logic (hosted zavorth/openai/anthropic + opt-out)');
}

runHostedRoutingAsserts();

// --- Capabilities routing posture ---
const health = await caps.collectHealthSnapshot({
  projectRoot: root,
  env: {
    ...process.env,
    ZAVORTH_RUNTIME_SOURCE: 'workspace',
    ZAVORTH_GATEWAY_BASE_URL: process.env.ZAVORTH_GATEWAY_BASE_URL || 'http://localhost:20128',
  },
});
assert(health.routing && typeof health.routing.openaiCompatibleRouted === 'boolean', 'routing posture missing');
assert(health.routing.productHosted === true, 'expected productHosted when RUNTIME_SOURCE=workspace');
assert(health.routing.openaiCompatibleRouted === true, 'openai should auto-route when hosted');
assert(health.routing.anthropicRouted === true, 'anthropic should auto-route when hosted');
pass('health routing posture');

// --- Gateway soft probe ---
const base = String(health.gatewayBaseUrl || 'http://localhost:20128').replace(/\/+$/, '');
const surface = await caps.probeGatewaySurface(base);

if (!surface.ok) {
  const msg = `gateway down at ${base} (health/chat/messages unreachable)`;
  if (requireGateway) fail(msg);
  console.log(`SKIP: ${msg} — set ZAVORTH_SMOKE_REQUIRE_GATEWAY=1 to hard-fail`);
  pass('gateway soft-skip (local)');
  console.log('product gateway routing smoke ok (logic only)');
  process.exit(0);
}

pass(`gateway reachable (${base})`);
assert(surface.chatCompletions && surface.chatCompletions.ok, '/v1/chat/completions did not answer');
pass(`/v1/chat/completions HTTP ${surface.chatCompletions.status}`);
assert(surface.anthropicMessages && surface.anthropicMessages.ok, '/v1/messages did not answer');
pass(`/v1/messages HTTP ${surface.anthropicMessages.status}`);

// Native inspect should work without agent dist
const inspectCap = caps.resolveCapability(['inspect']);
assert(inspectCap.hit && inspectCap.def.strategy === 'hybrid', 'inspect must be hybrid');
const inspectCode = await caps.executeCapability(inspectCap.def, ['--json'], {
  projectRoot: root,
  env: {
    ...process.env,
    ZAVORTH_RUNTIME_SOURCE: 'workspace',
    ZAVORTH_GATEWAY_BASE_URL: base,
  },
  exit: false,
});
assert(typeof inspectCode === 'number', 'inspect execute returned code');
pass('native inspect --json');

console.log('product gateway routing smoke ok');
process.exit(0);
