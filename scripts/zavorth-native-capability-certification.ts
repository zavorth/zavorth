import { ZavorthNativeCapabilityCertificationService } from '../src/services/ZavorthNativeCapabilityCertificationService.js';

const json = process.argv.includes('--json');
const strict = process.argv.includes('--strict') || process.argv.includes('--require-ready');
const evidenceRoot = readFlag('--evidence-root');

async function main(): Promise<void> {
  const service = new ZavorthNativeCapabilityCertificationService({
    projectRoot: process.cwd(),
    ...(evidenceRoot ? { evidenceRoot } : {}),
  });
  const snapshot = await service.buildSnapshot();
  process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
  if (strict && snapshot.status !== 'ready') {
    process.exit(1);
  }
}

function readFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`zavorth native capability certification failed: ${message}\n`);
  process.exit(1);
});
