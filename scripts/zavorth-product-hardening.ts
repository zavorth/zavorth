import { ZavorthProductHardeningService } from '../src/services/ZavorthProductHardeningService.js';

const json = process.argv.includes('--json');
const strict = process.argv.includes('--strict') || process.argv.includes('--require-pass');

async function main(): Promise<void> {
  const restoreConsole = json ? silenceConsoleLog() : () => undefined;
  const service = new ZavorthProductHardeningService({ projectRoot: process.cwd() });
  const snapshot = await service.buildSnapshot();
  restoreConsole();

  if (json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  if (strict && snapshot.status !== 'ready') {
    process.exit(1);
  }
}

function silenceConsoleLog(): () => void {
  const originalLog = console.log;
  console.log = (...values: unknown[]) => {
    process.stderr.write(`${values.map((value) => String(value)).join(' ')}\n`);
  };
  return () => {
    console.log = originalLog;
  };
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[zavorth-product-hardening] failed: ${message}\n`);
  process.exit(1);
});
