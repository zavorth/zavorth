#!/usr/bin/env node

import { ZavorthHubActionService } from '../src/services/ZavorthHubActionService.js';
import { ZavorthHubControlPlaneService } from '../src/services/ZavorthHubControlPlaneService.js';

function readFlag(argv: string[], names: string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    for (const name of names) {
      if (token === name) {
        return String(argv[index + 1] || '').trim() || null;
      }
      if (token.startsWith(`${name}=`)) {
        return String(token.slice(name.length + 1) || '').trim() || null;
      }
    }
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const query = readFlag(argv, ['--query', '--q']);
  const selectedId = readFlag(argv, ['--selected', '--selected-id', '--id']);
  const recommendFor = readFlag(argv, ['--recommend', '--recommend-for']);
  const actionId = readFlag(argv, ['--action', '--run']);
  const service = new ZavorthHubControlPlaneService();
  const snapshot = service.buildSnapshot({ selectedId, query, recommendFor });

  if (actionId) {
    const execution = await new ZavorthHubActionService({
      hubControlPlaneService: service,
    }).execute({
      actionId,
      selectedId,
      query,
      recommendFor,
      workspace: process.cwd(),
    });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(execution, null, 2)}\n`);
      return;
    }
    console.log('[zavorth-hub] action plane oficial');
    console.log(`[zavorth-hub] action=${execution.actionId} | status=${execution.status}`);
    console.log(`[zavorth-hub] summary: ${execution.summary}`);
    if (execution.details.length > 0) {
      console.log('[zavorth-hub] detalhes:');
      for (const detail of execution.details.slice(0, 6)) {
        console.log(`- ${detail}`);
      }
    }
    console.log(`[zavorth-hub] next passo: ${execution.hub.narrative.nextAction}`);
    return;
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-hub] read consolidada do hub');
  console.log(`[zavorth-hub] postura: ${snapshot.summary.posture}`);
  console.log(`[zavorth-hub] summary: ${snapshot.narrative.operatorSummary}`);
  console.log(
    `[zavorth-hub] integrations=${snapshot.summary.integrations} | plugins=${snapshot.summary.plugins} | skills=${snapshot.summary.skillsVisible} | mcp=${snapshot.summary.mcpConnected}/${snapshot.summary.mcpServers}`,
  );
  console.log(`[zavorth-hub] registry: ${snapshot.sync.status} | ${snapshot.sync.summary}`);

  if (snapshot.actions.length > 0) {
    console.log('[zavorth-hub] actions sugeridas:');
    for (const action of snapshot.actions.slice(0, 5)) {
      console.log(`- ${action.label}: ${action.command || action.rationale}`);
    }
  }

  if (snapshot.featured.length > 0) {
    console.log('[zavorth-hub] itens em destaque:');
    for (const item of snapshot.featured.slice(0, 5)) {
      console.log(`- ${item.label} [${item.surface}]`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-hub] failure ao montar a read consolidada.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
