#!/usr/bin/env node
import {
  buildContinuousSecurityMonitorReport,
  formatContinuousSecurityMonitorReport,
  writeContinuousSecurityBaseline,
} from '../src/security/ContinuousSecurityMonitor.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const strict = args.includes('--strict') || args.includes('--require-pass');
const requireBaseline = args.includes('--require-baseline');
const updateBaseline = args.includes('--update-baseline');
const baselinePath = readFlag('baseline');
const workspace = readFlag('workspace');
const projectRoot = readFlag('project-root') || process.cwd();

if (updateBaseline) {
  const baseline = writeContinuousSecurityBaseline({
    projectRoot,
    workspace,
    baselinePath,
  });
  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      baselinePath: baselinePath || 'config/security-continuous-baseline.json',
      baseline,
    }, null, 2)}\n`);
  } else {
    process.stdout.write('[zavorth-security] continuous security baseline updated\n');
    process.stdout.write(`[zavorth-security] updatedAt: ${baseline.updatedAt}\n`);
  }
  process.exit(0);
}

const report = buildContinuousSecurityMonitorReport({
  strict,
  requireBaseline,
  workspace,
  projectRoot,
  baselinePath,
});

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(formatContinuousSecurityMonitorReport(report));
}

process.exit(report.ok ? 0 : 1);

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] || null : null;
}
