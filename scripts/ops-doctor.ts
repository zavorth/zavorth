#!/usr/bin/env node

import { RuntimeAccessReadinessService } from '../src/runtime/access/RuntimeAccessReadinessService.js';
import { RuntimeBootstrapRepairService } from '../src/runtime/access/RuntimeBootstrapRepairService.js';

function formatDoctorLine(label: string, status: string, summary: string | null, command: string) {
  const detail = summary || command || 'n/d';
  return `[zavorth-ops] ${label}: ${status} | ${detail}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const fix = argv.includes('--fix') || argv.includes('-f') || argv.includes('--repair');
  const dryRun = argv.includes('--dry-run') || argv.includes('--dryrun');

  if (fix) {
    console.log(`[zavorth-ops] Starting Doctor Auto-Repair...${dryRun ? ' (Dry Run)' : ''}`);
    const repairService = new RuntimeBootstrapRepairService();
    const repairReport = await repairService.repairLive({ dryRun });
    console.log(`[zavorth-ops] Repair summary: ${repairReport.summary}`);
    for (const step of repairReport.steps) {
      console.log(`[zavorth-ops] Step: ${step.title} | Status: ${step.status} | Command: ${step.command}`);
      if (step.output) {
        console.log(`  Output: ${step.output}`);
      }
      if (step.error) {
        console.log(`  Error: ${step.error}`);
      }
    }
    console.log('[zavorth-ops] Doctor Auto-Repair completed.\n');
  }

  const service = new RuntimeAccessReadinessService();
  const report = await service.inspectLive();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.local.ready || report.runtime.nodeMeshSmoke.status === 'failed') {
      process.exitCode = 1;
    }
    return;
  }

  console.log('[zavorth-ops] doctor geral');
  console.log(`[zavorth-ops] summary: ${report.summary}`);
  console.log(
    `[zavorth-ops] local: ${report.local.ready ? 'ready' : 'pending'} | remote: ${report.remote.ready ? 'ready' : 'pending'}`,
  );
  console.log(
    formatDoctorLine(
      'node mesh',
      report.runtime.nodeMeshSmoke.status,
      report.runtime.nodeMeshSmoke.summary,
      report.runtime.nodeMeshSmoke.command,
    ),
  );
  console.log(
    formatDoctorLine(
      'system overlord',
      report.runtime.systemOverlordSmoke.status,
      report.runtime.systemOverlordSmoke.summary,
      report.runtime.systemOverlordSmoke.command,
    ),
  );
  console.log(
    formatDoctorLine(
      'channels',
      report.runtime.channelProviderDoctor.status,
      report.runtime.channelProviderDoctor.summary,
      report.runtime.channelProviderDoctor.command,
    ),
  );
  console.log(
    formatDoctorLine(
      'transportes',
      report.runtime.remoteTransportDoctor.status,
      report.runtime.remoteTransportDoctor.summary,
      report.runtime.remoteTransportDoctor.command,
    ),
  );

  if (report.nextSteps.length > 0) {
    console.log('[zavorth-ops] proximos passos:');
    for (const step of report.nextSteps.slice(0, 6)) {
      console.log(`- ${step.title}: ${step.description}`);
    }
  }

  if (report.recommendations.length > 0) {
    console.log('[zavorth-ops] recommendations:');
    for (const rec of report.recommendations.slice(0, 6)) {
      console.log(`- ${rec}`);
    }
  }

  const failed =
    !report.local.ready
    || report.runtime.nodeMeshSmoke.status === 'failed'
    || report.runtime.channelProviderDoctor.status === 'failed'
    || report.runtime.remoteTransportDoctor.status === 'failed';

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[zavorth-ops] doctor geral failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
