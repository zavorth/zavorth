#!/usr/bin/env node

import path from 'path';
import { findProjectRoot } from '../src/config/configHelpers.js';
import { MinimalCapabilityActivationPlanner } from '../src/core/MinimalCapabilityActivationPlanner.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const strict = argv.includes('--strict');
  const apply = argv.includes('--apply');
  const projectRoot = findProjectRoot();
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
    || process.env.ZAVORTH_RUNTIME_PROFILE
    || process.env.ZAVORTH_PROFILE
    || 'minimal';
  const capability = argv.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=')
    || argv.find((arg) => !arg.startsWith('--'));
  const manifestDir = argv.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'capability-manifests');
  const profileDir = argv.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'runtime-profiles');
  const planner = new MinimalCapabilityActivationPlanner({
    projectRoot,
    manifestDir,
    profileDir,
    dataDir: path.resolve(projectRoot, 'data', 'runtime'),
  });

  if (capability) {
    const result = await planner.activate(capability, {
      profile,
      apply,
      operation: apply ? 'activate' : 'plan',
    });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] capability activation doctor',
        `[zavorth-core] profile: ${result.plan.profileId} | capability: ${result.plan.capabilityId} | status: ${result.plan.status} | mode: ${result.plan.mode}`,
        `[zavorth-core] action: ${result.plan.action}`,
        result.message ? `[zavorth-core] result: ${result.message}` : null,
        ...result.plan.reasons.map((reason) => `- reason: ${reason}`),
        ...result.plan.nextSteps.map((nextStep) => `- next: ${nextStep}`),
      ].filter(Boolean).join('\n') + '\n');
    }
    process.exitCode = strict && ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    return;
  }

  const report = planner.buildReport(profile);
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] capability activation doctor',
      `[zavorth-core] status: ${report.status} | profile: ${report.profileId} | contract: ${report.contractStatus}`,
      `[zavorth-core] plans: total ${report.total} | active ${report.active} | ready ${report.ready} | manual ${report.manual} | disabled ${report.disabled} | invalidEnabled ${report.invalidEnabled}`,
      ...report.plans.map((plan) => `- ${plan.capabilityId}: ${plan.status}/${plan.mode} | ${plan.action}`),
    ].join('\n') + '\n');
  }
  process.exitCode = report.status === 'failed' || (strict && report.invalidEnabled > 0) ? 1 : 0;
}

main().catch((error) => {
  console.error('[zavorth-core] capability activation doctor falhou.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
