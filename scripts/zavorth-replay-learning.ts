import { ZavorthReplayLearningService } from '../src/services/ZavorthReplayLearningService.js';

function readFlag(argv: string[], names: string[]): string | null {
  for (const name of names) {
    const inline = argv.find((entry) => entry.startsWith(`${name}=`));
    if (inline) {
      return inline.split('=').slice(1).join('=').trim() || null;
    }
    const index = argv.findIndex((entry) => entry === name);
    if (index >= 0 && argv[index + 1]) {
      return String(argv[index + 1]).trim() || null;
    }
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
  const limit = Number(readFlag(argv, ['--limit']) || 8);
  const service = new ZavorthReplayLearningService();
  const originalConsole = {
    log: console.log,
    info: console.info,
  };
  if (asJson) {
    console.log = () => undefined;
    console.info = () => undefined;
  }

  const replayPath = readFlag(argv, ['--replay', '--cast', '--file']);
  const replayText = readFlag(argv, ['--text', '--transcript']);
  const applyPlanId = readFlag(argv, ['--apply']);
  const revokeRecordId = readFlag(argv, ['--revoke', '--delete']);
  const suggestObjective = readFlag(argv, ['--suggest']);
  const suggestOnly = argv.includes('--suggest-only') || argv.includes('--preview-only');
  const exportProfile = argv.includes('--export-profile');

  if (applyPlanId) {
    const result = await service.apply({
      planId: applyPlanId,
      requestedBy: 'cli-operator',
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[replay-learning] apply oficial');
      console.log(`[replay-learning] status=${result.status} | ok=${result.ok ? 'yes' : 'no'}`);
      console.log(`[replay-learning] resumo: ${result.summary}`);
      for (const detail of result.details) {
        console.log(`- ${detail}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (revokeRecordId) {
    const result = service.revoke({
      recordId: revokeRecordId,
      requestedBy: 'cli-operator',
      reason: readFlag(argv, ['--reason']),
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[replay-learning] revogacao oficial');
      console.log(`[replay-learning] status=${result.status} | ok=${result.ok ? 'yes' : 'no'}`);
      console.log(`[replay-learning] resumo: ${result.summary}`);
      for (const detail of result.details) {
        console.log(`- ${detail}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (suggestObjective) {
    const result = service.suggest({ objective: suggestObjective });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[replay-learning] gemeo digital suggest-only');
      console.log(`[replay-learning] objetivo: ${result.objective}`);
      for (const suggestion of result.suggestions) {
        console.log(`- ${suggestion}`);
      }
    }
    return;
  }

  if (exportProfile) {
    const result = service.exportProfile();
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[replay-learning] perfil local exportavel');
      console.log(`mode=${result.mode} | approved=${result.approvedRecordIds.length} | revoked=${result.revokedRecordIds.length}`);
    }
    return;
  }

  if (replayPath || replayText) {
    const result = await service.preview({
      replayPath,
      replayText,
      requestedBy: 'cli-operator',
      sourceSurface: 'cli',
      suggestOnly: suggestOnly ? true : false,
      limit,
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[replay-learning] preview oficial');
      console.log(`[replay-learning] status=${result.status} | ok=${result.ok ? 'yes' : 'no'}`);
      console.log(`[replay-learning] resumo: ${result.summary}`);
      for (const record of result.records) {
        console.log(`- ${record.kind}: ${record.summary} | ${record.status} | ${record.id}`);
      }
      for (const detail of result.details) {
        console.log(`  ${detail}`);
      }
    }
    if (requirePass && result.status === 'blocked') {
      process.exitCode = 1;
    }
    return;
  }

  const snapshot = service.buildSnapshot({ limit });
  if (asJson) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[replay-learning] leitura oficial da Fase 20');
    console.log(`[replay-learning] postura: ${snapshot.summary.posture}`);
    console.log(`[replay-learning] resumo: ${snapshot.narrative.operatorSummary}`);
    console.log(`[replay-learning] replay: ${snapshot.summary.timelineEvents} evento(s) | compare ${snapshot.summary.compareReady ? 'pronto' : 'nao pronto'} | resume ${snapshot.summary.resumeReady ? 'pronto' : 'sem alvo'}`);
    console.log(`[replay-learning] learning: ${snapshot.summary.learningCandidates} candidato(s) | ${snapshot.summary.pendingLearning} pendente(s) | ${snapshot.summary.promotedLearning} aprovado(s)`);
    console.log(`[replay-learning] memory: ${snapshot.summary.memoryEntries} entrada(s) | ${snapshot.summary.proceduralEntries} procedimento(s) | pressao ${snapshot.summary.memoryPressure}`);
    console.log(`[replay-learning] proximo passo: ${snapshot.narrative.nextAction}`);
    if (snapshot.records.length > 0) {
      console.log('[replay-learning] recentes:');
      for (const record of snapshot.records.slice(0, limit)) {
        console.log(`- ${record.kind}: ${record.status} | ${record.id}`);
      }
    }
  }

  if (requirePass && snapshot.summary.posture === 'critical') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[replay-learning] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
