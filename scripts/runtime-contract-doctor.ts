#!/usr/bin/env node

import path from 'path';
import { findProjectRoot } from '../src/config/configHelpers.js';
import { MinimalRuntimeContractService } from '../src/core/MinimalRuntimeContractService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const strict = argv.includes('--strict');
  const projectRoot = findProjectRoot();
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
    || process.env.ZAVORTH_RUNTIME_PROFILE
    || process.env.ZAVORTH_PROFILE
    || 'minimal';
  const manifestDir = argv.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'capability-manifests');
  const profileDir = argv.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'runtime-profiles');
  const report = new MinimalRuntimeContractService({
    projectRoot,
    manifestDir,
    profileDir,
  }).buildReport(profile);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] runtime contract doctor',
      `[zavorth-core] status: ${report.status} | selected profile: ${report.selectedProfileId}`,
      `[zavorth-core] capabilities: declared ${report.capabilitySummary.declared} | kernel ${report.capabilitySummary.kernel} | manifest ${report.capabilitySummary.manifest} | boot ${report.capabilitySummary.activeOnBoot} | sidecars ${report.capabilitySummary.sidecars}`,
      `[zavorth-core] profiles: total ${report.profileSummary.total} | builtin ${report.profileSummary.builtin} | manifest ${report.profileSummary.manifest} | invalid ${report.profileSummary.invalid}`,
      ...report.profileSummary.profiles.map((profileSummary) =>
        `- profile ${profileSummary.id}: posture=${profileSummary.resourcePosture} | polling=${profileSummary.pollingMode} | boot=${profileSummary.activeOnBoot} | on-demand=${profileSummary.onDemand} | sidecars=${profileSummary.sidecars}`,
      ),
      ...report.issues.slice(0, 20).map((issue) =>
        `! ${issue.severity} ${issue.id} ${issue.subject}: ${issue.message}`,
      ),
    ].join('\n') + '\n');
  }

  process.exitCode = report.status === 'failed' || (strict && report.status === 'warning') ? 1 : 0;
}

main().catch((error) => {
  console.error('[zavorth-core] runtime contract doctor failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
