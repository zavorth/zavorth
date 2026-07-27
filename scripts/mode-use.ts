import path from 'path';
import { CapabilityLifecycleService } from '../src/services/CapabilityLifecycleService.js';
import { EnvFileService } from '../src/services/EnvFileService.js';
import {
  isZavorthProductMode,
  normalizeZavorthProductMode,
  resolveDefaultRuntimeProfileForProductMode,
} from '../src/services/ProductModeService.js';
import { RuntimeProfileService } from '../src/services/RuntimeProfileService.js';

type CliOptions = {
  mode: 'chat' | 'assistant' | 'builder' | 'operator';
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
  const requestedRawMode = String(argv[0] || '').trim().toLowerCase();
  if (!requestedRawMode) {
    throw new Error('Use npm run mode:use -- <chat|assistant|builder|operator> [--env-path <path>] [--state-path <path>].');
  }
  if (!isZavorthProductMode(requestedRawMode)) {
    throw new Error('Product mode invalid. Use: chat, assistant, builder ou operator.');
  }
  const requestedMode = normalizeZavorthProductMode(requestedRawMode, 'core');

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
    mode: requestedMode,
    envFilePath,
    stateFilePath,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const mappedProfile = resolveDefaultRuntimeProfileForProductMode(options.mode);
  const envFileService = new EnvFileService();
  const envWriteReport = envFileService.upsertEntries(options.envFilePath, [
    {
      key: 'ZAVORTH_PRODUCT_MODE',
      value: options.mode,
      overwrite: true,
    },
    {
      key: 'ZAVORTH_PROFILE',
      value: mappedProfile,
      overwrite: true,
    },
  ]);

  const runtimeProfileService = new RuntimeProfileService(mappedProfile);
  const capabilityLifecycleService = new CapabilityLifecycleService({
    runtimeProfileService,
    stateFilePath: options.stateFilePath,
  });
  const persisted = capabilityLifecycleService.setProductMode(options.mode, 'mode-use script');

  console.log(
    [
      `[mode-use] Product mode persistido: ${persisted.id}.`,
      `[mode-use] Perfil base alinhado: ${persisted.runtimeProfile}.`,
      `[mode-use] .env: ${envWriteReport.filePath}`,
      `[mode-use] lifecycle: ${options.stateFilePath || 'state file default do runtime'}`,
      '[mode-use] Restart Zavorth to reapply boot, warmup, and surfaces for the new mode.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(`[mode-use] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
