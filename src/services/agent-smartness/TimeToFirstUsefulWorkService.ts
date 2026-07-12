import fs from 'node:fs';
import path from 'node:path';
import { resolveUserProviderSelection } from '../UserSelectionResolver.js';

/** Product target: first useful assistant work under 3 minutes when provider is already set. */
export const TTFU_BUDGET_MS = 180_000;

export type TtfuMeasurement = {
  id: string;
  surface: 'desktop' | 'cli' | 'control' | 'other';
  providerId: string;
  providerAlreadyConfigured: boolean;
  startedAt: string;
  firstUsefulAt: string;
  durationMs: number;
  underBudget: boolean;
  notes?: string;
  /** Optional link back to a live smartness run / receipt id. */
  sourceRunId?: string;
  recordedAt: string;
};

export type TtfuWallClockInput = {
  surface?: TtfuMeasurement['surface'];
  providerId?: string | null;
  providerAlreadyConfigured?: boolean;
  startedAt: Date | string;
  firstUsefulAt: Date | string;
  notes?: string;
  sourceRunId?: string;
};

/** Minimal live smartness report shape accepted by TTFU product-path recording. */
export type LiveSmartnessReportForTtfu = {
  generatedAt?: string;
  claimsLiveIntelligence?: boolean;
  multiStepOk?: boolean;
  liveOk?: boolean;
  live?: Array<{
    id: string;
    status: string;
    notes?: string;
    evidence?: Record<string, unknown>;
  }>;
  timing?: {
    startedAt?: string;
    firstUsefulAt?: string;
    durationMs?: number;
  };
  [key: string]: unknown;
};

export type TtfuStructuralCheck = {
  ok: boolean;
  budgetMs: number;
  checks: Array<{ id: string; pass: boolean; notes: string }>;
};

export type TtfuReport = {
  generatedAt: string;
  version: 'ttfu/v1';
  structural: TtfuStructuralCheck;
  latestMeasurement: TtfuMeasurement | null;
  measuredUnderBudget: boolean | null;
  claimsMeasuredUnder3Min: boolean;
  ok: boolean;
  notes: string[];
};

function measurementsPath(projectRoot: string): string {
  return path.join(projectRoot, 'data', 'product', 'ttfu-measurements.json');
}

function readMeasurements(projectRoot: string): TtfuMeasurement[] {
  const file = measurementsPath(projectRoot);
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { measurements?: TtfuMeasurement[] };
    return Array.isArray(parsed.measurements) ? parsed.measurements : [];
  } catch {
    return [];
  }
}

function writeMeasurements(projectRoot: string, measurements: TtfuMeasurement[]): void {
  const file = measurementsPath(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${JSON.stringify({ version: 1, measurements }, null, 2)}\n`,
    'utf8',
  );
}

function toIsoTimestamp(value: Date | string, label: string): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new Error(`Invalid ${label} Date for TTFU measurement.`);
    }
    return value.toISOString();
  }
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label} timestamp for TTFU measurement.`);
  }
  return new Date(parsed).toISOString();
}

function multiStepPassed(report: LiveSmartnessReportForTtfu): boolean {
  if (report.multiStepOk === true || report.claimsLiveIntelligence === true) {
    return true;
  }
  const live = Array.isArray(report.live) ? report.live : [];
  return live.some(
    (entry) => entry.id === 'live.multi-step.tool-plan' && entry.status === 'pass',
  );
}

function evidenceCredentialSourceIsSelection(report: LiveSmartnessReportForTtfu): boolean {
  const live = Array.isArray(report.live) ? report.live : [];
  for (const entry of live) {
    const source = entry.evidence?.credentialSource;
    if (source === 'selection') return true;
  }
  return false;
}

