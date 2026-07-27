#!/usr/bin/env node

import { RuntimeBootstrapRepairService } from '../src/services/RuntimeBootstrapRepairService.js';
import { RuntimeBootstrapService } from '../src/services/RuntimeBootstrapService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const shouldRepair = argv.includes('--repair');
  const dryRun = argv.includes('--dry-run');

  if (shouldRepair) {
    const repairService = new RuntimeBootstrapRepairService();
    const repair = await repairService.repairLive({ dryRun });

    if (asJson) {
      process.stdout.write(`${JSON.stringify(repair, null, 2)}\n`);
      return;
    }

    console.log('[zavorth-bootstrap] safe repair');
    console.log(`[zavorth-bootstrap] initial summary: ${repair.initial.summary}`);
    if (repair.steps.length === 0) {
      console.log('[zavorth-bootstrap] no safe correction available.');
    } else {
      console.log('[zavorth-bootstrap] actions seguras:');
      for (const step of repair.steps) {
        console.log(`- ${step.title} -> ${step.command}`);
        console.log(`  status=${step.status} | duraction=${step.durationMs}ms`);
        if (step.error) {
          console.log(`  error: ${step.error}`);
        } else if (step.output) {
          console.log(`  output: ${truncate(step.output)}`);
        }
      }
    }
    console.log(`[zavorth-bootstrap] final summary: ${repair.summary}`);
    if (repair.final.actions.length > 0) {
      console.log('[zavorth-bootstrap] passos restantes:');
      for (const action of repair.final.actions) {
        console.log(`- ${action.title} -> ${action.command}`);
        console.log(`  ${action.reason}`);
      }
    }
    return;
  }

  const service = new RuntimeBootstrapService();
  const report = await service.inspectLive();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-bootstrap] estado do bootstrap');
  console.log(`[zavorth-bootstrap] summary: ${report.summary}`);
  console.log(
    `[zavorth-bootstrap] .env: ${report.env.envFilePresent ? 'ok' : 'missing'} | provider=${report.env.llmProvider} | credential=${report.env.llmCredentialReady ? 'ok' : 'pending'}`,
  );
  console.log(
    `[zavorth-bootstrap] dependencies: ${report.dependencies.installRequired ? 'npm install pending' : 'ok'} | build=${report.dependencies.buildRequired ? 'pending' : 'ok'}`,
  );
  console.log(
    `[zavorth-bootstrap] local: ${report.supervisedRuntime.accessReadiness.local.ready ? 'ready' : 'pending'} | remote: ${report.supervisedRuntime.accessReadiness.remote.ready ? 'ready' : 'pending'}`,
  );
  console.log(
    `[zavorth-bootstrap] node mesh smoke: ${
      report.supervisedRuntime.accessReadiness.runtime.nodeMeshSmoke.status
    } | ${
      report.supervisedRuntime.accessReadiness.runtime.nodeMeshSmoke.summary
      || report.supervisedRuntime.accessReadiness.runtime.nodeMeshSmoke.file
      || report.supervisedRuntime.accessReadiness.runtime.nodeMeshSmoke.command
    }`,
  );

  if (report.env.issues.length > 0) {
    console.log('[zavorth-bootstrap] configuration:');
    for (const issue of report.env.issues) {
      console.log(`- ${issue}`);
    }
  }

  if (report.actions.length > 0) {
    console.log('[zavorth-bootstrap] proximos passos:');
    for (const action of report.actions) {
      console.log(`- ${action.title} -> ${action.command}`);
      console.log(`  ${action.reason}`);
    }
  }
}

function truncate(input: string, max = 160): string {
  const normalized = String(input || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1)}...`;
}

main().catch((error) => {
  console.error('[zavorth-bootstrap] failure ao inspecionar o bootstrap do runtime.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
