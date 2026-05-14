import path from 'path';
import {
  CAPABILITY_PROVISION_SPECS,
  cleanCapabilityArtifacts,
  installCapabilityDependencies,
  resolveCapabilityProvisionSpec,
} from './capability-provision.js';
import {
  CapabilityLifecycleService,
  type CapabilityApprovalScope,
} from '../src/services/CapabilityLifecycleService.js';
import { RuntimeProfileService } from '../src/services/RuntimeProfileService.js';

type PackAction = 'add' | 'remove' | 'status';

type CliOptions = {
  action: PackAction;
  packId?: string;
  stateFilePath?: string;
  scope: CapabilityApprovalScope;
  skipInstall: boolean;
  skipClean: boolean;
  showAllCapabilities: boolean;
};

const PACK_IDS = Object.keys(CAPABILITY_PROVISION_SPECS);

function normalizeCliValue(input: string): string {
  return String(input || '')
    .trim()
    .replace(/^\^+|\^+$/g, '')
    .replace(/^"+|"+$/g, '')
    .replace(/\^/g, '');
}

function readOptionValue(argv: string[], currentIndex: number): { value: string; nextIndex: number } {
  const chunks: string[] = [];
  let nextIndex = currentIndex;
  while (nextIndex + 1 < argv.length) {
    const candidate = String(argv[nextIndex + 1] || '');
    if (candidate.trim().startsWith('--')) {
      break;
    }
    chunks.push(candidate);
    nextIndex += 1;
  }

  return {
    value: normalizeCliValue(chunks.join(' ')),
    nextIndex,
  };
}

function parseArgs(argv: string[]): CliOptions {
  const action = String(argv[0] || '').trim().toLowerCase() as PackAction;
  if (!['add', 'remove', 'status'].includes(action)) {
    throw new Error('Use npm run pack:add -- <remote|media|qa|sandbox> | pack:remove -- <id> | pack:status [id] [--all].');
  }

  let packId: string | undefined;
  let stateFilePath: string | undefined;
  let scope: CapabilityApprovalScope = 'host';
  let skipInstall = false;
  let skipClean = false;
  let showAllCapabilities = false;

  for (let index = 1; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim();
    if (!current) {
      continue;
    }
    if (!current.startsWith('--') && !packId) {
      packId = current.toLowerCase();
      continue;
    }
    if (current === '--scope') {
      const parsed = readOptionValue(argv, index);
      const requestedScope = parsed.value.toLowerCase();
      if (!['once', 'session', 'host'].includes(requestedScope)) {
        throw new Error('Use --scope once|session|host.');
      }
      scope = requestedScope as CapabilityApprovalScope;
      index = parsed.nextIndex;
      continue;
    }
    if (current === '--state-path' || current === '--state-file') {
      const parsed = readOptionValue(argv, index);
      stateFilePath = path.resolve(process.cwd(), parsed.value);
      index = parsed.nextIndex;
      continue;
    }
    if (current === '--skip-install') {
      skipInstall = true;
      continue;
    }
    if (current === '--skip-clean') {
      skipClean = true;
      continue;
    }
    if (current === '--all') {
      showAllCapabilities = true;
    }
  }

  if ((action === 'add' || action === 'remove') && !packId) {
    throw new Error(`Informe o pack alvo. Packs suportados: ${PACK_IDS.join(', ')}.`);
  }

  return {
    action,
    packId,
    stateFilePath,
    scope,
    skipInstall,
    skipClean,
    showAllCapabilities,
  };
}

function createLifecycleService(stateFilePath?: string): CapabilityLifecycleService {
  const runtimeProfileService = new RuntimeProfileService(undefined, {
    stateFilePath,
  });
  return new CapabilityLifecycleService({
    runtimeProfileService,
    stateFilePath,
  });
}

function renderCapabilityLine(entry: {
  capabilityId: string;
  label: string;
  state: string;
  approvalRequired: boolean;
  approvalScope: string | null;
  enabledByProfile: boolean;
  enabledByUser: boolean;
  notes?: string;
}): string {
  const flags = [
    `state=${entry.state}`,
    `profile=${entry.enabledByProfile ? 'on' : 'off'}`,
    `user=${entry.enabledByUser ? 'on' : 'off'}`,
    entry.approvalRequired ? `approval=${entry.approvalScope || 'required'}` : 'approval=none',
  ];
  const note = entry.notes ? ` | note=${entry.notes}` : '';
  return `- ${entry.capabilityId} (${entry.label}): ${flags.join(', ')}${note}`;
}

function runStatus(options: CliOptions): void {
  const lifecycleService = createLifecycleService(options.stateFilePath);
  const snapshot = lifecycleService.buildSnapshot();
  const capabilities = options.packId
    ? [lifecycleService.describeCapability(options.packId)].filter(Boolean)
    : snapshot.capabilities.filter((entry) => options.showAllCapabilities || PACK_IDS.includes(entry.capabilityId));

  if (capabilities.length === 0) {
    throw new Error(`Nao encontrei esse pack/capability. Packs suportados: ${PACK_IDS.join(', ')}.`);
  }

  console.log(
    [
      `[pack-status] profile=${snapshot.profile} policy=${snapshot.policy}`,
      `[pack-status] active=${snapshot.summary.active} dormant=${snapshot.summary.dormant} approval=${snapshot.summary.requiringApproval}`,
      ...capabilities.map((entry) => renderCapabilityLine(entry!)),
      '[pack-status] Use /capabilities no Telegram para o detalhamento completo dentro do runtime.',
    ].join('\n'),
  );
}

function runAdd(options: CliOptions): void {
  const packId = resolveCapabilityProvisionSpec(options.packId!).id;
  const lifecycleService = createLifecycleService(options.stateFilePath);
  if (!options.skipInstall) {
    installCapabilityDependencies(resolveCapabilityProvisionSpec(packId));
  }
  const snapshot = lifecycleService.enableCapability(packId, 'pack:add script', options.scope);
  if (!snapshot) {
    throw new Error(`Nao consegui habilitar o pack ${packId}.`);
  }

  console.log(
    [
      `[pack-add] Pack ${packId} habilitado com escopo ${options.scope}.`,
      renderCapabilityLine(snapshot),
      options.skipInstall
        ? '[pack-add] Instalacao opcional pulada por --skip-install.'
        : `[pack-add] Provisionamento npm concluido para ${packId} quando aplicavel.`,
    ].join('\n'),
  );
}

function runRemove(options: CliOptions): void {
  const packId = resolveCapabilityProvisionSpec(options.packId!).id;
  const lifecycleService = createLifecycleService(options.stateFilePath);
  const snapshot = lifecycleService.disableCapability(packId, 'pack:remove script');
  if (!snapshot) {
    throw new Error(`Nao consegui desabilitar o pack ${packId}.`);
  }

  const cleanedPaths = options.skipClean ? [] : cleanCapabilityArtifacts(resolveCapabilityProvisionSpec(packId));
  console.log(
    [
      `[pack-remove] Pack ${packId} desabilitado.`,
      renderCapabilityLine(snapshot),
      options.skipClean
        ? '[pack-remove] Cleanup adicional pulado por --skip-clean.'
        : `[pack-remove] Cleanup adicional removeu ${cleanedPaths.length} path(s).`,
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.action === 'status') {
    runStatus(options);
    return;
  }
  if (options.action === 'add') {
    runAdd(options);
    return;
  }
  runRemove(options);
}

main().catch((error) => {
  console.error(`[pack-manage] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
