/**
 * Hermetic golden-path service smoke for Trust Loop.
 * No external network. Uses temp dirs for file-backed adapters.
 *
 * Run via: npx tsx scripts/zavorth-golden-path-smoke.ts
 * Or as a module: import { runGoldenPathSmoke } from './zavorth-golden-path-smoke.ts'
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ApprovalPresentationService,
} from '../src/services/approval/ApprovalPresentationService.js';
import { AbsorbRiskReportService } from '../src/services/capability/AbsorbRiskReportService.js';
import { classifyHonestReadiness } from '../src/services/honesty/ReadinessHonesty.js';
import { MemoryPrivacyService } from '../src/services/memory/MemoryPrivacyService.js';
import { WorkspaceMigrationProfileService } from '../src/services/migration/WorkspaceMigrationProfileService.js';
import {
  ChangePreviewPresenter,
  createChangePreviewDemoPlanSteps,
} from '../src/services/preview/ChangePreviewPresenter.js';
import {
  InMemoryProofLedgerAdapter,
  ProofLedgerService,
} from '../src/services/proof/ProofLedgerService.js';
import { RiskBudgetService } from '../src/services/risk/RiskBudgetService.js';

export type SmokeCheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

export type GoldenPathSmokeReport = {
  ok: boolean;
  generatedAt: string;
  checks: SmokeCheckResult[];
  durationMs: number;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Jest-safe (no import.meta). Prefer cwd package root when present. */
function resolveRepoRoot(): string {
  const scriptDir = typeof __dirname === 'string' ? __dirname : process.cwd();
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(scriptDir, '..'),
  ];
  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'package.json'))
      && fs.existsSync(path.join(candidate, 'src', 'services'))
    ) {
      return candidate;
    }
  }
  return process.cwd();
}

