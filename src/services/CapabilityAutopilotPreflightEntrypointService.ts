import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
  CapabilityMemoryRecord,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import { CapabilityAutopilotMemoryReplayService } from './CapabilityAutopilotMemoryReplayService.js';
import type { CapabilityPreflightHintResult } from './CapabilityAutopilotPreflightHintService.js';
import { CapabilityAutopilotPreflightHintService } from './CapabilityAutopilotPreflightHintService.js';
import {
  CapabilityAutopilotPreflightSurfaceService,
  type CapabilityPreflightSurfacePayload,
} from './CapabilityAutopilotPreflightSurfaceService.js';
import { CapabilityAutopilotReceiptService } from './CapabilityAutopilotReceiptService.js';

export type CapabilityAutopilotPreflightCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  title: string;
  reason: string;
  evidence: string[];
};

export type CapabilityAutopilotPreflightSnapshot = {
  phase: '68';
  surface: 'capability-autopilot-preflight-entrypoint';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  hint: CapabilityPreflightHintResult;
  records: CapabilityMemoryRecord[];
  payloads: CapabilityPreflightSurfacePayload[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedPhase: {
    phase: '69';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightEntrypointInput = {
  capabilityId: string;
  surfaces?: CapabilityAutopilotSurface[];
  expectedSurfaces?: CapabilityAutopilotSurface[];
  audience?: CapabilityAutopilotAudience;
  rawIntentText?: string | null;
  workspace?: string | null;
  resumeIntent?: OriginalIntentEnvelope | null;
};

type ReceiptLike = Pick<CapabilityAutopilotReceiptService, 'buildCapabilityReceipt'>;
type MemoryReplayLike = Pick<CapabilityAutopilotMemoryReplayService, 'buildMemoryRecord'>;
type HintLike = Pick<CapabilityAutopilotPreflightHintService, 'buildPreflightHint'>;
type SurfaceLike = Pick<CapabilityAutopilotPreflightSurfaceService, 'buildPayloads'>;

export type CapabilityAutopilotPreflightEntrypointRuntime = {
  now?: () => Date;
  receiptService?: ReceiptLike;
  memoryReplayService?: MemoryReplayLike;
  hintService?: HintLike;
  surfaceService?: SurfaceLike;
};

const DEFAULT_SURFACES: CapabilityAutopilotSurface[] = ['cli', 'web', 'chat', 'telegram', 'api'];
const VALID_SURFACES = new Set<CapabilityAutopilotSurface>([
  'chat',
  'assistant',
  'builder',
  'operator',
  'cli',
  'web',
  'telegram',
  'mobile',
  'api',
  'system',
]);

export class CapabilityAutopilotPreflightEntrypointService {
  private readonly now: () => Date;
  private readonly receiptService: ReceiptLike;
  private readonly memoryReplayService: MemoryReplayLike;
  private readonly hintService: HintLike;
  private readonly surfaceService: SurfaceLike;

  constructor(runtime: CapabilityAutopilotPreflightEntrypointRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.receiptService = runtime.receiptService || new CapabilityAutopilotReceiptService({
      now: this.now,
    });
    this.memoryReplayService = runtime.memoryReplayService || new CapabilityAutopilotMemoryReplayService({
      now: this.now,
    });
    this.hintService = runtime.hintService || new CapabilityAutopilotPreflightHintService({
      now: this.now,
    });
    this.surfaceService = runtime.surfaceService || new CapabilityAutopilotPreflightSurfaceService({
      now: this.now,
    });
  }

  public async buildSnapshot(
    input: CapabilityAutopilotPreflightEntrypointInput,
  ): Promise<CapabilityAutopilotPreflightSnapshot> {
    const generatedAt = this.now().toISOString();
    const capabilityId = this.normalizeCapabilityId(input.capabilityId);
    const audience = input.audience || 'everyday_user';
    const surfaces = this.normalizeSurfaces(input.surfaces);
    const expectedSurfaces = this.normalizeSurfaces(input.expectedSurfaces || surfaces);
    const rawIntentText = input.rawIntentText || input.resumeIntent?.rawText || input.resumeIntent?.normalizedText || null;
    const workspace = input.workspace || input.resumeIntent?.workspace || input.resumeIntent?.executionRequest?.workspace || null;
    const resumeIntent = input.resumeIntent || this.buildDefaultResumeIntent({
      capabilityId,
      audience,
      surface: this.resolveReceiptSurface(surfaces),
      rawIntentText,
      workspace,
      generatedAt,
    });

    const receipt = await this.receiptService.buildCapabilityReceipt(capabilityId, {
      surface: this.resolveReceiptSurface(surfaces),
      audience,
      resumeIntent,
    });
    const memory = this.memoryReplayService.buildMemoryRecord({
      receipt,
      rawIntentText,
      workspace,
    });
    const hint = await this.hintService.buildPreflightHint({
      capabilityId,
      records: [memory],
      receipt,
      rawIntentText,
      workspace,
    });
    const payloads = this.surfaceService.buildPayloads(hint, surfaces, audience);
    const checks = this.buildChecks({
      hint,
      records: [memory],
      payloads,
      expectedSurfaces,
      rawIntentText,
      workspace,
    });

    return this.buildSnapshotFromParts({
      capabilityId,
      generatedAt,
      hint,
      records: [memory],
      payloads,
      checks,
      surfaces,
      expectedSurfaces,
      audience,
    });
  }

  public renderReport(snapshot: CapabilityAutopilotPreflightSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight] Fase 68 - Canonical Preflight Entrypoint');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`hint: ${snapshot.hint.status}/${snapshot.hint.hintKind}`);
    lines.push(`recommended: ${snapshot.hint.recommendedNextAction || '<none>'}`);
    lines.push(`surfaces: ${snapshot.payloads.map((payload) => payload.surface).join(', ')}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proxima fase recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private buildSnapshotFromParts(input: {
    capabilityId: string;
    generatedAt: string;
    hint: CapabilityPreflightHintResult;
    records: CapabilityMemoryRecord[];
    payloads: CapabilityPreflightSurfacePayload[];
    checks: CapabilityAutopilotPreflightCheck[];
    surfaces: CapabilityAutopilotSurface[];
    expectedSurfaces: CapabilityAutopilotSurface[];
    audience: CapabilityAutopilotAudience;
  }): CapabilityAutopilotPreflightSnapshot {
    const failed = input.checks.filter((check) => check.status === 'fail').length;
    const warnings = input.checks.filter((check) => check.status === 'warn').length;
    const passed = input.checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '68',
      surface: 'capability-autopilot-preflight-entrypoint',
      generatedAt: input.generatedAt,
      capabilityId: input.capabilityId,
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      hint: input.hint,
      records: input.records,
      payloads: input.payloads,
      checks: input.checks,
      nextRecommendedPhase: {
        phase: '69',
        title: 'Preflight Action Handler Wiring',
        reason:
          'Depois do entrypoint canonico, o proximo passo e ligar actions explicitas a handlers/API/surfaces sem executar repair ou fallback automaticamente.',
      },
      metadata: {
        phase: 'capability-autopilot-phase-17',
        audience: input.audience,
        surfaces: input.surfaces,
        expectedSurfaces: input.expectedSurfaces,
        autoExecute: false,
      },
    };
  }

  private buildChecks(input: {
    hint: CapabilityPreflightHintResult;
    records: CapabilityMemoryRecord[];
    payloads: CapabilityPreflightSurfacePayload[];
    expectedSurfaces: CapabilityAutopilotSurface[];
    rawIntentText: string | null;
    workspace: string | null;
  }): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({
      hint: input.hint,
      records: input.records,
      payloads: input.payloads,
    });
    const surfaces = new Set(input.payloads.map((payload) => payload.surface));
    const missingSurfaces = input.expectedSurfaces.filter((surface) => !surfaces.has(surface));
    const compactPayloads = input.payloads.filter((payload) => payload.surface === 'telegram' || payload.surface === 'mobile');

    return [
      this.check(
        'capability-autopilot-preflight:coverage',
        'payloads por surface',
        missingSurfaces.length === 0 ? 'pass' : 'fail',
        'O entrypoint precisa gerar preflight payload para todas as surfaces esperadas por quem chamou.',
        [
          `surfaces=${Array.from(surfaces).join(',') || '<none>'}`,
          `expected=${input.expectedSurfaces.join(',') || '<none>'}`,
          ...missingSurfaces.map((surface) => `missing=${surface}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight:no-auto-run',
        'sem execucao automatica',
        input.hint.shouldRunAutomatically === false &&
          input.payloads.every((payload) => payload.shouldRunAutomatically === false) &&
          input.payloads.every((payload) => payload.metadata.autoExecute === false)
          ? 'pass'
          : 'fail',
        'Preflight hint e payloads so podem sugerir, nunca executar.',
        [
          `hintShouldRunAutomatically=${String(input.hint.shouldRunAutomatically)}`,
          ...input.payloads.map((payload) => `${payload.surface}:auto=${String(payload.metadata.autoExecute)}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight:explicit-actions',
        'acoes explicitas',
        input.payloads.every((payload) => payload.actions.every((action) => action.requiresExplicitUserAction))
          ? 'pass'
          : 'fail',
        'Toda action de preflight precisa de acao explicita do usuario.',
        input.payloads.map((payload) => `${payload.surface}:actions=${payload.actions.length}`),
      ),
      this.check(
        'capability-autopilot-preflight:no-raw-payload',
        'sem payload cru serializado',
        !this.containsProbe(serialized, input.rawIntentText) &&
          !this.containsProbe(serialized, input.workspace) &&
          !serialized.includes('rawText') &&
          !serialized.includes('normalizedText')
          ? 'pass'
          : 'fail',
        'Snapshot publico do preflight nao pode vazar intent/workspace crus.',
        [
          `containsIntentProbe=${String(this.containsProbe(serialized, input.rawIntentText))}`,
          `containsWorkspaceProbe=${String(this.containsProbe(serialized, input.workspace))}`,
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
      this.check(
        'capability-autopilot-preflight:memory-privacy',
        'memoria redigida',
        input.records.every((record) =>
          record.privacy.redacted &&
          !record.privacy.rawIntentStored &&
          !record.privacy.rawWorkspaceStored
        )
          ? 'pass'
          : 'fail',
        'Records usados no preflight precisam permanecer redigidos.',
        input.records.map((record) =>
          `${record.memoryId}:redacted=${record.privacy.redacted}:rawIntent=${record.privacy.rawIntentStored}:rawWorkspace=${record.privacy.rawWorkspaceStored}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight:compact-surfaces',
        'copy compacto',
        compactPayloads.every((payload) => payload.body.length <= 420) ? 'pass' : 'fail',
        'Telegram/mobile precisam receber corpo curto.',
        compactPayloads.length > 0
          ? compactPayloads.map((payload) => `${payload.surface}:body=${payload.body.length}`)
          : ['compactSurfaces=<none>'],
      ),
    ];
  }

  private buildDefaultResumeIntent(input: {
    capabilityId: string;
    audience: CapabilityAutopilotAudience;
    surface: CapabilityAutopilotSurface;
    rawIntentText: string | null;
    workspace: string | null;
    generatedAt: string;
  }): OriginalIntentEnvelope {
    const rawText = input.rawIntentText || `Prepare ${input.capabilityId} before continuing the original request.`;

    return {
      intentId: `${input.capabilityId}-preflight-intent`,
      createdAt: input.generatedAt,
      surface: input.surface,
      audience: input.audience,
      userId: 'capability-autopilot-preflight',
      sessionId: 'capability-autopilot-preflight-session',
      taskId: 'capability-autopilot-preflight-task',
      rawText,
      normalizedText: rawText.trim().toLowerCase().replace(/\s+/g, ' '),
      requestedCapabilityId: input.capabilityId,
      requestedExecutorName: input.capabilityId.replace(/^executor-/, ''),
      workspace: input.workspace,
      metadata: {
        generatedBy: 'CapabilityAutopilotPreflightEntrypointService',
        phase: 'capability-autopilot-phase-17',
      },
    };
  }

  private check(
    id: string,
    title: string,
    status: CapabilityAutopilotPreflightCheck['status'],
    reason: string,
    evidence: string[] = [],
  ): CapabilityAutopilotPreflightCheck {
    return {
      id,
      title,
      status,
      reason,
      evidence,
    };
  }

  private normalizeCapabilityId(value: string): string {
    return String(value || '').trim() || 'unknown-capability';
  }

  private normalizeSurfaces(
    surfaces: CapabilityAutopilotSurface[] | undefined,
  ): CapabilityAutopilotSurface[] {
    const selected = (surfaces && surfaces.length > 0 ? surfaces : DEFAULT_SURFACES)
      .filter((surface): surface is CapabilityAutopilotSurface => VALID_SURFACES.has(surface));
    return Array.from(new Set(selected.length > 0 ? selected : DEFAULT_SURFACES));
  }

  private resolveReceiptSurface(surfaces: CapabilityAutopilotSurface[]): CapabilityAutopilotSurface {
    return surfaces.includes('cli') ? 'cli' : surfaces[0] || 'cli';
  }

  private containsProbe(serialized: string, value: string | null): boolean {
    return Boolean(value && serialized.includes(value));
  }
}
