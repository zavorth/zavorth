import { ZavorthActiveMissionUxService } from '../src/services/ZavorthActiveMissionUxService.js';
import { ZavorthSensitiveActionFlowUxService } from '../src/services/ZavorthSensitiveActionFlowUxService.js';
import { ZavorthVisualReceiptUxService } from '../src/services/ZavorthVisualReceiptUxService.js';
import { ZavorthProviderSelectionUxService } from '../src/services/ZavorthProviderSelectionUxService.js';

const args = process.argv.slice(2);

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

const request = readFlag('request')
  || args.filter((arg) => !arg.startsWith('--')).join(' ')
  || 'Review this workspace in read-only mode.';

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});

async function main(): Promise<void> {
  const generatedAt = new Date('2026-05-13T12:00:00.000Z').toISOString();
  const runStatus = readFlag('run-status') || (args.includes('--running') ? 'running' : 'idle');
  const runtimeSnapshot = runStatus === 'idle'
    ? {}
    : {
        activeRun: {
          id: 'run_cli_active_mission',
          traceId: 'trace_cli_active_mission',
          sessionId: 'session_cli',
          title: request,
          status: runStatus,
          summary: 'CLI preview mission for ZavorthControl UX.',
          providerLabel: 'local projection',
          modelLabel: 'not executed',
          updatedAt: generatedAt,
          events: [
            { id: 'intent', kind: 'status', title: 'Intent received', detail: 'Request normalized.', status: 'done' },
            { id: 'policy', kind: 'approval', title: 'Policy check', detail: 'Policy Broker remains required.', status: 'pending' },
          ],
        },
        artifacts: [],
      };

  const sensitiveActionFlowUx = new ZavorthSensitiveActionFlowUxService().buildSnapshot({
    request,
    decision: readFlag('decision') as any,
    sandboxReady: args.includes('--sandbox-ready'),
    source: 'cli',
  });
  const visualReceipts = new ZavorthVisualReceiptUxService().buildSnapshot({});
  const providerSelectionUx = await new ZavorthProviderSelectionUxService().buildSnapshot({
    target: readFlag('provider'),
    intent: readFlag('intent'),
    live: false,
  });

  const service = new ZavorthActiveMissionUxService();
  const snapshot = service.buildSnapshot({
    runtimeSnapshot,
    sensitiveActionFlowUx,
    visualReceipts,
    providerSelectionUx,
  });

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }
}
