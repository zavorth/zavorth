import path from 'path';
import { cleanCapabilityArtifacts, resolveCapabilityProvisionSpec } from './capability-provision.js';
import { CapabilityLifecycleService } from '../src/services/CapabilityLifecycleService.js';
import { EnvFileService } from '../src/services/EnvFileService.js';
import { RuntimeProfileService } from '../src/services/RuntimeProfileService.js';

type CliOptions = {
  envFilePath: string;
  stateFilePath?: string;
  skipClean: boolean;
};

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
  let envFilePath = path.resolve(process.cwd(), '.env');
  let stateFilePath: string | undefined;
  let skipClean = false;

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim();
    if (current === '--env-path' || current === '--env-file') {
      const parsed = readOptionValue(argv, index);
      envFilePath = path.resolve(process.cwd(), parsed.value || '.env');
      index = parsed.nextIndex;
      continue;
    }
    if (current === '--state-path' || current === '--state-file') {
      const parsed = readOptionValue(argv, index);
      stateFilePath = path.resolve(process.cwd(), parsed.value);
      index = parsed.nextIndex;
      continue;
    }
    if (current === '--skip-clean') {
      skipClean = true;
    }
  }

  return { envFilePath, stateFilePath, skipClean };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.stateFilePath) {
    process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE = options.stateFilePath;
  }

  const envFileService = new EnvFileService();
  const envWriteReport = envFileService.upsertEntries(options.envFilePath, [
    { key: 'ZAVORTH_PROFILE', value: 'core', overwrite: true },
    { key: 'ZAVORTH_CAPABILITY_POLICY', value: 'ask-on-demand', overwrite: true },
    { key: 'ZAVORTH_SELFMOD_POLICY', value: 'owner_trusted', overwrite: true },
    { key: 'ZAVORTH_ALLOW_STARTUP_INSTALL', value: 'false', overwrite: true },
  ]);

  const lifecycleService = new CapabilityLifecycleService({
    runtimeProfileService: new RuntimeProfileService('core'),
    stateFilePath: options.stateFilePath,
  });
  lifecycleService.setProfile('core', 'install:core script');

  const optionalCapabilities = lifecycleService.getManifests()
    .filter((manifest) => manifest.id !== 'core-runtime')
    .map((manifest) => manifest.id);
  const disabledSnapshots = optionalCapabilities
    .map((capabilityId) => lifecycleService.disableCapability(capabilityId, 'install:core script'))
    .filter(Boolean);

  const cleanedPackIds = options.skipClean
    ? []
    : ['remote', 'media', 'qa', 'sandbox']
      .map((packId) => ({
        packId,
        removedPaths: cleanCapabilityArtifacts(resolveCapabilityProvisionSpec(packId)),
      }))
      .filter((entry) => entry.removedPaths.length > 0);

  console.log(
    [
      '[install-core] Zavorth configured para o modo leve por default.',
      `[install-core] .env: ${envWriteReport.filePath}`,
      `[install-core] optional capabilities disabled: ${disabledSnapshots.length}`,
      `[install-core] extra pack cleanup: ${cleanedPackIds.length} pack(s) with removed artifacts.`,
      '[install-core] Use npm run pack:add -- <remote|media|qa|sandbox> para religar trilhas pesadas sob demanda.',
      '[install-core] Restart Zavorth to reapply all boot gates.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(`[install-core] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
