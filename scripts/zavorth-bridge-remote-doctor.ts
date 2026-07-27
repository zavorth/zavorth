#!/usr/bin/env node

import { ZavorthBridgeRemoteDoctorService } from '../src/services/ZavorthBridgeRemoteDoctorService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const repair = argv.includes('--repair');
  const forceRepair = argv.includes('--force');
  const service = new ZavorthBridgeRemoteDoctorService();
  const report = await service.run(repair, forceRepair);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-bridge-remote] doctor');
  console.log(`[zavorth-bridge-remote] summary: ${report.summary}`);
  console.log(
    `[zavorth-bridge-remote] ready before=${report.readyBefore ? 'yes' : 'no'} | after=${report.readyAfter ? 'yes' : 'no'} | repair=${report.repaired ? 'yes' : 'no'}`,
  );
  console.log(
    `[zavorth-bridge-remote] incidente: inicial=${report.initialIncidents.primaryCode}/${report.initialIncidents.severity} | final=${report.finalIncidents.primaryCode}/${report.finalIncidents.severity}`,
  );
  console.log(
    `[zavorth-bridge-remote] policy: cooldown=${report.repairPolicy.cooldownActive ? 'active' : 'no'} | flapping=${report.repairPolicy.flappingLikely ? 'yes' : 'no'} | recentFailures=${report.repairPolicy.matchingRecentFailures}`,
  );
  if (report.forceRepair) {
    console.log('[zavorth-bridge-remote] policy override: force=yes');
  }
  if (report.repairPolicy.reason) {
    console.log(`[zavorth-bridge-remote] policy note: ${report.repairPolicy.reason}`);
  }

  if (report.actions.length > 0) {
    console.log('[zavorth-bridge-remote] actions:');
    for (const action of report.actions) {
      console.log(
        `- ${action.key}: ${action.ok ? 'ok' : 'failed'} | changed=${action.changed ? 'yes' : 'no'} | ${action.message}`,
      );
    }
  }

  if (report.remainingRecommendations.length > 0) {
    console.log('[zavorth-bridge-remote] pending items restantes:');
    for (const recommendation of report.remainingRecommendations) {
      console.log(`- ${recommendation}`);
    }
  }

  console.log(`[zavorth-bridge-remote] playbook: ${report.playbook.title} | urgency=${report.playbook.urgency}`);
  if (report.playbook.automaticActions.length > 0) {
    console.log('[zavorth-bridge-remote] automatic actions:');
    for (const action of report.playbook.automaticActions) {
      console.log(`- ${action}`);
    }
  }
  if (report.playbook.manualSteps.length > 0) {
    console.log('[zavorth-bridge-remote] manual steps:');
    for (const step of report.playbook.manualSteps) {
      console.log(`- ${step}`);
    }
  }
  console.log(`[zavorth-bridge-remote] retry guidance: ${report.playbook.retryGuidance}`);
  if (report.playbook.escalation) {
    console.log(`[zavorth-bridge-remote] escalation: ${report.playbook.escalation}`);
  }
}

main().catch((error) => {
  console.error(`[zavorth-bridge-remote] doctor failed: ${error.message || error}`);
  process.exitCode = 1;
});
