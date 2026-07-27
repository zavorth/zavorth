import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const checks = [
  {
    id: 'voice-wake-runtime',
    file: 'src/services/VoiceWakeRuntimeService.ts',
    markers: ['VoiceWakeRuntimeService', 'noRawAudioPersistence', 'ZAVORTH_WAKE_COMMAND'],
  },
  {
    id: 'zavorth-home-resolver',
    file: 'src/services/ZavorthHomePathService.ts',
    markers: ['ZavorthHomePathService', 'applyMigration', 'rollbackMigration', 'previewSwitch', 'preventsPathTraversal'],
  },
  {
    id: 'zavorth-home-clean-install',
    file: 'scripts/zavorth-home-clean-install-smoke-runner.ts',
    markers: ['ZAVORTH_HOME', 'zavorth-clean-install', 'task plane state was not written inside ZAVORTH_HOME'],
  },
  {
    id: 'zavorth-home-dashboard-surface',
    file: 'src/services/ZavorthGatewayRuntimeService.ts',
    markers: ['ZavorthHomePathService', 'home:', 'statusCommand', 'switchCommand'],
  },
  {
    id: 'task-plane',
    file: 'src/services/TaskPlaneService.ts',
    markers: ['TaskPlaneService', 'claimTask', 'retryTask', 'cancelTask'],
  },
  {
    id: 'cron-task-plane-bridge',
    file: 'src/cli/ZavorthCliLiveNamespaces.ts',
    markers: ['materializeCronItemToTaskPlane', 'lastMaterializedTaskId', 'commandDigest'],
  },
  {
    id: 'friendly-work-commands',
    file: 'src/services/ZavorthFriendlyWorkCommandService.ts',
    markers: ['ZavorthFriendlyWorkCommandService', 'todo', 'later', 'materializeDue'],
  },
  {
    id: 'channel-governance',
    file: 'src/services/ChannelGovernanceEnvelopeService.ts',
    markers: ['ChannelGovernanceEnvelopeService', 'inboundNeverExecutesDirectly', 'outboundRequiresPolicy'],
  },
  {
    id: 'sandbox-receipts',
    file: 'src/services/SandboxExecutionReceiptService.ts',
    markers: ['SandboxExecutionReceiptService', 'commandDigest', 'unsafeMountsBlocked'],
  },
  {
    id: 'cli-surface',
    file: 'src/zavorth-cli.ts',
    markers: ['runZavorthEchoWakeCommand', 'runZavorthHomeCommand', 'runZavorthTasksCommand'],
  },
  {
    id: 'tui-surface',
    file: 'src/cli/hud/ZavorthCliRuntimeTuiTypes.ts',
    markers: ['voice', 'tasks', 'sandbox', 'home'],
  },
  {
    id: 'a2ui-sandbox-policy',
    file: 'src/services/ZavorthA2UIService.ts',
    markers: ['risk-dry-run', 'actionDispatch', 'transaction-plane', 'inlineHandlers'],
  },
  {
    id: 'focused-tests',
    file: 'tests/services/VoiceWakeRuntimeService.test.ts',
    markers: ['never persists raw audio', 'auto-disarms'],
  },
  {
    id: 'friendly-work-tests',
    file: 'tests/services/ZavorthFriendlyWorkCommandService.test.ts',
    markers: ['creates a simple todo', 'materializes due items'],
  },
];

const results = checks.map((check) => {
  const absolute = path.join(root, check.file);
  const content = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
  const missingMarkers = check.markers.filter((marker) => !content.includes(marker));
  return {
    id: check.id,
    file: check.file,
    ok: content.length > 0 && missingMarkers.length === 0,
    missingMarkers,
  };
});

const failed = results.filter((result) => !result.ok);
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ ok: failed.length === 0, results }, null, 2)}\n`);
} else {
  process.stdout.write('Zavorth sensory/operational upgrade check\n');
  for (const result of results) {
    process.stdout.write(`${result.ok ? 'ok ' : 'ERR'} ${result.id} ${result.file}\n`);
    if (!result.ok) {
      process.stdout.write(`    missing: ${result.missingMarkers.join(', ')}\n`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}
