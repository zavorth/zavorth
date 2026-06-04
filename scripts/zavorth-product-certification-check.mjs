import { spawnSync } from 'node:child_process';
import path from 'node:path';

const result = spawnSync(process.execPath, [
  path.join('node_modules', 'tsx', 'dist', 'cli.mjs'),
  'scripts/zavorth-product-certification.ts',
  '--json',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || result.error?.message || 'Product certification failed without output.\n');
  process.exit(result.status || 1);
}

let snapshot;
try {
  snapshot = JSON.parse(result.stdout);
} catch (error) {
  process.stderr.write(`Product certification JSON parse failed: ${error.message}\n`);
  process.exit(1);
}

const failures = [];
if (snapshot.surface !== 'product-certification') failures.push('surface mismatch');
if (snapshot.status === 'blocked') failures.push('product certification is blocked');
if (!snapshot.safety?.llmReceivesCanonicalKernelSnapshot) failures.push('missing Agent Kernel safety claim');
if (!snapshot.gates?.some((gate) => gate.id === 'agent-kernel' && gate.status === 'ready')) failures.push('agent kernel gate is not ready');
if (!snapshot.gates?.some((gate) => gate.id === 'daily-tui' && gate.status === 'ready')) failures.push('daily TUI gate is not ready');
if (!snapshot.gates?.some((gate) => gate.id === 'public-docs' && gate.status === 'ready')) failures.push('public docs gate is not ready');
if (!snapshot.gates?.some((gate) => gate.id === 'channel-live-canary')) failures.push('channel live canary gate missing');
if (!snapshot.gates?.some((gate) => gate.id === 'long-session-smoke' && gate.status === 'ready')) failures.push('long session smoke gate is not ready');
if (!snapshot.gates?.some((gate) => gate.id === 'release-hygiene' && gate.status === 'ready')) failures.push('release hygiene gate is not ready');
if (!snapshot.userJourney?.some((step) => step.command === 'zavorth ready --product')) failures.push('user journey does not expose product ready command');

if (failures.length > 0) {
  process.stderr.write(`Product certification check failed: ${failures.join('; ')}\n`);
  process.exit(1);
}

process.stdout.write([
  '[product-certification-check]',
  `status=${snapshot.status}`,
  `ready=${snapshot.summary.ready}/${snapshot.summary.gates}`,
  `attention=${snapshot.summary.attention}`,
  `blocked=${snapshot.summary.blocked}`,
  'ok=true',
  '',
].join('\n'));