function providerIdFromLiveReport(report: LiveSmartnessReportForTtfu): string | null {
  const live = Array.isArray(report.live) ? report.live : [];
  const preferred = [
    ...live.filter((entry) => entry.id === 'live.multi-step.tool-plan'),
    ...live.filter((entry) => entry.id === 'live.llm.probe'),
    ...live,
  ];
  for (const entry of preferred) {
    const id = entry.evidence?.providerId;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

export class TimeToFirstUsefulWorkService {
  constructor(
    private readonly options: {
      /** Where measurements are stored (data/product). */
      projectRoot?: string;
      /** Repo root for structural file checks (defaults to process.cwd()). */
      codeRoot?: string;
      env?: NodeJS.ProcessEnv;
      now?: () => Date;
    } = {},
  ) {}

  public structuralCheck(): TtfuStructuralCheck {
    const root = this.options.codeRoot || process.cwd();
    const checks: TtfuStructuralCheck['checks'] = [];

    const dailyPe = path.join(root, 'src', 'services', 'ZavorthDailyProductExperienceService.ts');
    checks.push({
      id: 'daily-pe-service',
      pass: fs.existsSync(dailyPe),
      notes: fs.existsSync(dailyPe)
        ? 'Daily product experience service present (chatReady / happyPath).'
        : 'Missing ZavorthDailyProductExperienceService.',
    });

    const starterAsk = path.join(root, 'apps', 'zavorth-desktop', 'src', 'onboarding', 'desktopOnboarding.ts');
    checks.push({
      id: 'desktop-starter-ask',
      pass: fs.existsSync(starterAsk),
      notes: fs.existsSync(starterAsk)
        ? 'Desktop first-win / starter ask surface present.'
        : 'Missing desktop onboarding starter ask.',
    });

    const selection = path.join(root, 'src', 'services', 'UserSelectionResolver.ts');
    checks.push({
      id: 'user-selection-resolver',
      pass: fs.existsSync(selection),
      notes: fs.existsSync(selection)
        ? 'User provider selection resolver present (TTFU assumes provider already set).'
        : 'Missing UserSelectionResolver.',
    });

    const trail = path.join(root, 'docs', 'daily-use-trail.md');
    checks.push({
      id: 'daily-use-trail-doc',
      pass: fs.existsSync(trail),
      notes: fs.existsSync(trail)
        ? 'Daily use trail documented.'
        : 'Missing daily-use-trail.md.',
    });

    checks.push({
      id: 'budget-constant',
      pass: TTFU_BUDGET_MS === 180_000,
      notes: `TTFU budget is ${TTFU_BUDGET_MS}ms (target under 3 minutes).`,
    });

    return {
      ok: checks.every((entry) => entry.pass),
      budgetMs: TTFU_BUDGET_MS,
      checks,
    };
  }

  public listMeasurements(): TtfuMeasurement[] {
    return readMeasurements(this.options.projectRoot || process.cwd());
  }

  /**
   * Canonical wall-clock write path for product TTFU measurements.
   * Accepts Date or ISO string timestamps; never invents durations.
   */
  public recordFromWallClock(input: TtfuWallClockInput): TtfuMeasurement {
    return this.record({
      surface: input.surface,
      providerId: input.providerId,
      providerAlreadyConfigured: input.providerAlreadyConfigured,
      startedAt: toIsoTimestamp(input.startedAt, 'startedAt'),
      firstUsefulAt: toIsoTimestamp(input.firstUsefulAt, 'firstUsefulAt'),
      notes: input.notes,
      sourceRunId: input.sourceRunId,
    });
  }

  /**
   * Record TTFU only from a live smartness report that actually passed multi-step
   * (claimsLiveIntelligence / multiStepOk). Refuses probe-only or failed runs.
   *
   * `providerAlreadyConfigured` is true only when user selection is configured
   * or live evidence shows credentialSource === 'selection'.
   */
  public recordFromLiveSmartnessReport(
    report: LiveSmartnessReportForTtfu,
    timings: { startedAt: string; firstUsefulAt: string },
    options: {
      surface?: TtfuMeasurement['surface'];
      notes?: string;
      sourceRunId?: string;
      providerId?: string | null;
    } = {},
  ): TtfuMeasurement {
    if (!multiStepPassed(report)) {
      throw new Error(
        'TTFU refuses to record: live multi-step tool-plan did not pass '
        + '(multiStepOk/claimsLiveIntelligence required). '
        + 'Do not invent fake TTFU measurements from probe-only or failed runs.',
      );
    }

    const root = this.options.projectRoot || process.cwd();
    const selection = resolveUserProviderSelection({
      projectRoot: root,
      env: this.options.env,
    });
    const selectionConfigured = Boolean(selection.configured && selection.providerId);
    const evidenceSelection = evidenceCredentialSourceIsSelection(report);
    const providerAlreadyConfigured = selectionConfigured || evidenceSelection;

    const providerId = options.providerId
      || providerIdFromLiveReport(report)
      || selection.providerId
      || null;

    const timingNotes = [
      options.notes,
      'source=live-smartness-multi-step',
      report.generatedAt ? `reportGeneratedAt=${report.generatedAt}` : null,
    ].filter(Boolean).join('; ');

    return this.recordFromWallClock({
      surface: options.surface || 'cli',
      providerId,
      providerAlreadyConfigured,
      startedAt: timings.startedAt,
      firstUsefulAt: timings.firstUsefulAt,
      notes: timingNotes || undefined,
      sourceRunId: options.sourceRunId || (
        typeof report.generatedAt === 'string' ? `live-smartness@${report.generatedAt}` : undefined
      ),
    });
  }

  public record(input: {
    surface?: TtfuMeasurement['surface'];
    providerId?: string | null;
    providerAlreadyConfigured?: boolean;
    startedAt: string;
    firstUsefulAt: string;
    notes?: string;
    sourceRunId?: string;
  }): TtfuMeasurement {
    const root = this.options.projectRoot || process.cwd();
    const now = (this.options.now || (() => new Date()))().toISOString();
    const startedMs = Date.parse(input.startedAt);
    const usefulMs = Date.parse(input.firstUsefulAt);
    if (!Number.isFinite(startedMs) || !Number.isFinite(usefulMs) || usefulMs < startedMs) {
      throw new Error('Invalid startedAt / firstUsefulAt timestamps for TTFU measurement.');
    }
    const durationMs = usefulMs - startedMs;
    const selection = resolveUserProviderSelection({
      projectRoot: root,
      env: this.options.env,
    });
    const providerId = String(input.providerId || selection.providerId || 'unconfigured');
    // Honesty: default true only when selection is actually configured — never invent preconfigured.
    const providerAlreadyConfigured = input.providerAlreadyConfigured
      ?? Boolean(selection.configured && selection.providerId);

    const measurement: TtfuMeasurement = {
      id: `ttfu-${Date.now().toString(36)}`,
      surface: input.surface || 'other',
      providerId,
      providerAlreadyConfigured,
      startedAt: new Date(startedMs).toISOString(),
      firstUsefulAt: new Date(usefulMs).toISOString(),
      durationMs,
      underBudget: providerAlreadyConfigured && durationMs <= TTFU_BUDGET_MS,
      notes: input.notes,
      sourceRunId: input.sourceRunId,
      recordedAt: now,
    };

    const existing = readMeasurements(root);
    existing.push(measurement);
    // Keep last 50 only
    writeMeasurements(root, existing.slice(-50));
    return measurement;
  }

  public run(input: { requireMeasured?: boolean } = {}): TtfuReport {
    const structural = this.structuralCheck();
    const measurements = this.listMeasurements();
    const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
    const measuredUnderBudget = latest
      ? (latest.providerAlreadyConfigured && latest.underBudget)
      : null;
    const notes: string[] = [];

    if (!structural.ok) {
      notes.push('Structural TTFU path is incomplete.');
    } else {
      notes.push('Structural path for under-3-minute first useful work is present.');
    }

    if (!latest) {
      notes.push(
        'No TTFU measurement recorded yet. Record with `npm run value:ttfu -- --record '
        + '--started=<iso> --first-useful=<iso>` after a real session with provider already set.',
      );
    } else if (measuredUnderBudget) {
      notes.push(
        `Latest measurement ${latest.durationMs}ms under budget with provider ${latest.providerId}.`,
      );
    } else if (latest && !latest.providerAlreadyConfigured) {
      notes.push('Latest measurement excluded provider setup time requirement (provider was not preconfigured).');
    } else if (latest) {
      notes.push(`Latest measurement ${latest.durationMs}ms exceeded ${TTFU_BUDGET_MS}ms budget.`);
    }

    const claimsMeasuredUnder3Min = measuredUnderBudget === true;
    const ok = structural.ok && (!input.requireMeasured || claimsMeasuredUnder3Min);

    return {
      generatedAt: (this.options.now || (() => new Date()))().toISOString(),
      version: 'ttfu/v1',
      structural,
      latestMeasurement: latest,
      measuredUnderBudget,
      claimsMeasuredUnder3Min,
      ok,
      notes,
    };
  }

  public renderText(report: TtfuReport): string {
    const lines = [
      'Zavorth time-to-first-useful-work (TTFU)',
      `budgetMs: ${report.structural.budgetMs}`,
      `structuralOk: ${report.structural.ok ? 'yes' : 'no'}`,
      `claimsMeasuredUnder3Min: ${report.claimsMeasuredUnder3Min ? 'yes' : 'no'}`,
      `ok: ${report.ok ? 'yes' : 'no'}`,
      '',
      '[structural]',
      ...report.structural.checks.map((c) => `- [${c.pass ? 'pass' : 'fail'}] ${c.id}: ${c.notes}`),
      '',
      '[measurement]',
      report.latestMeasurement
        ? `- latest: ${report.latestMeasurement.durationMs}ms provider=${report.latestMeasurement.providerId} underBudget=${report.latestMeasurement.underBudget}`
        : '- latest: none',
      '',
      ...report.notes.map((note) => `note: ${note}`),
    ];
    return lines.join('\n');
  }
}
