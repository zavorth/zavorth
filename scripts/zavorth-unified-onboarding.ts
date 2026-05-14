import { ProviderDoctorService } from '../src/services/ProviderDoctorService.js';
import { ZavorthUnifiedOnboardingService } from '../src/services/ZavorthUnifiedOnboardingService.js';

function readFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] || null : null;
}

const argv = process.argv.slice(2);
const service = new ZavorthUnifiedOnboardingService({
  providerDoctor: new ProviderDoctorService(),
});
const snapshot = service.buildSnapshot({
  dailyMode: readFlag(argv, 'mode'),
  detailMode: argv.includes('--advanced') ? 'advanced' : argv.includes('--simple') ? 'simple' : readFlag(argv, 'detail'),
  selectedTemplateId: readFlag(argv, 'template'),
  request: readFlag(argv, 'request'),
  includeAdvanced: argv.includes('--advanced'),
});

if (argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
