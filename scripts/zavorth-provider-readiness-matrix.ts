import { ZavorthProviderReadinessMatrixService } from '../src/services/ZavorthProviderReadinessMatrixService.js';

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
  const action = String(positional[0] || 'matrix').trim().toLowerCase();
  const providerId = readFlag(argv, 'provider') || (action === 'test' ? positional[1] : positional[0]);
  const service = new ZavorthProviderReadinessMatrixService();
  const live = argv.includes('--live') || action === 'live';
  const snapshot = await service.buildLiveSnapshot({
    includeAdvanced: argv.includes('--advanced'),
    providerId: providerId && providerId !== 'matrix' && providerId !== 'live' ? providerId : null,
    probe: action === 'test' || argv.includes('--probe'),
    live,
    allowAllLive: argv.includes('--all'),
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
