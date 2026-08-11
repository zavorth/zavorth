import { spawnSync } from 'node:child_process';
import path from 'node:path';

const result = spawnSync(process.execPath, [
  path.join('node_modules', 'tsx', 'dist', 'cli.mjs'),
  'scripts/zavorth-agent-kernel.ts',
  '--json',
  '--strict',
  '--kind',
  'zavorth_action',
  '--text',
  'change skill governance to governed',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || result.error?.message || 'Agent Kernel check command failed without output.\n');
  process.exit(result.status || 1);
}

let snapshot;
try {
  snapshot = JSON.parse(result.stdout);
} catch (error) {
  process.stderr.write(`Agent Kernel check failed to parse JSON: ${error.message}\n`);
  process.exit(1);
}

const failures = [];
if (snapshot.surface !== 'agent-kernel-snapshot') failures.push('surface mismatch');
if (!snapshot.capabilityPassport?.safety?.riskyMutationUsesPreviewApprovalReceipt) failures.push('missing mutation safety');
if (snapshot.intentDecision?.kind !== 'zavorth_action') failures.push('natural config request did not route to action harness');
if (snapshot.intentDecision?.requiresPreview !== true) failures.push('mutating action did not require preview');
if (!String(snapshot.llmContextBlock || '').includes('Agent Kernel Snapshot')) failures.push('missing llm kernel block');
if (snapshot.capabilityPassport?.providers?.needsConnector !== 0) failures.push('provider connector backlog is not empty');

if (failures.length > 0) {
  process.stderr.write(`Agent Kernel check failed: ${failures.join('; ')}\n`);
  process.exit(1);
}

process.stdout.write([
  '[agent-kernel-check]',
  `status=${snapshot.status}`,
  `profile=${snapshot.capabilityPassport.activeProfile.id}`,
  `providers=${snapshot.capabilityPassport.providers.routes}`,
  `channels=${snapshot.capabilityPassport.channels.total}`,
  `intent=${snapshot.intentDecision.kind}`,
  'ok=true',
  '',
].join('\n'));
