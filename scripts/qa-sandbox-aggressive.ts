import { DeepSandboxIsolationService } from '../src/domain/trust-governance/infrastructure/DeepSandboxIsolationService.js';

function main(): void {
  const service = new DeepSandboxIsolationService();
  const snapshot = service.buildSnapshot({ aggressiveOptIn: true });
  const decision = service.resolveDecision({
    executor: 'local',
    instructions: ['npm test'],
    metadata: { sourceChannel: 'wave7-smoke' },
  } as any, {
    aggressiveOptIn: true,
  });

  const canExerciseDeepTier = snapshot.preferredTier === 'microvm' || snapshot.preferredTier === 'container';
  const skipped = !canExerciseDeepTier;

  console.log(JSON.stringify({
    ok: true,
    skipped,
    posture: snapshot.posture,
    preferredTier: snapshot.preferredTier,
    decision,
    summary: snapshot.summary,
    nextAction: snapshot.nextAction,
  }, null, 2));
}

main();
