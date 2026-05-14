import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const argv = process.argv.slice(2);
const skipBuild = argv.includes('--skip-build');
const skipWeb = argv.includes('--skip-web');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const steps = [];

function writeReport(status) {
  const reportDir = path.resolve('data', 'runtime', 'qa');
  fs.mkdirSync(reportDir, { recursive: true });
  const totalDurationMs = steps.reduce((total, entry) => total + Number(entry.durationMs || 0), 0);
  const payload = {
    suiteName: 'Smoke Suite',
    generatedAt: new Date().toISOString(),
    status,
    summary: {
      totalSteps: steps.length,
      passed: steps.filter((entry) => entry.success).length,
      failed: steps.filter((entry) => !entry.success).length,
      totalDurationMs,
    },
    steps,
  };
  fs.writeFileSync(path.join(reportDir, 'smoke-suite.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function runStep(id, label, command, args) {
  console.log(`[smoke-suite] ${label}`);
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  steps.push({
    id,
    label,
    command: [command, ...args].join(' '),
    durationMs: Date.now() - startedAt,
    success: result.status === 0,
    error: result.status === 0 ? null : `exit ${String(result.status || 1)}`,
  });
  if (result.status !== 0) {
    writeReport('failed');
    process.exit(result.status || 1);
  }
}

if (!skipBuild) {
  runStep('build', 'build', npmCmd, ['run', 'build', '--', '--pretty', 'false']);
}

if (!skipWeb) {
  runStep('web-smoke', 'web smoke', npmCmd, ['run', 'test:web:smoke']);
}

runStep('channels-doctor', 'channels doctor', npmCmd, ['run', 'test:channels:smoke']);
runStep('node-mesh-smoke', 'node mesh smoke', npmCmd, ['run', 'test:nodes:smoke']);
runStep('remote-transports-doctor', 'remote transports doctor', npmCmd, ['run', 'test:transports:smoke']);

writeReport('passed');
