import fs from 'node:fs';
import path from 'node:path';
import { KillerMissionCatalogService, type KillerAudience, type KillerMission } from './KillerMissionCatalogService.js';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import { resolveUserProviderSelection } from './UserSelectionResolver.js';

export type KillerExecutionReceipt = {
  id: string;
  missionId: string;
  audience: KillerAudience;
  status: 'pass' | 'fail' | 'skipped' | 'blocked';
  providerId: string | null;
  modelId: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  responsePreview: string;
  signalsMatched: string[];
  notes: string;
  live: boolean;
};

export type KillerExecuteReport = {
  generatedAt: string;
  version: 'killer-execute/v1';
  liveRequested: boolean;
  receipts: KillerExecutionReceipt[];
  ok: boolean;
  executed: number;
  skipped: number;
  failed: number;
};

type ChatRuntime = Pick<LlmRuntimeService, 'chatDetailed'>;

/**
 * Optional credentialed runner: catalog prompt → real chat → receipt under data/product.
 * Without keys: skipped honestly (never synthetic pass).
 */
export class KillerMissionExecuteService {
  constructor(
    private readonly options: {
      projectRoot?: string;
      env?: NodeJS.ProcessEnv;
      runtimeFactory?: (providerId: string) => ChatRuntime;
      now?: () => Date;
    } = {},
  ) {}

  public async run(input: {
    live?: boolean;
    audience?: KillerAudience | null;
    missionId?: string | null;
  } = {}): Promise<KillerExecuteReport> {
    const env = this.options.env || process.env;
    const root = this.options.projectRoot || process.cwd();
    const now = this.options.now || (() => new Date());
    const liveRequested = Boolean(
      input.live
      || env.ZAVORTH_KILLER_LIVE === '1'
      || env.ZAVORTH_KILLER_LIVE === 'true',
    );

    const catalog = new KillerMissionCatalogService();
    let missions = catalog.list(input.audience || null);
    if (input.missionId) {
      missions = missions.filter((mission) => mission.id === input.missionId);
    }

    const receipts: KillerExecutionReceipt[] = [];
    if (!liveRequested) {
      for (const mission of missions) {
        receipts.push(this.skippedReceipt(mission, now(), 'Live not requested. Re-run with --execute --live and configured provider keys.'));
      }
      return this.report(now(), liveRequested, receipts);
    }

    const selection = resolveUserProviderSelection({ projectRoot: root, env });
    if (!selection.providerId) {
      for (const mission of missions) {
        receipts.push(this.skippedReceipt(
          mission,
          now(),
          'No provider selected. Set LLM_PROVIDER / preference, then retry with --execute --live.',
          'blocked',
        ));
      }
      return this.report(now(), liveRequested, receipts);
    }

    for (const mission of missions) {
      receipts.push(await this.executeOne(mission, selection.providerId, selection.modelId, root, now));
    }

    const report = this.report(now(), liveRequested, receipts);
    this.persistReceipts(root, receipts);
    return report;
  }

  public renderText(report: KillerExecuteReport): string {
    return [
      'Zavorth killer mission execution',
      `liveRequested: ${report.liveRequested ? 'yes' : 'no'}`,
      `ok: ${report.ok ? 'yes' : 'no'} executed=${report.executed} skipped=${report.skipped} failed=${report.failed}`,
      '',
      ...report.receipts.map((receipt) => (
        `- [${receipt.status}] ${receipt.missionId} provider=${receipt.providerId || 'none'} signals=${receipt.signalsMatched.join(',') || 'none'} — ${receipt.notes}`
      )),
    ].join('\n');
  }

