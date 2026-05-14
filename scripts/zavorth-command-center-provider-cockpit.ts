import { ZavorthCommandCenterProviderCockpitService } from '../src/services/ZavorthCommandCenterProviderCockpitService.js';

function readFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] || null : null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const service = new ZavorthCommandCenterProviderCockpitService();
  const projection = await service.buildProjection({
    includeAdvanced: argv.includes('--advanced'),
    providerId: readFlag(argv, 'provider'),
    selectedProviderId: readFlag(argv, 'selected-provider') || readFlag(argv, 'provider'),
    live: argv.includes('--live'),
    allowAllLive: argv.includes('--all'),
  });

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(projection));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
