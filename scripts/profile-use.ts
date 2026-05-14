import path from 'path';
import { CapabilityLifecycleService } from '../src/services/CapabilityLifecycleService.js';
import { EnvFileService } from '../src/services/EnvFileService.js';
import { normalizeZavorthProfile, RuntimeProfileService } from '../src/services/RuntimeProfileService.js';

type CliOptions = {
  profile: 'core' | 'ops' | 'full';
  envFilePath: string;
  stateFilePath?: string;
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
  const requestedProfile = String(argv[0] || '').trim().toLowerCase();
  if (!requestedProfile || !['core', 'ops', 'full'].includes(requestedProfile)) {
    throw new Error('Use npm run profile:use -- <core|ops|full> [--env-path <path>] [--state-path <path>].');
  }

  let envFilePath = path.resolve(process.cwd(), '.env');
  let stateFilePath: string | undefined;

  for (let index = 1; index < argv.length; index += 1) {
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
    }
  }

  return {
    profile: normalizeZavorthProfile(requestedProfile),
    envFilePath,
    stateFilePath,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const envFileService = new EnvFileService();
  const envWriteReport = envFileService.upsertEntries(options.envFilePath, [
    {
      key: 'ZAVORTH_PROFILE',
      value: options.profile,
      overwrite: true,
    },
  ]);

  const runtimeProfileService = new RuntimeProfileService(options.profile);
  const capabilityLifecycleService = new CapabilityLifecycleService({
    runtimeProfileService,
    stateFilePath: options.stateFilePath,
  });
  const persistedProfile = capabilityLifecycleService.setProfile(options.profile, 'profile-use script');

  console.log(
    [
      `[profile-use] Perfil persistido: ${persistedProfile}.`,
      `[profile-use] .env: ${envWriteReport.filePath}`,
      `[profile-use] lifecycle: ${options.stateFilePath || 'state file default do runtime'}`,
      '[profile-use] Reinicie o Zavorth para reaplicar todos os gates de boot/preaquecimento.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(`[profile-use] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
