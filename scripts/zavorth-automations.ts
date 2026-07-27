import { ZavorthAutomationActionService } from '../src/services/ZavorthAutomationActionService.js';
import { ZavorthAutomationControlPlaneService } from '../src/services/ZavorthAutomationControlPlaneService.js';

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
  const intentText = readFlag(argv, ['--intent', '--text']);
  const pause = readFlag(argv, ['--pause']);
  const resume = readFlag(argv, ['--resume']);
  const remove = readFlag(argv, ['--remove', '--delete']);
  const maintenance = readFlag(argv, ['--maintenance']);
  const applyPlanId = readFlag(argv, ['--apply']);

  const controlPlane = new ZavorthAutomationControlPlaneService();
  const actionService = new ZavorthAutomationActionService({
    controlPlaneService: controlPlane,
  });

  if (applyPlanId || intentText || pause || resume || remove || maintenance) {
    const actionId =
      intentText ? 'create'
        : pause ? 'pause'
          : resume ? 'resume'
            : remove ? 'remove'
              : maintenance === 'on' ? 'maintenance-on'
                : maintenance === 'off' ? 'maintenance-off'
                  : 'maintenance-run';
    const execution = applyPlanId
      ? await actionService.apply({
        planId: applyPlanId,
        requestedBy: 'cli-operator',
      })
      : await actionService.execute({
        actionId,
        intentText,
        taskId: pause || resume || remove || null,
        requestedBy: 'cli-operator',
        sourceSurface: 'app',
      } as any);

    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(execution, null, 2)}\n`);
    } else {
      console.log('[automations] action plane oficial');
      console.log(`[automations] action=${execution.actionId} | status=${execution.status}`);
      console.log(`[automations] summary: ${execution.summary}`);
      if (execution.details.length > 0) {
        console.log('[automations] detalhes:');
        for (const detail of execution.details) {
          console.log(`- ${detail}`);
        }
      }
      console.log(`[automations] next passo: ${execution.snapshot.narrative.nextAction}`);
    }

    if (!execution.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const snapshot = await controlPlane.buildSnapshot();
  if (asJson) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[automations] read oficial das automations e scheduled runs');
    console.log(await controlPlane.renderReport());
  }
  if (requirePass && snapshot.summary.posture === 'critical') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[automations] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