export function smokeProofLedger(): SmokeCheckResult {
  const name = 'ProofLedgerService';
  try {
    let counter = 0;
    const service = new ProofLedgerService({
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-gp-${++counter}`,
      ledgerId: 'golden-path-ledger',
      adapter: new InMemoryProofLedgerAdapter(),
    });

    const created = service.append({
      runId: 'gp-run-1',
      kind: 'runtime',
      surface: 'cli',
      title: 'Golden path demo event',
      summary: 'Hermetic proof append for golden path.',
      status: 'ok',
      riskLevel: 'none',
      approvalId: null,
      artifacts: [],
      source: 'golden-path-smoke',
    });

    assert(created.id, 'append must return event id');
    const listed = service.list();
    assert(listed.length >= 1, `list length expected >= 1, got ${listed.length}`);

    const snapshot = service.buildSnapshot();
    const markdown = service.toMarkdown(snapshot);
    assert(
      markdown.includes('Zavorth Proof Ledger') || markdown.includes('Golden path demo event'),
      'export markdown must contain ledger title or event title',
    );
    assert(markdown.includes('Golden path demo event'), 'export markdown must include event title');

    return { name, ok: true, detail: `events=${listed.length}` };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function smokeApprovalPresentation(): SmokeCheckResult {
  const name = 'ApprovalPresentationService';
  try {
    let counter = 0;
    const ledger = new ProofLedgerService({
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-appr-${++counter}`,
      ledgerId: 'golden-path-approval',
      adapter: new InMemoryProofLedgerAdapter(),
    });
    const service = new ApprovalPresentationService({
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-card-${++counter}`,
      proofLedger: ledger,
      emitProofByDefault: true,
    });

    const card = service.fromLooseRequest({
      id: 'gp-appr-1',
      title: 'Write demo config',
      summary: 'Golden path approval seed',
      risk: 'medium',
      toolName: 'fs.write',
      workspaceId: 'ws-gp',
      allowedOperations: ['write'],
      surface: 'cli',
    });
    assert(card.id === 'gp-appr-1', 'fromLooseRequest id mismatch');

    const decided = service.recordDecision(
      card,
      { action: 'approve', decidedBy: 'golden-path', reason: 'smoke approve' },
      { proofLedger: ledger, emitProof: true },
    );
    assert(decided.decision.action === 'approve', 'decision must be approve');
    assert(decided.proofEventId, 'recordDecision must emit proofEventId');
    const events = ledger.list({ kind: 'approval' });
    assert(events.length >= 1, 'approval proof events expected');

    return { name, ok: true, detail: `proofEventId=${decided.proofEventId}` };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function smokeRiskBudget(): SmokeCheckResult {
  const name = 'RiskBudgetService';
  try {
    const dir = createTempDir('zavorth-gp-risk-');
    const stateFile = path.join(dir, 'risk-budget.json');
    const service = new RiskBudgetService({
      stateFile,
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      timezone: 'UTC',
      proofLedger: null,
      trustedOperator: null,
    });

    service.setMode('observer');
    const decision = service.spend({
      dimension: 'diskMutations',
      amount: 1,
      riskLevel: 'low',
    });
    assert(decision.allowed === false, 'observer must block disk spend');
    assert(decision.requiresApproval === true, 'observer block should require approval');
    assert(decision.state.counters.diskMutations === 0, 'blocked spend must not count');

    return { name, ok: true, detail: `mode=observer blocked=${!decision.allowed}` };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function smokeChangePreview(): SmokeCheckResult {
  const name = 'ChangePreviewPresenter';
  try {
    let counter = 0;
    const presenter = new ChangePreviewPresenter({
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-pv-${++counter}`,
    });
    const card = presenter.fromPlanSteps(createChangePreviewDemoPlanSteps());
    assert(Array.isArray(card.bullets), 'bullets must be an array');
    assert(card.bullets.length > 0, 'fromPlanSteps must produce non-empty bullets');
    assert(card.confidence !== 'full', 'plan-only preview must not claim full confidence');

    return { name, ok: true, detail: `bullets=${card.bullets.length} confidence=${card.confidence}` };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function smokeMemoryPrivacy(): SmokeCheckResult {
  const name = 'MemoryPrivacyService';
  try {
    const dir = createTempDir('zavorth-gp-memory-');
    const demoStorePath = path.join(dir, 'memory-privacy-demo.json');
    const service = new MemoryPrivacyService({
      demoStorePath,
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-mem-1`,
    });

    const seeded = service.seedDemo();
    assert(seeded.items.length >= 1, 'seedDemo must create items');
    assert(fs.existsSync(demoStorePath), 'demo store file must exist after seed');

    const targetId = 'mem-demo-pref-tabs';
    const explained = service.explainFromDemo(targetId);
    assert(explained, `expected demo item ${targetId}`);
    assert(explained!.canForget === true, `${targetId} should be forgettable`);

    const forgotten = service.forgetInDemo(targetId, 'golden-path');
    assert(forgotten, 'forgetInDemo must succeed for forgettable item');
    assert(forgotten!.proof.title === 'Memory forgotten', 'forget proof title mismatch');
    assert(service.explainFromDemo(targetId) === null, 'forgotten item must be gone');

    return {
      name,
      ok: true,
      detail: `seeded=${seeded.items.length} forgot=${targetId}`,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function smokeHonestyReadiness(): SmokeCheckResult {
  const name = 'classifyHonestReadiness';
  try {
    const catalog = classifyHonestReadiness({
      configured: true,
      liveReady: false,
      status: 'configured',
    });
    assert(catalog.state !== 'live', 'catalog-only must not be live');
    assert(
      catalog.state === 'available' || catalog.state === 'needs_setup',
      `unexpected catalog state: ${catalog.state}`,
    );

    const live = classifyHonestReadiness({ liveReady: true });
    assert(live.state === 'live', 'explicit liveReady must be live');

    return { name, ok: true, detail: `catalog=${catalog.state} live=${live.state}` };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function smokeAbsorbRiskReport(): SmokeCheckResult {
  const name = 'AbsorbRiskReportService';
  try {
    let counter = 0;
    const service = new AbsorbRiskReportService({
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-abs-${++counter}`,
    });

    const report = service.fromFabricSnapshot({
      generatedAt: '2026-07-11T12:00:00.000Z',
      status: 'preview-only',
      apply: false,
      source: {
        raw: './packs/golden-path-demo',
        kind: 'path',
        label: 'golden-path-demo',
        remoteUrl: null,
        resolvedLocalPath: './packs/golden-path-demo',
      },
      candidates: [
        {
          id: 'c-skill-1',
          kind: 'skill',
          name: 'demo-skill',
          title: 'Demo Skill',
          description: 'Instruction-only skill',
          relativeEntry: 'SKILL.md',
          trustState: 'quarantined',
          risk: 'low',
          reasons: ['markdown instructions'],
          tags: ['skill'],
          executableCodeDetected: false,
          instructionOnly: true,
          targetDirHint: 'skills/demo-skill',
        },
      ],
      issues: [],
      receipts: [],
      summary: {
        candidates: 1,
        skills: 1,
        plugins: 0,
        mcp: 0,
        highRisk: 0,
        executableCode: 0,
        denied: 0,
        heldForApproval: 0,
      },
      quarantineRoot: path.join(os.tmpdir(), 'zavorth-gp-quarantine'),
      narrative: {
        headline: 'Absorb preview',
        operatorSummary: 'Golden path fixture',
        nextSafeAction: 'Review then decide',
      },
    });

    assert(report, 'fromFabricSnapshot must return report');
    assert(report.candidateCount === 1, `expected 1 candidate, got ${report.candidateCount}`);
    assert(typeof report.overallRisk === 'string', 'overallRisk required');
    assert(Array.isArray(report.findings), 'findings must be array');

    return {
      name,
      ok: true,
      detail: `candidates=${report.candidateCount} risk=${report.overallRisk}`,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function smokeWorkspaceMigration(): SmokeCheckResult {
  const name = 'WorkspaceMigrationProfileService';
  try {
    const repoRoot = resolveRepoRoot();
    const fixturePath = path.join(
      repoRoot,
      'tests',
      'fixtures',
      'migration-homes',
      'generic',
    );
    assert(fs.existsSync(fixturePath), `fixture missing: ${fixturePath}`);

    const service = new WorkspaceMigrationProfileService({
      projectRoot: repoRoot,
      now: () => new Date('2026-07-11T12:00:00.000Z'),
    });
    const detected = service.detectProfile(fixturePath);
    assert(
      detected.profileId === 'generic-agent-home',
      `expected generic-agent-home, got ${detected.profileId}`,
    );
    assert(detected.confidence > 0, 'confidence must be > 0');

    return {
      name,
      ok: true,
      detail: `profile=${detected.profileId} confidence=${detected.confidence.toFixed(2)}`,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function runGoldenPathSmoke(): GoldenPathSmokeReport {
  const started = Date.now();
  const checks: SmokeCheckResult[] = [
    smokeProofLedger(),
    smokeApprovalPresentation(),
    smokeRiskBudget(),
    smokeChangePreview(),
    smokeMemoryPrivacy(),
    smokeHonestyReadiness(),
    smokeAbsorbRiskReport(),
    smokeWorkspaceMigration(),
  ];
  const ok = checks.every((c) => c.ok);
  return {
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    durationMs: Date.now() - started,
  };
}

/** Jest-safe main detection (no import.meta). */
function isMainModule(): boolean {
  const entry = process.argv[1] ? path.resolve(process.argv[1]).replace(/\\/g, '/') : '';
  if (!entry) return false;
  return (
    entry.endsWith('/scripts/zavorth-golden-path-smoke.ts')
    || entry.endsWith('/scripts/zavorth-golden-path-smoke.js')
    || entry.endsWith('zavorth-golden-path-smoke.ts')
    || entry.endsWith('zavorth-golden-path-smoke.js')
  );
}

// Only auto-run when executed as a CLI entry (tsx/node), not when imported by Jest.
if (isMainModule()) {
  const report = runGoldenPathSmoke();
  for (const check of report.checks) {
    const tag = check.ok ? '[pass]' : '[fail]';
    console.log(`${tag} smoke:${check.name} — ${check.detail}`);
  }
  console.log(
    report.ok
      ? `[pass] golden-path smoke complete (${report.durationMs}ms)`
      : `[fail] golden-path smoke failed (${report.durationMs}ms)`,
  );
  process.exit(report.ok ? 0 : 1);
}
