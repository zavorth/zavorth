#!/usr/bin/env node

import { ZavorthEcosystemControlPlaneService } from '../src/services/ZavorthEcosystemControlPlaneService.js';

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
  const service = new ZavorthEcosystemControlPlaneService();
  const snapshot = service.buildSnapshot({ selectedId, query });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-ecosystem] leitura consolidada da Ecosystem');
  console.log(`[zavorth-ecosystem] postura: ${snapshot.summary.posture}`);
  console.log(`[zavorth-ecosystem] resumo: ${snapshot.narrative.operatorSummary}`);
  console.log(
    `[zavorth-ecosystem] registry=${snapshot.summary.registryEntries} | collections=${snapshot.summary.collections} | recipes=${snapshot.summary.recipes} | review=${snapshot.summary.reviewPending}`,
  );
  console.log(
    `[zavorth-ecosystem] sdk=${snapshot.summary.sdkFilesReady}/${snapshot.summary.sdkFilesExpected} | guides=${snapshot.summary.guidesReady}/${snapshot.summary.guidesExpected} | publish=${snapshot.summary.publishArtifacts}`,
  );
  console.log(
    `[zavorth-ecosystem] examples: clients=${snapshot.summary.clientExamples} | nodes=${snapshot.summary.nodeExamples} | recipe-missing=${snapshot.summary.recipeCoverageMissing}`,
  );
  console.log(`[zavorth-ecosystem] proximo passo: ${snapshot.narrative.nextAction}`);

  if (snapshot.actions.length > 0) {
    console.log('[zavorth-ecosystem] acoes sugeridas:');
    for (const action of snapshot.actions.slice(0, 6)) {
      console.log(`- ${action.label}: ${action.command || action.reason}`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-ecosystem] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
