#!/usr/bin/env node

import { ZavorthAutonomousEngineeringPartnerService } from '../src/services/ZavorthAutonomousEngineeringPartnerService.js';
import type {
  ZavorthAutonomyLevel,
  AutonomousMissionEvidenceKind,
} from '../src/services/ZavorthAutonomousEngineeringPartnerService.js';
import type { ZavorthMutationRiskLevel } from '../src/contracts/ZavorthMutationPlaneContract.js';

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

function readList(argv: string[], names: string[]): string[] {
  const value = readFlag(argv, names);
  return value ? value.split(/\r?\n|,/u).map((entry) => entry.trim()).filter(Boolean) : [];
}

function readNumber(argv: string[], names: string[]): number | undefined {
  const value = readFlag(argv, names);
  if (!value) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function firstPositional(argv: string[]): string | null {
  const ignored = new Set([
    '--json',
    '--delegate',
    '--mission',
    '--mutable',
    '--approve',
    '--progress',
    '--pause',
    '--complete',
  ]);
  for (const value of argv) {
    if (!value.startsWith('--') && !ignored.has(value)) {
      return value;
    }
  }
  return null;
}

async function printJson(value: unknown): Promise<void> {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new ZavorthAutonomousEngineeringPartnerService();

  if (argv.includes('--delegate') || argv.includes('--mission')) {
    const objective = readFlag(argv, ['--objective', '--delegate', '--mission']) || firstPositional(argv) || '';
    const result = await service.delegateMission({
      objective,
      context: readFlag(argv, ['--context']),
      autonomyLevel: readFlag(argv, ['--level', '--autonomy']) as ZavorthAutonomyLevel | null,
      riskLevel: readFlag(argv, ['--risk']) as ZavorthMutationRiskLevel | null,
      requestedBy: 'cli-operator',
      sourceSurface: 'cli',
      successCriteria: readList(argv, ['--success', '--criteria']),
      mutable: argv.includes('--mutable') ? true : null,
      budget: {
        maxActions: readNumber(argv, ['--max-actions']),
        maxMutableActions: readNumber(argv, ['--max-mutable-actions']),
        maxCost: readNumber(argv, ['--max-cost']),
        maxDurationMs: readNumber(argv, ['--max-duration-ms']),
        maxNetworkCalls: readNumber(argv, ['--max-network-calls']),
        maxFilesystemWrites: readNumber(argv, ['--max-filesystem-writes']),
        maxExternalDeliveries: readNumber(argv, ['--max-external-deliveries']),
        pauseOnFailureCount: readNumber(argv, ['--pause-on-failure-count']),
      },
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[partner] missao delegada');
      console.log(`[partner] id=${result.mission.id} | status=${result.status} | level=${result.mission.autonomyLevel} | plan=${result.mutationPlan?.id || 'n/d'}`);
      console.log(`[partner] resumo: ${result.summary}`);
      console.log(`[partner] budget: actions=${result.mission.budget.maxActions}, mutable=${result.mission.budget.maxMutableActions}, durationMs=${result.mission.budget.maxDurationMs}`);
      if (result.readinessGate.blockers.length > 0) {
        console.log('[partner] blockers:');
        for (const blocker of result.readinessGate.blockers) {
          console.log(`- ${blocker}`);
        }
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const approveMission = readFlag(argv, ['--approve']);
  if (approveMission) {
    const result = await service.approveMission({
      missionId: approveMission,
      approvedBy: 'cli-operator',
      scope: readFlag(argv, ['--scope']) as any,
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[partner] missao aprovada');
      console.log(`[partner] status=${result.status} | resumo=${result.summary}`);
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const progressMission = readFlag(argv, ['--progress']);
  if (progressMission) {
    const result = await service.recordProgress({
      missionId: progressMission,
      actions: readNumber(argv, ['--actions']),
      mutableActions: readNumber(argv, ['--mutable-actions']),
      cost: readNumber(argv, ['--cost']),
      durationMs: readNumber(argv, ['--duration-ms']),
      networkCalls: readNumber(argv, ['--network-calls']),
      filesystemWrites: readNumber(argv, ['--filesystem-writes']),
      externalDeliveries: readNumber(argv, ['--external-deliveries']),
      failures: readNumber(argv, ['--failures']),
      riskLevel: readFlag(argv, ['--observed-risk', '--risk']),
      summary: readFlag(argv, ['--summary']),
      requestedBy: 'cli-operator',
      evidence: readFlag(argv, ['--evidence-summary'])
        ? {
          kind: readFlag(argv, ['--evidence-kind']) as AutonomousMissionEvidenceKind | null,
          status: readFlag(argv, ['--evidence-status']) as any,
          summary: readFlag(argv, ['--evidence-summary']),
          ref: readFlag(argv, ['--evidence-ref']),
        }
        : null,
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[partner] progresso registrado');
      console.log(`[partner] status=${result.status} | ok=${result.ok ? 'sim' : 'nao'}`);
      console.log(`[partner] resumo: ${result.summary}`);
      for (const blocker of result.blockers) {
        console.log(`- ${blocker}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const pauseMission = readFlag(argv, ['--pause']);
  if (pauseMission) {
    const result = await service.pauseMission({
      missionId: pauseMission,
      reason: readFlag(argv, ['--reason']),
      requestedBy: 'cli-operator',
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[partner] missao pausada');
      console.log(`[partner] status=${result.status} | resumo=${result.summary}`);
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const completeMission = readFlag(argv, ['--complete']);
  if (completeMission) {
    const result = await service.completeMission({
      missionId: completeMission,
      summary: readFlag(argv, ['--summary']),
      tests: readList(argv, ['--tests']),
      diffs: readList(argv, ['--diffs']),
      logs: readList(argv, ['--logs']),
      rollbackAvailable: argv.includes('--rollback-available'),
      rollbackPlan: readList(argv, ['--rollback-plan']),
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[partner] missao concluida');
      console.log(`[partner] status=${result.status} | ok=${result.ok ? 'sim' : 'nao'}`);
      console.log(`[partner] resumo: ${result.summary}`);
      for (const blocker of result.blockers) {
        console.log(`- ${blocker}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const snapshot = await service.buildSnapshot();
  if (asJson) {
    await printJson(snapshot);
  } else {
    console.log('[partner] leitura oficial do autonomous partner');
    console.log(`[partner] postura=${snapshot.summary.posture} | missoes=${snapshot.summary.missions} | ativas=${snapshot.summary.activeMissions} | pausadas=${snapshot.summary.pausedMissions}`);
    console.log(`[partner] approvals=${snapshot.summary.pendingMissionApprovals} | coreIdle=${snapshot.summary.coreIdle ? 'sim' : 'nao'} | heavy=${snapshot.summary.heavyRuntimesStarted ? 'sim' : 'nao'}`);
    console.log(`[partner] resumo: ${snapshot.narrative.operatorSummary}`);
    if (snapshot.actions.length > 0) {
      console.log('[partner] acoes sugeridas:');
      for (const action of snapshot.actions) {
        console.log(`- ${action.label}: ${action.command}`);
      }
    }
  }
}

main().catch((error) => {
  console.error('[partner] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
