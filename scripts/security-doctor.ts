#!/usr/bin/env node
import {
  buildOperationalSecurityDoctorReport,
  formatOperationalSecurityDoctorReport,
} from '../src/security/OperationalSecurityDoctor.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const strict = args.includes('--strict') || args.includes('--require-pass');
const workspaceArg = readFlag('workspace');
const projectRootArg = readFlag('project-root');

const report = buildOperationalSecurityDoctorReport({
  strict,
  workspace: workspaceArg,
  projectRoot: projectRootArg || process.cwd(),
});

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(formatOperationalSecurityDoctorReport(report));
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
