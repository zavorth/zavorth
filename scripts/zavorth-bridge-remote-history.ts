#!/usr/bin/env node

import { config } from '../src/config/index.js';
import { ZavorthBridgeRemoteDoctorHistoryService } from '../src/services/ZavorthBridgeRemoteDoctorHistoryService.js';

function parseLimit(argv: string[]): number {
  const raw = argv.find((entry) => entry.startsWith('--limit='));
  if (!raw) {
    return 8;
  }

  const parsed = Number(raw.split('=')[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const limit = parseLimit(argv);
  const service = new ZavorthBridgeRemoteDoctorHistoryService();
  const history = service.readHistory(config.zavorthBridgeRemoteDoctorHistoryFile);
  const summary = service.summarize(history, limit);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-bridge-remote] history');
  console.log(
    `[zavorth-bridge-remote] total=${summary.totalRuns} | repaired=${summary.repairedRuns} | ready=${summary.readyRuns} | degraded=${summary.degradedRuns}`,
  );
  console.log(
    `[zavorth-bridge-remote] stability: flapping=${summary.stability.flappingLikely ? 'yes' : 'no'} | dominant=${summary.stability.dominantIncidentCode || 'n/d'} | matchingRecentFailures=${summary.stability.matchingRecentFailures}`,
  );

  if (!summary.latest) {
    console.log('[zavorth-bridge-remote] without execucoes registradas.');
    return;
  }

  console.log('[zavorth-bridge-remote] recentes:');
  for (const entry of summary.recent) {
    console.log(
      `- ${entry.checkedAt} | ready=${entry.readyAfter ? 'yes' : 'no'} | repaired=${entry.repaired ? 'yes' : 'no'} | incident=${entry.primaryIncidentCode}/${entry.incidentSeverity} | summary=${entry.summary}`,
    );
  }
}

main();
