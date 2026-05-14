import { ZavorthWatchModeControlPlaneService } from '../src/services/ZavorthWatchModeControlPlaneService.js';
import { ComputerUseWatchModePolicyFileService } from '../src/services/ComputerUseWatchModePolicyFileService.js';
import { ComputerUseWatchModeService } from '../src/services/ComputerUseWatchModeService.js';

function readFlag(argv: string[], name: string): string | null {
  const inline = argv.find((entry) => entry.startsWith(`${name}=`));
  if (inline) {
    return inline.split('=').slice(1).join('=').trim() || null;
  }
  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0 && argv[index + 1]) {
    return String(argv[index + 1]).trim() || null;
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const strict = readFlag(argv, '--strict');
  const allowApp = readFlag(argv, '--allow-app');
  const allowSite = readFlag(argv, '--allow-site');
  const applyPlanId = readFlag(argv, '--apply');
  const targetWindow = readFlag(argv, '--target-window') || readFlag(argv, '--targetWindow');
  const objective = readFlag(argv, '--objective') || readFlag(argv, '--intent');
  const maxIterations = Number(readFlag(argv, '--max-iterations') || readFlag(argv, '--maxIterations') || 0) || null;
  const maxDurationMs = Number(readFlag(argv, '--max-duration-ms') || readFlag(argv, '--maxDurationMs') || 0) || null;
  const maxScreenshots = Number(readFlag(argv, '--max-screenshots') || readFlag(argv, '--maxScreenshots') || 0) || null;
  const maxMemoryMb = Number(readFlag(argv, '--max-memory-mb') || readFlag(argv, '--maxMemoryMb') || 0) || null;
  const idleTtlMs = Number(readFlag(argv, '--idle-ttl-ms') || readFlag(argv, '--idleTtlMs') || 0) || null;
  const screenshotTtlMs = Number(readFlag(argv, '--screenshot-ttl-ms') || readFlag(argv, '--screenshotTtlMs') || 0) || null;
  const maxScreenshotBytes = Number(readFlag(argv, '--max-screenshot-bytes') || readFlag(argv, '--maxScreenshotBytes') || 0) || null;
  const screenshotRedactionMode = readFlag(argv, '--redaction') || readFlag(argv, '--screenshot-redaction-mode');
  const sensitiveScreenPolicy = readFlag(argv, '--sensitive-screen') || readFlag(argv, '--sensitive-screen-policy');
  const limit = Math.max(1, Number(readFlag(argv, '--limit') || 8) || 8);
  const policyFileService = new ComputerUseWatchModePolicyFileService();
  const watchService = new ComputerUseWatchModeService({
    policyFileService,
    createAgent: () => {
      throw new Error('CLI Watch Mode nao inicia agente visual direto; use apply de plan aprovado no runtime web.');
    },
  });
  let actionResult: any = null;

  if (applyPlanId) {
    actionResult = await watchService.applyMutationPlan({
      planId: applyPlanId,
      requestedBy: 'cli',
    });
  } else if (strict) {
    const normalized = strict.trim().toLowerCase();
    const strictApproval = normalized === 'on' || normalized === 'true' || normalized === '1';
    actionResult = strictApproval
      ? { ok: true, status: 'applied', snapshot: watchService.setStrictApprovalDefault(true) }
      : await watchService.previewMutation({
        actionId: 'set-strict-default',
        strictApproval,
        requestedBy: 'cli',
        sourceSurface: 'cli',
      });
  } else if (allowApp) {
    actionResult = await watchService.previewMutation({
      actionId: 'allow-app',
      app: allowApp,
      requestedBy: 'cli',
      sourceSurface: 'cli',
    });
  } else if (allowSite) {
    actionResult = await watchService.previewMutation({
      actionId: 'allow-site',
      site: allowSite,
      requestedBy: 'cli',
      sourceSurface: 'cli',
    });
  } else if (argv.includes('--preview') && (targetWindow || objective || argv.includes('start'))) {
    actionResult = await watchService.previewMutation({
      actionId: 'start',
      targetWindow: targetWindow || 'desktop',
      objective: objective || 'Watch Mode preview',
      maxIterations,
      maxDurationMs,
      maxScreenshots,
      maxMemoryMb,
      idleTtlMs,
      screenshotTtlMs,
      maxScreenshotBytes,
      screenshotRedactionMode,
      sensitiveScreenPolicy,
      requestedBy: 'cli',
      sourceSurface: 'cli',
    });
  }

  const service = new ZavorthWatchModeControlPlaneService({
    policyFileService,
  });
  const snapshot = service.buildSnapshot({ limit });

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ok: actionResult?.ok !== false, action: actionResult, watchMode: snapshot }, null, 2)}\n`);
  } else {
    console.log('[watch-mode] leitura oficial da supervisao visual, policy e replay curto');
    if (actionResult?.mutationPlan) {
      console.log(`${actionResult.summary}\nPlan: ${actionResult.mutationPlan.id}\n`);
    }
    console.log(service.renderReport({ limit }));
  }

  if (snapshot.summary.posture === 'critical') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[watch-mode] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
