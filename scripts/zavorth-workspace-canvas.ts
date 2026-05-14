#!/usr/bin/env node

import { CanvasWorkspaceService } from '../src/services/CanvasWorkspaceService.js';
import type { CanvasAttachmentKind } from '../src/services/CanvasWorkspaceService.js';

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
  const service = new CanvasWorkspaceService();
  const originalConsole = {
    log: console.log,
    info: console.info,
  };
  if (asJson) {
    console.log = () => undefined;
    console.info = () => undefined;
  }

  const entityId = readFlag(argv, ['--entity', '--entity-id']);
  const owner = readFlag(argv, ['--owner', '--by']) || 'cli-operator';
  const approvePlanId = readFlag(argv, ['--approve', '--approve-plan']);

  if (argv.includes('--lock')) {
    const result = await service.acquireLock({
      entityId: entityId || '',
      owner,
      ttlMs: Number(readFlag(argv, ['--ttl-ms']) || Number.NaN),
    });
    return output('lock', result, asJson, originalConsole, result.ok);
  }

  if (argv.includes('--unlock') || argv.includes('--release-lock')) {
    const result = await service.releaseLock({
      entityId: entityId || '',
      owner,
    });
    return output('unlock', result, asJson, originalConsole, result.ok);
  }

  if (argv.includes('--attach')) {
    const result = await service.attachSource({
      entityId: entityId || '',
      kind: (readFlag(argv, ['--kind']) || 'artifact') as CanvasAttachmentKind,
      ref: readFlag(argv, ['--ref']) || '',
      title: readFlag(argv, ['--title']),
      requestedBy: owner,
    });
    return output('attach', result, asJson, originalConsole, result.ok);
  }

  if (argv.includes('--layout')) {
    const result = await service.saveLayout({
      entityId: entityId || '',
      position: {
        x: Number(readFlag(argv, ['--x']) || Number.NaN),
        y: Number(readFlag(argv, ['--y']) || Number.NaN),
        width: Number(readFlag(argv, ['--width', '--w']) || Number.NaN),
        height: Number(readFlag(argv, ['--height', '--h']) || Number.NaN),
      },
      requestedBy: owner,
    });
    return output('layout', result, asJson, originalConsole, result.ok);
  }

  if (argv.includes('--plan-action')) {
    const result = await service.planCanvasAction({
      entityId: entityId || '',
      actionId: readFlag(argv, ['--action']) || 'canvas-action',
      summary: readFlag(argv, ['--summary']),
      requestedBy: owner,
      approvalRequired: !argv.includes('--no-approval'),
    });
    return output('plan-action', result, asJson, originalConsole, result.ok);
  }

  if (approvePlanId) {
    const result = await service.approvePlan({
      planId: approvePlanId,
      approvedBy: owner,
    });
    return output('approve', result, asJson, originalConsole, result.ok);
  }

  const snapshot = await service.buildSnapshot({
    limit: Number(readFlag(argv, ['--limit']) || 8),
  });
  if (asJson) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[workspace-canvas] leitura oficial da Fase 22');
    console.log(`[workspace-canvas] postura=${snapshot.summary.posture} | entities=${snapshot.summary.entities} | approvals=${snapshot.summary.pendingApprovals}/${snapshot.summary.approvals}`);
    console.log(`[workspace-canvas] locks=${snapshot.summary.locks} | attachments=${snapshot.summary.attachments} | diagrams=${snapshot.summary.diagrams}`);
    console.log(`[workspace-canvas] runtime pesado iniciado=${snapshot.summary.heavyRuntimesStarted ? 'yes' : 'no'}`);
    console.log(`[workspace-canvas] resumo: ${snapshot.narrative.operatorSummary}`);
    console.log(`[workspace-canvas] proximo passo: ${snapshot.narrative.nextAction}`);
    console.log('[workspace-canvas] fallback:');
    for (const command of snapshot.policy.cliFallbackCommands) {
      console.log(`- ${command}`);
    }
  }

  if (requirePass && snapshot.summary.posture === 'critical') {
    process.exitCode = 1;
  }
}

function output(
  label: string,
  result: any,
  asJson: boolean,
  originalConsole: { log: typeof console.log; info: typeof console.info },
  ok: boolean,
) {
  if (asJson) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`[workspace-canvas] ${label}`);
    console.log(`[workspace-canvas] status=${result.status || (ok ? 'ok' : 'blocked')} | ok=${ok ? 'yes' : 'no'}`);
    console.log(`[workspace-canvas] resumo: ${result.summary || result.plan?.summary || 'acao registrada'}`);
    if (result.mutationPlan?.id) {
      console.log(`[workspace-canvas] mutationPlan=${result.mutationPlan.id}`);
    }
  }
  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[workspace-canvas] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
