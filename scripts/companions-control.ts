#!/usr/bin/env node

import { CompanionControlService } from '../src/services/CompanionControlService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const force = argv.includes('--force');
  const dryRun = argv.includes('--dry-run');
  const filteredArgs = argv.filter((arg) => !['--json', '--force', '--dry-run'].includes(arg));

  const command = String(filteredArgs[0] || 'list').trim().toLowerCase();
  const companionId = String(filteredArgs[1] || '').trim().toLowerCase();
  const service = new CompanionControlService();

  if (command === 'list' || command === 'status') {
    const snapshot = await service.buildSnapshot({ preferCachedWithinMs: 15_000 });
    process.stdout.write(asJson ? `${JSON.stringify(snapshot, null, 2)}\n` : `${service.renderSnapshot(snapshot)}\n`);
    return;
  }

  if (command === 'inspect') {
    if (!companionId) {
      throw new Error('Uso: companions-control.ts inspect <wsl|docker-desktop|zavorthBridge|codex-companion>');
    }
    const companion = await service.inspectCompanion(companionId as any, { preferCachedWithinMs: 15_000 });
    process.stdout.write(asJson ? `${JSON.stringify(companion, null, 2)}\n` : `${service.renderCompanion(companion)}\n`);
    return;
  }

  if (!companionId) {
    throw new Error('Uso: companions-control.ts <hibernate|resume|stop-idle|trim|restart-safe> <companion> [--force] [--dry-run]');
  }

  const result = await service.executeAction({
    companionId: companionId as any,
    actionId: command as any,
    force,
    dryRun,
    requestedBy: 'ops-cli',
  });

  process.stdout.write(asJson ? `${JSON.stringify(result, null, 2)}\n` : `${service.renderActionResult(result)}\n`);
  if (!result.ok) {
    process.exitCode = result.requiresApproval ? 2 : 1;
  }
}

main().catch((error) => {
  console.error('[zavorth-ops] companions control failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
