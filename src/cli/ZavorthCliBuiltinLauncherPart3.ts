import path from 'path';
import {
  projectRoot,
  logCliError,
  printCliPanel,
  spawnInherited,
  npmInherited,
  runningFromDist,
  entryDir,
  readNumberFlag,
  readStringFlag,
  readDurationMsFlag,
  resolveCommandSuggestion,
  printCommandSuggestion
} from './ZavorthCliCommonInfrastructure.js';
import {
  isZavorthLiveNamespaceCommand,
  runZavorthLiveNamespaceCommand,
} from './ZavorthCliLiveNamespaces.js';
import {
  runZavorthEchoWakeCommand
} from './ZavorthCliPremiumHandlers.js';

export async function runBuiltinLauncherPart3(command: string, restArgs: string[], rawArgs: string[]): Promise<number | null> {
  if (command === 'doctor' && ['retention', 'runtime-retention'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeRetentionService } = await import('../core/MinimalRuntimeRetentionService.js');
    const dataDir = restArgs.find((arg) => arg.startsWith('--data-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime');
    const report = new MinimalRuntimeRetentionService({
      projectRoot,
      dataDir,
      policy: {
        ...(readNumberFlag(restArgs, 'max-activation-receipts') !== null
          ? { maxActivationReceipts: readNumberFlag(restArgs, 'max-activation-receipts') as number }
          : {}),
        ...(readNumberFlag(restArgs, 'max-jsonl-kb') !== null
          ? { maxGenericJsonlBytes: (readNumberFlag(restArgs, 'max-jsonl-kb') as number) * 1024 }
          : {}),
      },
    }).buildReport({ apply: restArgs.includes('--apply') });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      await printCliPanel('Runtime retention doctor', [
        `status: ${report.status}`,
        `applied: ${report.applied}`,
        `files: ${report.totals.files}`,
        `bytes: ${report.totals.bytes}`,
        `actions: planned ${report.totals.planned} | manual ${report.totals.manual} | applied ${report.totals.applied} | skipped ${report.totals.skipped} | errors ${report.totals.errors}`,
        '',
        ...report.actions.filter((action) => action.status !== 'kept').slice(0, 12)
          .map((action) => `- ${action.status} ${path.basename(action.filePath)}: ${action.message}`),
      ], report.status === 'failed' || report.totals.errors > 0 ? 'warning' : 'success');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.totals.errors > 0) ? 1 : 0;
  }

  if (command === 'doctor' && ['mode', 'runtime-mode', 'mode-governor'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeModeGovernor } = await import('../core/MinimalRuntimeModeGovernor.js');
    const governor = new MinimalRuntimeModeGovernor({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    });
    if (restArgs.includes('--ledger')) {
      const snapshot = governor.buildLedgerSnapshot({
        limit: readNumberFlag(restArgs, 'limit') || 20,
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
      } else {
        await printCliPanel('Runtime mode ledger', [
          `status: ${snapshot.status}`,
          `total: ${snapshot.total}`,
          `active: ${snapshot.active}`,
          `released: ${snapshot.released}`,
          `dry-run: ${snapshot.dryRun}`,
          '',
          ...snapshot.leases.slice(0, 10).map((lease) => `- ${lease.id}: ${lease.status} ${lease.fromProfile}->${lease.toProfile} ${lease.capabilityId} expires=${lease.expiresAt}`),
        ], snapshot.status === 'failed' ? 'error' : 'success');
      }
      return snapshot.status === 'failed' ? 1 : 0;
    }
    const plan = governor.plan({
      fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
      toProfile: readStringFlag(restArgs, 'to'),
      capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
      reason: readStringFlag(restArgs, 'reason'),
      ttlMs: readDurationMsFlag(restArgs, 'ttl'),
    });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } else {
      await printCliPanel('Runtime mode governor', [
        `status: ${plan.status}`,
        `action: ${plan.action}`,
        `profile: ${plan.fromProfile} -> ${plan.toProfile}`,
        `capability: ${plan.capabilityId}`,
        `ttl: ${plan.ttlMs}ms`,
        `expires: ${plan.expiresAt}`,
        `budget: ${plan.budgetOk ? 'ok' : 'blocked'}`,
        `result: ${plan.message}`,
      ], ['blocked', 'missing'].includes(plan.status) ? 'warning' : 'success');
    }
    return ['blocked', 'missing'].includes(plan.status) ? 1 : 0;
  }

  if (command === 'capability' && ['plan', 'activate', 'replay', 'rollback'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    if (['replay', 'rollback'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      const { MinimalCapabilityActivationReplayService } = await import('../core/MinimalCapabilityActivationReplayService.js');
      const action = String(restArgs[0] || '').trim().toLowerCase() === 'rollback' ? 'rollback' : 'replay';
      const capabilityId = String(restArgs[1] || '').trim();
      const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
        || process.env.ZAVORTH_RUNTIME_PROFILE
        || process.env.ZAVORTH_PROFILE
        || null;
      const result = await new MinimalCapabilityActivationReplayService({
        projectRoot,
        dataDir: path.join(projectRoot, 'data', 'runtime'),
        ledgerFile: path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl'),
      }).execute(action, {
        profile: profileArg,
        capability: capabilityId || null,
        apply: restArgs.includes('--apply'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        await printCliPanel('Capability replay', [
          `action: ${result.action}`,
          `profile: ${result.plan.profileId}`,
          `capability: ${result.plan.capabilityId}`,
          `status: ${result.plan.status}`,
          `command: ${result.plan.command}`,
          `result: ${result.message}`,
        ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
      }
      return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const { MinimalCapabilityActivationPlanner } = await import('../core/MinimalCapabilityActivationPlanner.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const capabilityId = String(restArgs[1] || '').trim();
    if (!capabilityId) {
      await logCliError('Informe o id da capability.', 'Usage Error');
      return 1;
    }
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const planner = new MinimalCapabilityActivationPlanner({
      projectRoot,
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
      dataDir: path.join(projectRoot, 'data', 'runtime'),
    });
    const result = action === 'activate'
      ? await planner.activate(capabilityId, {
        profile: profileArg,
        apply: restArgs.includes('--apply'),
        operation: 'activate',
      })
      : await planner.activate(capabilityId, {
        profile: profileArg,
        apply: false,
        operation: 'plan',
      });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      await printCliPanel('Capability activation', [
        `profile: ${result.plan.profileId}`,
        `capability: ${result.plan.capabilityId}`,
        `status: ${result.plan.status}`,
        `mode: ${result.plan.mode}`,
        `action: ${result.plan.action}`,
        `result: ${result.message}`,
      ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
    }
    return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
  }

  if (command === 'mode' && ['plan', 'elevate', 'release'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeModeGovernor } = await import('../core/MinimalRuntimeModeGovernor.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const governor = new MinimalRuntimeModeGovernor({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    });
    if (action === 'plan') {
      const plan = governor.plan({
        fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
        toProfile: readStringFlag(restArgs, 'to'),
        capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
        reason: readStringFlag(restArgs, 'reason'),
        ttlMs: readDurationMsFlag(restArgs, 'ttl'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      } else {
        await printCliPanel('Runtime mode plan', [
          `status: ${plan.status}`,
          `action: ${plan.action}`,
          `profile: ${plan.fromProfile} -> ${plan.toProfile}`,
          `capability: ${plan.capabilityId}`,
          `result: ${plan.message}`,
        ], ['blocked', 'missing'].includes(plan.status) ? 'warning' : 'success');
      }
      return ['blocked', 'missing'].includes(plan.status) ? 1 : 0;
    }
    const result = action === 'release'
      ? governor.release(String(restArgs[1] || readStringFlag(restArgs, 'lease') || '').trim(), {
        apply: restArgs.includes('--apply'),
        reason: readStringFlag(restArgs, 'reason'),
      })
      : governor.elevate({
        fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
        toProfile: readStringFlag(restArgs, 'to'),
        capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
        reason: readStringFlag(restArgs, 'reason'),
        ttlMs: readDurationMsFlag(restArgs, 'ttl'),
        apply: restArgs.includes('--apply'),
      });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      await printCliPanel('Runtime mode', [
        `applied: ${result.applied}`,
        `dry-run: ${result.dryRun}`,
        `status: ${result.plan.status}`,
        `action: ${result.plan.action}`,
        `lease: ${result.lease?.id || 'none'}`,
        `profile: ${result.plan.fromProfile} -> ${result.plan.toProfile}`,
        `return profile: ${result.plan.returnProfile}`,
        `result: ${result.message}`,
      ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
    }
    return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
  }

  if (command === 'doctor' && ['sidecars', 'sidecar-manager'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('../core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('../core/MinimalRuntimeProfileRegistry.js');
    const { MinimalSidecarManager } = await import('../core/MinimalSidecarManager.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileSnapshot = new MinimalRuntimeProfileRegistry({
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    }).load(profileArg);
    const capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    const snapshot = await new MinimalSidecarManager({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      runtimeProfile: profileSnapshot.selectedProfile,
      capabilityRegistry,
    }).inspectLive();
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      await printCliPanel('Sidecar manager doctor', [
        `profile: ${snapshot.profileId}`,
        `total: ${snapshot.total}`,
        `launchable: ${snapshot.launchable}`,
        `running: ${snapshot.running}`,
        `ready: ${snapshot.ready}`,
        '',
        ...snapshot.sidecars.map((sidecar) => `- ${sidecar.id}: ${sidecar.state} | launchable=${sidecar.launchable} | ${sidecar.message}`),
      ], snapshot.ready === snapshot.total ? 'success' : 'warning');
    }
    return 0;
  }

  if (command === 'sidecar' && ['start', 'stop'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('../core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('../core/MinimalRuntimeProfileRegistry.js');
    const { MinimalSidecarManager } = await import('../core/MinimalSidecarManager.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const sidecarId = String(restArgs[1] || '').trim();
    if (!sidecarId) {
      await logCliError('Informe o id do sidecar.', 'Usage Error');
      return 1;
    }
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'desktop';
    const profileSnapshot = new MinimalRuntimeProfileRegistry({
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    }).load(profileArg);
    const capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    const manager = new MinimalSidecarManager({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      runtimeProfile: profileSnapshot.selectedProfile,
      capabilityRegistry,
    });
    const result = action === 'start'
      ? await manager.start(sidecarId, { dryRun: !restArgs.includes('--apply') })
      : await manager.stop(sidecarId, { dryRun: !restArgs.includes('--apply') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  if (command === 'browser' && [
    'health',
    'navigate',
    'screenshot',
    'extract-text',
    'click',
    'type',
    'close',
    'shutdown',
  ].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalBrowserSidecarClient } = await import('../core/MinimalBrowserSidecarClient.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const baseUrl = restArgs.find((arg) => arg.startsWith('--base-url='))?.split('=').slice(1).join('=');
    const timeoutMs = Number(restArgs.find((arg) => arg.startsWith('--timeout-ms='))?.split('=').slice(1).join('=') || 30_000);
    const client = new MinimalBrowserSidecarClient({ baseUrl, timeoutMs });
    let result: unknown;
    if (action === 'health') {
      result = await client.health();
    } else if (action === 'navigate') {
      const url = restArgs[1] || restArgs.find((arg) => arg.startsWith('--url='))?.split('=').slice(1).join('=');
      if (!url) {
        await logCliError('Informe o URL para navegar.', 'Browser Sidecar Error');
        return 1;
      }
      result = await client.navigate(url, {
        waitUntil: restArgs.find((arg) => arg.startsWith('--wait-until='))?.split('=').slice(1).join('='),
        timeoutMs,
      });
    } else if (action === 'screenshot') {
      result = await client.screenshot({
        fullPage: !restArgs.includes('--viewport-only'),
        base64: restArgs.includes('--base64'),
      });
    } else if (action === 'extract-text') {
      result = await client.extractText({
        maxChars: Number(restArgs.find((arg) => arg.startsWith('--max-chars='))?.split('=').slice(1).join('=') || 20_000),
        timeoutMs,
      });
    } else if (action === 'click') {
      const selector = restArgs[1] || restArgs.find((arg) => arg.startsWith('--selector='))?.split('=').slice(1).join('=');
      if (!selector) {
        await logCliError('Informe o selector para clicar.', 'Browser Sidecar Error');
        return 1;
      }
      result = await client.click(selector, { timeoutMs });
    } else if (action === 'type') {
      const selector = restArgs[1] || restArgs.find((arg) => arg.startsWith('--selector='))?.split('=').slice(1).join('=');
      const text = restArgs[2] || restArgs.find((arg) => arg.startsWith('--text='))?.split('=').slice(1).join('=') || '';
      if (!selector) {
        await logCliError('Informe o selector para digitar.', 'Browser Sidecar Error');
        return 1;
      }
      result = await client.type(selector, text, { timeoutMs });
    } else if (action === 'close') {
      result = await client.close();
    } else {
      result = await client.shutdown();
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  if (command === 'echo' || command === 'voice' || command === 'voz') {
    if (String(restArgs[0] || '').trim().toLowerCase() === 'wake') {
      return runZavorthEchoWakeCommand(restArgs.slice(1));
    }
    return npmInherited(['start'], path.join(projectRoot, 'agent'));
  }

  if (command === 'serve' || command === 'server' || command === 'api') {
    if (runningFromDist) {
      return spawnInherited(process.execPath, [path.join(entryDir, 'gateway', 'index.js')], projectRoot);
    }
    return npmInherited(['exec', 'tsx', '--', 'src/gateway/index.ts'], projectRoot);
  }

  if (command === 'ui') {
    return spawnInherited(process.execPath, [path.join(projectRoot, 'scripts', 'start-echo-stack.mjs')], projectRoot);
  }

  if (isZavorthLiveNamespaceCommand(command)) {
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot,
      command,
      args: restArgs,
    });
    process.stdout.write(result.output);
    return result.exitCode;
  }

  const suggestion = resolveCommandSuggestion(command);
  if (suggestion) {
    return printCommandSuggestion(command, suggestion);
  }

  return null;
}
