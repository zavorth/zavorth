import { ZavorthNaturalSetupControlPlaneService } from '../src/services/ZavorthNaturalSetupControlPlaneService.js';
import { NaturalSetupMutationPlannerService } from '../src/services/NaturalSetupMutationPlannerService.js';

function readFlag(argv: string[], name: string): string | null {
  const normalizedName = name.replace(/^--/, '');
  const inline = argv.find((entry) => entry.startsWith(`--${normalizedName}=`));
  if (inline) {
    return inline.split('=').slice(1).join('=').trim() || null;
  }
  const index = argv.findIndex((entry) => entry === `--${normalizedName}`);
  if (index >= 0 && argv[index + 1]) {
    return String(argv[index + 1]).trim() || null;
  }
  return null;
}

function redirectConsoleLogsForJson(enabled: boolean): () => void {
  if (!enabled) {
    return () => {};
  }
  const original = console.log;
  console.log = (...args: unknown[]) => {
    console.error(...args);
  };
  return () => {
    console.log = original;
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new ZavorthNaturalSetupControlPlaneService();
  const intentText = readFlag(argv, '--intent') || readFlag(argv, '--text');
  const channelId = readFlag(argv, '--channel');
  const mode = readFlag(argv, '--mode');
  const requestedBy = readFlag(argv, '--requested-by') || 'cli-user';
  const applyPlanId = readFlag(argv, '--apply-plan') || readFlag(argv, '--plan-id');
  const wantsMutationPreview = argv.includes('--preview')
    || argv.includes('--plan')
    || argv.includes('--apply')
    || argv.includes('--doctor')
    || argv.includes('--test');

  if (applyPlanId) {
    const planner = new NaturalSetupMutationPlannerService({
      controlPlaneService: service,
    });
    const restoreLogs = redirectConsoleLogsForJson(asJson);
    const applied = await planner.apply({ planId: applyPlanId, requestedBy }).finally(restoreLogs);
    if (asJson) {
      process.stdout.write(`${JSON.stringify(applied, null, 2)}\n`);
    } else {
      console.log('[natural-setup] apply supervised de mutation plan');
      console.log(applied.summary);
      console.log(`Status: ${applied.status}.`);
      console.log(`Plan: ${applied.mutationPlan?.id || applyPlanId}.`);
    }
    if (!applied.ok) {
      process.exitCode = applied.status === 'waiting_approval' ? 0 : 1;
    }
    return;
  }

  if (wantsMutationPreview) {
    const planner = new NaturalSetupMutationPlannerService({
      controlPlaneService: service,
    });
    const restoreLogs = redirectConsoleLogsForJson(asJson);
    const preview = await planner.preview({
      intentText,
      channelId,
      mode,
      apply: argv.includes('--apply'),
      doctor: argv.includes('--doctor'),
      test: argv.includes('--test'),
      localOnly: argv.includes('--local-only'),
      requestedBy,
      sourceSurface: 'cli',
    }).finally(restoreLogs);
    if (asJson) {
      process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    } else {
      console.log('[natural-setup] preview-first de mutation plan');
      console.log(preview.snapshot.narrative.operatorSummary);
      console.log(`Plan: ${preview.mutationPlan.id}`);
      console.log(`Status: ${preview.mutationPlan.status}`);
      console.log(`Trust: ${preview.trustDecision.decision} | ${preview.trustDecision.reason}`);
      console.log('To apply after approval: npm run ops:natural-setup -- --apply-plan <planId>');
    }
    if (preview.trustDecision.decision === 'blocked') {
      process.exitCode = 1;
    }
    return;
  }

  const snapshot = await service.buildSnapshot({
    intentText,
    channelId,
    mode,
    autoApply: argv.includes('--apply'),
    autoDoctor: argv.includes('--doctor'),
    autoTest: argv.includes('--test'),
    localOnly: argv.includes('--local-only'),
    operationMode: argv.includes('--explain') ? 'explain' : null,
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[natural-setup] read natural-first do setup de channels');
    console.log(await service.renderReport({
      intentText,
      channelId,
      mode,
      autoApply: argv.includes('--apply'),
      autoDoctor: argv.includes('--doctor'),
      autoTest: argv.includes('--test'),
      localOnly: argv.includes('--local-only'),
    }));
  }

  if (snapshot.summary.posture === 'critical') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[natural-setup] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
