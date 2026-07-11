import { TimeToFirstUsefulWorkService } from '../src/services/agent-smartness/TimeToFirstUsefulWorkService.js';

function readArg(prefix: string): string | null {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return null;
  const value = found.slice(prefix.length).trim();
  return value || null;
}

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const asRecord = process.argv.includes('--record');
  const requireMeasured = process.argv.includes('--require-measured');
  const service = new TimeToFirstUsefulWorkService({ projectRoot: process.cwd() });

  if (asRecord) {
    const startedAt = readArg('--started=') || readArg('--started-at=');
    const firstUsefulAt = readArg('--first-useful=') || readArg('--first-useful-at=');
    if (!startedAt || !firstUsefulAt) {
      process.stderr.write(
        'Record requires --started=<iso> and --first-useful=<iso> (provider must already be configured for under-3-min claim).\n',
      );
      process.exitCode = 1;
      return;
    }
    const surfaceRaw = (readArg('--surface=') || 'other').toLowerCase();
    const surface = (
      surfaceRaw === 'desktop'
      || surfaceRaw === 'cli'
      || surfaceRaw === 'control'
      || surfaceRaw === 'other'
    )
      ? surfaceRaw
      : 'other';
    const measurement = service.record({
      startedAt,
      firstUsefulAt,
      surface,
      providerId: readArg('--provider='),
      notes: readArg('--notes=') || undefined,
      providerAlreadyConfigured: !process.argv.includes('--include-setup-time'),
    });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(measurement, null, 2)}\n`);
    } else {
      process.stdout.write(
        `Recorded TTFU ${measurement.durationMs}ms underBudget=${measurement.underBudget} provider=${measurement.providerId}\n`,
      );
    }
    process.exitCode = measurement.underBudget || !asCheck ? 0 : 1;
    return;
  }

  const report = service.run({ requireMeasured });
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(report)}\n`);
  }

  if (asCheck && !report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
