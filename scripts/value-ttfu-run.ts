import fs from 'node:fs';
import {
  TimeToFirstUsefulWorkService,
  type LiveSmartnessReportForTtfu,
  type TtfuMeasurement,
} from '../src/services/agent-smartness/TimeToFirstUsefulWorkService.js';

function readArg(prefix: string): string | null {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return null;
  const value = found.slice(prefix.length).trim();
  return value || null;
}

function parseSurface(raw: string | null, fallback: TtfuMeasurement['surface']): TtfuMeasurement['surface'] {
  const surfaceRaw = (raw || fallback).toLowerCase();
  if (
    surfaceRaw === 'desktop'
    || surfaceRaw === 'cli'
    || surfaceRaw === 'control'
    || surfaceRaw === 'other'
  ) {
    return surfaceRaw;
  }
  return fallback;
}

function readLiveJson(pathOrStdin: string): LiveSmartnessReportForTtfu {
  const raw = pathOrStdin === '-'
    ? fs.readFileSync(0, 'utf8')
    : fs.readFileSync(pathOrStdin, 'utf8');
  const parsed = JSON.parse(raw) as LiveSmartnessReportForTtfu;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Live JSON must be an object report (agent-smartness-live/v1).');
  }
  return parsed;
}

function resolveTimingsFromLive(
  report: LiveSmartnessReportForTtfu,
  cliStarted: string | null,
  cliFirstUseful: string | null,
): { startedAt: string; firstUsefulAt: string } {
  const startedAt = cliStarted
    || report.timing?.startedAt
    || null;
  const firstUsefulAt = cliFirstUseful
    || report.timing?.firstUsefulAt
    || null;
  if (!startedAt || !firstUsefulAt) {
    throw new Error(
      'Recording from live JSON requires wall-clock timings: pass --started=<iso> '
      + 'and --first-useful=<iso>, or include report.timing.{startedAt,firstUsefulAt} '
      + '(from agent:smartness:live which stamps wall-clock on multi-step success).',
    );
  }
  return { startedAt, firstUsefulAt };
}

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const asRecord = process.argv.includes('--record');
  const requireMeasured = process.argv.includes('--require-measured');
  const fromLiveJson = readArg('--from-live-json=');
  const service = new TimeToFirstUsefulWorkService({ projectRoot: process.cwd() });

  if (fromLiveJson !== null || asRecord) {
    // Live product path: record only from multi-step success + real wall-clock.
    if (fromLiveJson !== null) {
      const report = readLiveJson(fromLiveJson);
      const timings = resolveTimingsFromLive(
        report,
        readArg('--started=') || readArg('--started-at='),
        readArg('--first-useful=') || readArg('--first-useful-at='),
      );
      // Default surface=cli when recording from live multi-step success.
      const surface = parseSurface(readArg('--surface='), 'cli');
      try {
        const measurement = service.recordFromLiveSmartnessReport(report, timings, {
          surface,
          providerId: readArg('--provider='),
          notes: readArg('--notes=') || undefined,
          sourceRunId: readArg('--source-run-id=') || undefined,
        });
        if (asJson) {
          process.stdout.write(`${JSON.stringify(measurement, null, 2)}\n`);
        } else {
          process.stdout.write(
            `Recorded TTFU from live multi-step ${measurement.durationMs}ms `
            + `underBudget=${measurement.underBudget} provider=${measurement.providerId} `
            + `providerAlreadyConfigured=${measurement.providerAlreadyConfigured}\n`,
          );
        }
        process.exitCode = measurement.underBudget || !asCheck ? 0 : 1;
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
      return;
    }

    if (asRecord) {
      const startedAt = readArg('--started=') || readArg('--started-at=');
      const firstUsefulAt = readArg('--first-useful=') || readArg('--first-useful-at=');
      if (!startedAt || !firstUsefulAt) {
        process.stderr.write(
          'Record requires --started=<iso> and --first-useful=<iso>, '
          + 'or use --from-live-json=<path|-> with live multi-step wall-clock timings.\n',
        );
        process.exitCode = 1;
        return;
      }
      const surface = parseSurface(readArg('--surface='), 'other');
      // Honesty: only mark preconfigured when explicitly opted in, never by default.
      // Use --provider-already-configured to claim setup was already done; --include-setup-time forces false.
      const includeSetup = process.argv.includes('--include-setup-time');
      const explicitConfigured = process.argv.includes('--provider-already-configured');
      const measurement = service.recordFromWallClock({
        startedAt,
        firstUsefulAt,
        surface,
        providerId: readArg('--provider='),
        notes: readArg('--notes=') || undefined,
        sourceRunId: readArg('--source-run-id=') || undefined,
        providerAlreadyConfigured: includeSetup
          ? false
          : (explicitConfigured ? true : undefined),
      });
      if (asJson) {
        process.stdout.write(`${JSON.stringify(measurement, null, 2)}\n`);
      } else {
        process.stdout.write(
          `Recorded TTFU ${measurement.durationMs}ms underBudget=${measurement.underBudget} `
          + `provider=${measurement.providerId} providerAlreadyConfigured=${measurement.providerAlreadyConfigured}\n`,
        );
      }
      process.exitCode = measurement.underBudget || !asCheck ? 0 : 1;
      return;
    }
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
