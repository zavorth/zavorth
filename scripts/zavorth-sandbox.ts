import { ZavorthSandboxActionService } from '../src/services/ZavorthSandboxActionService.js';
import { ZavorthSandboxControlPlaneService } from '../src/services/ZavorthSandboxControlPlaneService.js';
import type { ZavorthCapabilityRunEnvelope } from '../src/contracts/ZavorthMutationPlaneContract.js';
import { SandboxHostReadinessService } from '../src/services/SandboxHostReadinessService.js';
import type { SandboxLanguage } from '../src/services/sandbox/ISandboxRuntime.js';

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

function normalizeLanguage(value: string | null): SandboxLanguage | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'javascript' || normalized === 'python' || normalized === 'shell' || normalized === 'wasm') {
    return normalized;
  }
  return null;
}

function normalizeNetworkPolicy(value: string | null): ZavorthCapabilityRunEnvelope['networkPolicy'] | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'none'
    || normalized === 'allowlisted'
    || normalized === 'internet-readonly'
    || normalized === 'full-with-approval'
  ) {
    return normalized;
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
  const doctorMode = argv.includes('--doctor');
  const smokeMode = argv.includes('--smoke');
  const originalConsole = {
    log: console.log,
    info: console.info,
  };
  if (asJson) {
    console.log = () => undefined;
    console.info = () => undefined;
  }

  const code = readFlag(argv, ['--code']);
  const command = readFlag(argv, ['--command', '--cmd']);
  const language = normalizeLanguage(readFlag(argv, ['--language', '--lang']));
  const preferredProfile = readFlag(argv, ['--profile', '--sandbox-profile']) as any;
  const networkPolicy = normalizeNetworkPolicy(readFlag(argv, ['--network', '--network-policy']));
  const applyPlanId = readFlag(argv, ['--apply']);

  const controlPlane = new ZavorthSandboxControlPlaneService();
  const actionService = new ZavorthSandboxActionService({
    controlPlaneService: controlPlane,
  });

  if (doctorMode) {
    const hostReadiness = new SandboxHostReadinessService();
    const snapshot = smokeMode
      ? await hostReadiness.runSmoke({
          includeLocalJail: true,
          includeMicrovm: true,
        })
      : hostReadiness.inspect();

    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      console.log(hostReadiness.renderReport(snapshot));
      console.log('');
      console.log(`[sandbox] default mutation policy: ${snapshot.defaultPolicy.liveMutationDefault}`);
      console.log(`[sandbox] explanation: ${snapshot.defaultPolicy.explanation}`);
    }

    if (requirePass && !snapshot.summary.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (applyPlanId) {
    const execution = await actionService.apply({
      planId: applyPlanId,
      requestedBy: 'cli-operator',
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(execution, null, 2)}\n`);
    } else {
      console.log('[sandbox] action plane oficial');
      console.log(`[sandbox] action=${execution.actionId} | status=${execution.status}`);
      console.log(`[sandbox] summary: ${execution.summary}`);
      for (const detail of execution.details) {
        console.log(`- ${detail}`);
      }
    }
    if (!execution.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (code || command) {
    const execution = await actionService.preview({
      code,
      command,
      language,
      preferredProfile: preferredProfile || 'auto',
      networkPolicy,
      mode: 'preview',
      requestedBy: 'cli-operator',
      sourceSurface: 'cli',
    });
    if (asJson) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      process.stdout.write(`${JSON.stringify(execution, null, 2)}\n`);
    } else {
      console.log('[sandbox] official isolated execution preview');
      console.log(`[sandbox] status=${execution.status} | ok=${execution.ok ? 'yes' : 'no'}`);
      console.log(`[sandbox] summary: ${execution.summary}`);
      if (execution.envelope) {
        console.log(`[sandbox] envelope=${execution.envelope.id} | profile=${execution.envelope.sandboxProfile} | risk=${execution.envelope.riskLevel}`);
      }
      for (const detail of execution.details) {
        console.log(`- ${detail}`);
      }
    }
    if (requirePass && execution.status === 'blocked') {
      process.exitCode = 1;
    }
    return;
  }

  const snapshot = controlPlane.buildSnapshot();
  if (asJson) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[sandbox] read oficial do Sandbox Forte lazy');
    console.log(controlPlane.renderReport());
  }
  if (requirePass && !snapshot.summary.untrustedExecutionReady) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[sandbox] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