  private async executeOne(
    mission: KillerMission,
    providerId: string,
    modelId: string | null,
    root: string,
    now: () => Date,
  ): Promise<KillerExecutionReceipt> {
    const started = now();
    const startedAt = started.toISOString();
    try {
      const runtime = this.options.runtimeFactory?.(providerId) || new LlmRuntimeService(providerId);
      const result = await runtime.chatDetailed(
        [{ role: 'user', content: mission.prompt }],
        [],
        {
          providerName: providerId,
          ...(modelId ? { modelName: modelId } : {}),
          // Certification runs stay on the user-selected provider only.
          allowFallback: false,
        },
      );
      const finished = now();
      const text = String(result.response.content || '');
      const lower = text.toLowerCase();
      const signalsMatched = mission.expectedSignals.filter((signal) => lower.includes(signal.toLowerCase()));
      // Require a non-trivial reply and majority of expected signals (not a single common word).
      const requiredSignals = Math.max(1, Math.ceil(mission.expectedSignals.length / 2));
      const pass = text.trim().length > 40 && signalsMatched.length >= requiredSignals;
      return {
        id: `killer-${mission.id}-${finished.getTime().toString(36)}`,
        missionId: mission.id,
        audience: mission.audience,
        status: pass ? 'pass' : 'fail',
        providerId: result.providerName || providerId,
        modelId: result.modelName || modelId,
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: finished.getTime() - started.getTime(),
        responsePreview: redactSensitive(text).slice(0, 400),
        signalsMatched,
        notes: pass ? `Executed live with ${providerId}; matched signals: ${signalsMatched.join(', ')}`
          : `Executed live but response missed expected signals (${mission.expectedSignals.join(', ')}).`,
        live: true,
      };
    } catch (error) {
      const finished = now();
      const message = error instanceof Error ? error.message : String(error);
      const blocked = /api key|credential|not configured|no provider|unavailable/i.test(message);
      return {
        id: `killer-${mission.id}-${finished.getTime().toString(36)}`,
        missionId: mission.id,
        audience: mission.audience,
        status: blocked ? 'blocked' : 'fail',
        providerId,
        modelId,
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: finished.getTime() - started.getTime(),
        responsePreview: '',
        signalsMatched: [],
        notes: redactSensitive(message).slice(0, 240),
        live: true,
      };
    }
  }

  private skippedReceipt(
    mission: KillerMission,
    when: Date,
    notes: string,
    status: 'skipped' | 'blocked' = 'skipped',
  ): KillerExecutionReceipt {
    const iso = when.toISOString();
    return {
      id: `killer-${mission.id}-skip`,
      missionId: mission.id,
      audience: mission.audience,
      status,
      providerId: null,
      modelId: null,
      startedAt: iso,
      finishedAt: iso,
      durationMs: 0,
      responsePreview: '',
      signalsMatched: [],
      notes,
      live: false,
    };
  }

  private report(when: Date, liveRequested: boolean, receipts: KillerExecutionReceipt[]): KillerExecuteReport {
    const failed = receipts.filter((entry) => entry.status === 'fail').length;
    const blocked = receipts.filter((entry) => entry.status === 'blocked').length;
    const skipped = receipts.filter((entry) => entry.status === 'skipped' || entry.status === 'blocked').length;
    const executed = receipts.filter((entry) => entry.status === 'pass').length;
    // Dry-run (no live): skipped catalog listing is honest success.
    // Live: every intended mission must pass — blocked/empty is not success.
    const ok = liveRequested
      ? receipts.length > 0 && failed === 0 && blocked === 0 && executed === receipts.length
      : failed === 0;
    return {
      generatedAt: when.toISOString(),
      version: 'killer-execute/v1',
      liveRequested,
      receipts,
      ok,
      executed,
      skipped,
      failed,
    };
  }

  private persistReceipts(root: string, receipts: KillerExecutionReceipt[]): void {
    const dir = path.join(root, 'data', 'product');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'killer-execution-receipts.json');
    let existing: KillerExecutionReceipt[] = [];
    try {
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { receipts?: KillerExecutionReceipt[] };
        existing = Array.isArray(parsed.receipts) ? parsed.receipts : [];
      }
    } catch {
      existing = [];
    }
    const next = [...existing, ...receipts.filter((entry) => entry.live)].slice(-100);
    fs.writeFileSync(file, `${JSON.stringify({ version: 1, receipts: next }, null, 2)}\n`, 'utf8');
  }
}

function redactSensitive(text: string): string {
  return String(text || '')
    .replace(/key=[^&\s"']+/gi, 'key=REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer REDACTED')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-REDACTED')
    .replace(/AIza[0-9A-Za-z_-]+/g, 'AIzaREDACTED')
    .replace(/x-api-key["\s:=]+[^\s"',}]+/gi, 'x-api-key=REDACTED');
}
