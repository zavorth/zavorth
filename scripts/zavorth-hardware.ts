#!/usr/bin/env node

import { ZavorthHardwareActionPlaneService } from '@zavorth/hardware/ZavorthHardwareActionPlaneService.js';
import type {
  HardwareDeviceType,
  HardwareProviderId,
  HardwareDeviceVisibility,
} from '@zavorth/hardware/ZavorthHardwareActionPlaneService.js';

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
  return value ? value.split(',').map((entry) => entry.trim()).filter(Boolean) : [];
}

function readPayload(argv: string[]): Record<string, unknown> {
  const raw = readFlag(argv, ['--payload', '--json-payload']);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return { value: raw };
  }
}

async function printJson(value: unknown): Promise<void> {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new ZavorthHardwareActionPlaneService();

  if (argv.includes('--register-device')) {
    const result = service.registerDevice({
      id: readFlag(argv, ['--device', '--device-id']) || '',
      label: readFlag(argv, ['--label']) || undefined,
      providerId: (readFlag(argv, ['--provider']) || 'home-assistant') as HardwareProviderId,
      externalId: readFlag(argv, ['--external-id', '--entity', '--topic']),
      type: (readFlag(argv, ['--type']) || 'generic') as HardwareDeviceType,
      location: readFlag(argv, ['--location']),
      riskLevel: readFlag(argv, ['--risk']) as any,
      allowlisted: argv.includes('--allowlisted') || argv.includes('--allowlist'),
      visibility: readFlag(argv, ['--visibility']) as HardwareDeviceVisibility | null,
      allowedActions: readList(argv, ['--actions']),
      requestedBy: 'cli-operator',
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[hardware] device registrado');
      console.log(`[hardware] id=${result.id} | provider=${result.providerId} | allowlisted=${result.allowlisted ? 'sim' : 'nao'}`);
      console.log(`[hardware] acoes=${result.allowedActions.join(', ') || 'n/d'}`);
    }
    return;
  }

  const planDevice = readFlag(argv, ['--plan-action', '--device-action']);
  if (planDevice) {
    const result = await service.planAction({
      deviceId: planDevice,
      action: readFlag(argv, ['--action']) || 'read_state',
      payload: readPayload(argv),
      requestedBy: 'cli-operator',
      sourceSurface: 'cli',
      approvalRequired: argv.includes('--no-approval') ? false : null,
      approvalScope: readFlag(argv, ['--scope']) as any,
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[hardware] plano de acao fisica');
      console.log(`[hardware] status=${result.status} | ok=${result.ok ? 'sim' : 'nao'} | plan=${result.mutationPlan?.id || 'n/d'}`);
      console.log(`[hardware] resumo: ${result.summary}`);
      for (const blocker of result.blockers) {
        console.log(`- ${blocker}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const approvePlan = readFlag(argv, ['--approve']);
  if (approvePlan) {
    const result = await service.approvePlan({
      planId: approvePlan,
      approvedBy: 'cli-operator',
      scope: readFlag(argv, ['--scope']) as any,
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[hardware] plano aprovado');
      console.log(`[hardware] id=${result.id} | status=${result.status}`);
    }
    return;
  }

  const applyPlan = readFlag(argv, ['--apply']);
  if (applyPlan) {
    const result = await service.applyPlan({
      planId: applyPlan,
      requestedBy: 'cli-operator',
      dryRun: !argv.includes('--execute'),
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[hardware] apply de acao fisica');
      console.log(`[hardware] status=${result.status} | ok=${result.ok ? 'sim' : 'nao'} | plan=${result.mutationPlan?.id || applyPlan}`);
      console.log(`[hardware] resumo: ${result.summary}`);
      if (!argv.includes('--execute')) {
        console.log('[hardware] dry-run: use --execute para chamar provider real apos approval.');
      }
      for (const blocker of result.blockers) {
        console.log(`- ${blocker}`);
      }
    }
    if (!result.ok && result.status !== 'dry_run') {
      process.exitCode = 1;
    }
    return;
  }

  if (argv.includes('--emergency-stop')) {
    const result = service.activateEmergencyStop({
      reason: readFlag(argv, ['--reason']) || 'Emergency stop via CLI.',
      requestedBy: 'cli-operator',
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[hardware] emergency stop ativado');
      console.log(`[hardware] reason=${result.reason || 'n/d'}`);
    }
    return;
  }

  if (argv.includes('--clear-emergency-stop')) {
    const result = service.clearEmergencyStop({
      reason: readFlag(argv, ['--reason']) || 'Emergency stop limpo via CLI.',
      requestedBy: 'cli-operator',
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[hardware] emergency stop limpo');
      console.log(`[hardware] active=${result.active ? 'sim' : 'nao'}`);
    }
    return;
  }

  const failedAutomation = readFlag(argv, ['--record-failure', '--automation-failed']);
  if (failedAutomation) {
    const result = service.recordAutomationFailure({
      automationId: failedAutomation,
      deviceId: readFlag(argv, ['--device', '--device-id']),
      reason: readFlag(argv, ['--reason']),
      threshold: Number(readFlag(argv, ['--threshold']) || Number.NaN),
    });
    if (asJson) {
      await printJson(result);
    } else {
      console.log('[hardware] falha de automacao fisica registrada');
      console.log(`[hardware] automation=${result.automationId} | failures=${result.failures}/${result.threshold} | autoPaused=${result.autoPaused ? 'sim' : 'nao'}`);
    }
    return;
  }

  const snapshot = await service.buildSnapshot({
    includeHidden: argv.includes('--include-hidden'),
  });
  if (asJson) {
    await printJson(snapshot);
  } else {
    console.log('[hardware] leitura oficial do hardware action plane');
    console.log(`[hardware] postura=${snapshot.summary.posture} | providers=${snapshot.summary.configuredProviders}/${snapshot.summary.providers} configurados | devices=${snapshot.summary.devices}`);
    console.log(`[hardware] allowlisted=${snapshot.summary.allowlistedDevices} | read-only=${snapshot.summary.readOnlyDevices} | hidden=${snapshot.summary.hiddenDevices}`);
    console.log(`[hardware] emergencyStop=${snapshot.summary.emergencyStopActive ? 'ativo' : 'inativo'} | autoPaused=${snapshot.summary.autoPausedAutomations}`);
    console.log(`[hardware] runtime pesado iniciado=${snapshot.summary.heavyRuntimesStarted ? 'sim' : 'nao'}`);
    console.log(`[hardware] resumo: ${snapshot.narrative.operatorSummary}`);
    if (snapshot.actions.length > 0) {
      console.log('[hardware] acoes sugeridas:');
      for (const action of snapshot.actions) {
        console.log(`- ${action.label}: ${action.command}`);
      }
    }
  }
}

main().catch((error) => {
  console.error('[hardware] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
