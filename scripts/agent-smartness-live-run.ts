import { AgentSmartnessLiveService, type LiveSmartnessReport } from '../src/services/agent-smartness/AgentSmartnessLiveService.js';
import { TimeToFirstUsefulWorkService } from '../src/services/agent-smartness/TimeToFirstUsefulWorkService.js';

export type LiveSmartnessReportWithTiming = LiveSmartnessReport & {
  timing: {
    startedAt: string;
    firstUsefulAt: string;
    durationMs: number;
  };
  ttfuRecorded?: {
    id: string;
    durationMs: number;
    underBudget: boolean;
    providerId: string;
    providerAlreadyConfigured: boolean;
  } | null;
};

function readArg(prefix: string): string | null {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return null;
  const value = found.slice(prefix.length).trim();
  return value || null;
}

function shouldRecordTtfu(): boolean {
  if (process.argv.includes('--record-ttfu')) return true;
  const env = process.env.ZAVORTH_TTFU_FROM_LIVE;
  return env === '1' || env === 'true';
}

function parseSurface(raw: string | null): 'desktop' | 'cli' | 'control' | 'other' {
  const surfaceRaw = (raw || 'cli').toLowerCase();
  if (
    surfaceRaw === 'desktop'
    || surfaceRaw === 'cli'
    || surfaceRaw === 'control'
    || surfaceRaw === 'other'
  ) {
    return surfaceRaw;
  }
  return 'cli';
}

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const live = process.argv.includes('--live')
    || process.env.ZAVORTH_LIVE_SMARTNESS === '1'
    || process.env.ZAVORTH_LIVE_SMARTNESS === 'true';
  const allowBlocked = process.argv.includes('--allow-blocked');
  const recordTtfu = shouldRecordTtfu();

  // Wall-clock honesty: real process time around the live harness, not self-reported fiction.
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();

  const report = await new AgentSmartnessLiveService({
    projectRoot: process.cwd(),
    env: process.env,
  }).run({ live });

  // firstUsefulAt = after multi-step harness completes (end of run when multi-step was attempted last).
  const firstUsefulAtDate = new Date();
  const firstUsefulAt = firstUsefulAtDate.toISOString();
  const durationMs = Math.max(0, firstUsefulAtDate.getTime() - startedAtDate.getTime());

  const reportWithTiming: LiveSmartnessReportWithTiming = {
    ...report,
    timing: {
      startedAt,
      firstUsefulAt,
      durationMs,
    },
    ttfuRecorded: null,
  };

  // Never record TTFU if multi-step failed / blocked / not claimed live intelligence.
  if (recordTtfu && report.multiStepOk && report.claimsLiveIntelligence) {
    try {
      const ttfu = new TimeToFirstUsefulWorkService({ projectRoot: process.cwd() });
      const measurement = ttfu.recordFromLiveSmartnessReport(
        reportWithTiming,
        { startedAt, firstUsefulAt },
        {
          surface: parseSurface(readArg('--surface=')),
          notes: readArg('--notes=')
            || `auto-recorded from agent-smartness-live wall-clock; multiStepOk=true durationMs=${durationMs}`,
          sourceRunId: `live-smartness@${report.generatedAt}`,
        },
      );
      reportWithTiming.ttfuRecorded = {
        id: measurement.id,
        durationMs: measurement.durationMs,
        underBudget: measurement.underBudget,
        providerId: measurement.providerId,
        providerAlreadyConfigured: measurement.providerAlreadyConfigured,
      };
    } catch (error) {
      process.stderr.write(
        `TTFU auto-record skipped/failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  } else if (recordTtfu && !report.multiStepOk) {
    process.stderr.write(
      'TTFU not recorded: multi-step tool-plan did not pass (never invent TTFU from failed/blocked runs).\n',
    );
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(reportWithTiming, null, 2)}\n`);
  } else {
    process.stdout.write(`${new AgentSmartnessLiveService().renderText(report)}\n`);
    process.stdout.write(
      `\n[timing] startedAt=${startedAt} firstUsefulAt=${firstUsefulAt} durationMs=${durationMs}\n`,
    );
    if (reportWithTiming.ttfuRecorded) {
      process.stdout.write(
        `[ttfu] recorded ${reportWithTiming.ttfuRecorded.durationMs}ms `
        + `underBudget=${reportWithTiming.ttfuRecorded.underBudget} `
        + `provider=${reportWithTiming.ttfuRecorded.providerId}\n`,
      );
    }
  }

  if (!asCheck) return;
  if (!report.hermeticOk) {
    process.exitCode = 1;
    return;
  }
  if (live && !report.liveOk) {
    if (report.blockedOnly && allowBlocked) {
      process.stderr.write('Live cells blocked (credentials/manual). Allowed by --allow-blocked.\n');
      return;
    }
    process.stderr.write('Live smartness requested but liveOk is false (blocked or failed).\n');
    process.exitCode = report.blockedOnly ? 2 : 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
