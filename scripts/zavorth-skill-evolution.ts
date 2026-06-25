import { ZavorthSkillEvolutionService } from '@zavorth/skills/ZavorthSkillEvolutionService.js';

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
  const originalConsole = {
    log: console.log,
    info: console.info,
  };
  if (asJson) {
    console.log = () => undefined;
    console.info = () => undefined;
  }

  const service = new ZavorthSkillEvolutionService();
  const intent = readFlag(argv, ['--intent', '--text']);
  const demonstration = readFlag(argv, ['--demo', '--demonstration']);
  const applyPlanId = readFlag(argv, ['--apply']);
  const rollbackDraftId = readFlag(argv, ['--rollback']);
  const procedureOnly = argv.includes('--procedure-only') || argv.includes('--procedure');

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
      console.log('[skill-evolution] apply oficial');
      console.log(`[skill-evolution] status=${result.status} | ok=${result.ok ? 'yes' : 'no'}`);
      console.log(`[skill-evolution] resumo: ${result.summary}`);
      for (const detail of result.details) {
        console.log(`- ${detail}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (rollbackDraftId) {
    const result = service.rollback({
      draftId: rollbackDraftId,
      requestedBy: 'cli-operator',
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[skill-evolution] rollback oficial');
      console.log(`[skill-evolution] status=${result.status} | ok=${result.ok ? 'yes' : 'no'}`);
      console.log(`[skill-evolution] resumo: ${result.summary}`);
      for (const detail of result.details) {
        console.log(`- ${detail}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (intent || argv.includes('--preview')) {
    const result = await service.preview({
      intentText: intent || 'aprenda um procedimento local seguro e gere um draft',
      demonstration,
      requestedBy: 'cli-operator',
      sourceSurface: 'cli',
      procedureOnly,
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log('[skill-evolution] preview oficial');
      console.log(`[skill-evolution] status=${result.status} | ok=${result.ok ? 'yes' : 'no'}`);
      console.log(`[skill-evolution] skill=${result.record.skillName} | draft=${result.record.id}`);
      console.log(`[skill-evolution] resumo: ${result.summary}`);
      for (const detail of result.details) {
        console.log(`- ${detail}`);
      }
    }
    if (requirePass && result.status === 'blocked') {
      process.exitCode = 1;
    }
    return;
  }

  const snapshot = service.buildSnapshot();
  if (asJson) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[skill-evolution] leitura oficial de Auto-Skill Evolution');
    console.log(`[skill-evolution] postura=${snapshot.summary.posture} | total=${snapshot.summary.total}`);
    console.log(`[skill-evolution] drafts=${snapshot.summary.drafts} | waiting=${snapshot.summary.waitingApproval} | trusted=${snapshot.summary.trustedLocal} | blocked=${snapshot.summary.blocked}`);
    console.log(`[skill-evolution] target=${snapshot.policy.installTargetRoot}`);
    console.log('[skill-evolution] pipeline:');
    console.log(snapshot.pipeline.join(' -> '));
    if (snapshot.records.length > 0) {
      console.log('[skill-evolution] recentes:');
      for (const record of snapshot.records.slice(0, 5)) {
        console.log(`- ${record.skillName}: ${record.status} | ${record.id}`);
      }
    }
  }
  if (requirePass && snapshot.summary.posture === 'critical') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[skill-evolution] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
