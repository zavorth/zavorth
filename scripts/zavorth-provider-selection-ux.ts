import { ZavorthProviderSelectionUxService } from '../src/services/ZavorthProviderSelectionUxService.js';

const SUPPORTED_FLAGS = ['--provider', '--target', '--intent', '--profile', '--require-live', '--live-proof'] as const;

function readFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] || null : null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const service = new ZavorthProviderSelectionUxService();
  const snapshot = await service.buildSnapshot({
    includeAdvanced: argv.includes('--advanced'),
    target: readFlag(argv, 'provider') || readFlag(argv, 'target') || positional[0],
    providerId: readFlag(argv, 'provider') || readFlag(argv, 'target') || positional[0],
    intent: readFlag(argv, 'intent') || readFlag(argv, 'profile') || positional[1],
    requireLiveEvidence: argv.includes('--require-live') || argv.includes('--live-proof'),
    live: argv.includes('--live'),
  });

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
