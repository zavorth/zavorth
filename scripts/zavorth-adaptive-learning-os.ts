import { ZavorthAdaptiveLearningOsService } from '../src/services/ZavorthAdaptiveLearningOsService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const strict = args.includes('--strict');

function readFlag(name: string): string | null {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

async function main(): Promise<void> {
  const service = new ZavorthAdaptiveLearningOsService();
  const observation = readFlag('--observe') || readFlag('--observation');
  const originalLog = console.log;
  if (json) console.log = () => undefined;
  let snapshot;
  try {
    snapshot = observation
      ? await service.ingestObservation({
        observation,
        userId: readFlag('--user') || 'zavorth-runtime',
        sessionId: readFlag('--session'),
        workspace: readFlag('--workspace') || process.cwd(),
        sourceSurface: readFlag('--surface') || 'cli',
      })
      : await service.buildSnapshot();
  } finally {
    console.log = originalLog;
  }

  if (strict) {
    const failures = [
      snapshot.contractVersion !== '2026-06-04.adaptive-learning-os.v1' ? 'unexpected contract version' : '',
      snapshot.safety.localOnly ? '' : 'learning is not local-only',
      snapshot.safety.redLaneNeverSilent ? '' : 'red lane can run silently',
      snapshot.safety.rawPsychologicalDiagnosisBlocked ? '' : 'psychological diagnosis is not blocked',
      snapshot.invariants.userModelClaimsCarryEvidence ? '' : 'user model has no evidence invariant',
      snapshot.invariants.autoSkillsStartAsDrafts ? '' : 'auto skills do not start as drafts',
      snapshot.invariants.shadowLearningBeforePromotion ? '' : 'shadow learning is not required before promotion',
      snapshot.lanes.red.mode === 'approval' ? '' : 'red lane is not approval-bound',
    ].filter(Boolean);
    if (failures.length > 0) {
      throw new Error(`Adaptive Learning OS check failed: ${failures.join('; ')}`);
    }
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${service.renderText(snapshot)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
