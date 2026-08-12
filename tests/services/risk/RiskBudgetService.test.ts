import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RISK_BUDGET_CONTRACT_VERSION,
  DEFAULT_OPERATOR_LIMITS,
  DEFAULT_AUTOPILOT_LIMITS,
} from '../../../src/contracts/risk/RiskBudgetContract.js';
import {
  RiskBudgetService,
  suggestModeFromAutonomyLevel,
} from '../../../src/services/risk/RiskBudgetService.js';
import {
  InMemoryProofLedgerAdapter,
  ProofLedgerService,
} from '../../../src/services/proof/ProofLedgerService.js';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-risk-budget-'));
}

function createService(opts: {
  stateFile?: string;
  now?: () => Date;
  proofLedger?: ProofLedgerService | null;
  trustedOperator?: { isEnabled(): boolean } | null;
  timezone?: string;
} = {}): RiskBudgetService {
  const dir = opts.stateFile ? path.dirname(opts.stateFile) : createTempDir();
  const stateFile = opts.stateFile || path.join(dir, 'risk-budget.json');
  return new RiskBudgetService({
    stateFile,
    now: opts.now || (() => new Date('2026-07-11T12:00:00.000Z')),
    timezone: opts.timezone || 'UTC',
    proofLedger: opts.proofLedger === undefined ? null : opts.proofLedger,
    trustedOperator: opts.trustedOperator ?? null,
  });
}

describe('RiskBudgetService', () => {
  test('default mode is operator with operator limits', () => {
    const service = createService();
    const state = service.getState();
    expect(state.contractVersion).toBe(RISK_BUDGET_CONTRACT_VERSION);
    expect(state.mode).toBe('operator');
    expect(state.frozen).toBe(false);
    expect(state.dayKey).toBe('2026-07-11');
    expect(state.counters.diskMutations).toBe(0);
    expect(state.limits.diskMutations).toBe(DEFAULT_OPERATOR_LIMITS.diskMutations);
    expect(state.limits.shellCommands).toBe(DEFAULT_OPERATOR_LIMITS.shellCommands);
  });

  test('day rollover resets counters and unfreezes', () => {
    let current = new Date('2026-07-11T12:00:00.000Z');
    const dir = createTempDir();
    const stateFile = path.join(dir, 'risk-budget.json');
    const service = createService({
      stateFile,
      now: () => current,
    });

    service.setMode('autopilot');
    const first = service.spend({ dimension: 'diskMutations', amount: 1, riskLevel: 'low' });
    expect(first.allowed).toBe(true);
    expect(service.getState().counters.diskMutations).toBe(1);

    // Force freeze then roll day
    service.freeze('test freeze');
    expect(service.getState().frozen).toBe(true);

    current = new Date('2026-07-12T01:00:00.000Z');
    const rolled = service.getState();
    expect(rolled.dayKey).toBe('2026-07-12');
    expect(rolled.counters.diskMutations).toBe(0);
    expect(rolled.frozen).toBe(false);
  });

  test('observer blocks disk spend', () => {
    const service = createService();
    service.setMode('observer');
    const decision = service.spend({
      dimension: 'diskMutations',
      amount: 1,
      riskLevel: 'low',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.state.counters.diskMutations).toBe(0);
    expect(decision.reason.toLowerCase()).toMatch(/observer/);
  });

  test('observer allows zero-amount spend as no-op', () => {
    const service = createService();
    service.setMode('observer');
    const decision = service.spend({ dimension: 'diskMutations', amount: 0 });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });

  test('autopilot allows low-risk until limit then freezes', () => {
    let seq = 0;
    const proof = new ProofLedgerService({
      adapter: new InMemoryProofLedgerAdapter(),
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-exh-${++seq}`,
    });
    const service = createService({ proofLedger: proof });
    service.setMode('autopilot');
    const limit = DEFAULT_AUTOPILOT_LIMITS.shellCommands;

    for (let i = 0; i < limit; i += 1) {
      const ok = service.spend({ dimension: 'shellCommands', amount: 1, riskLevel: 'low' });
      expect(ok.allowed).toBe(true);
    }

    const denied = service.spend({ dimension: 'shellCommands', amount: 1, riskLevel: 'low' });
    expect(denied.allowed).toBe(false);
    expect(denied.state.frozen).toBe(true);
    expect(denied.proofEventId).toBeTruthy();
    expect(denied.reason.toLowerCase()).toMatch(/freeze|exceed|ceiling|exhaust/);

    const events = proof.list({ query: 'Risk budget exhausted' });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].title).toBe('Risk budget exhausted');
    expect(events[0].kind).toBe('system');

    // Further spends stay blocked while frozen
    const stillBlocked = service.spend({ dimension: 'diskMutations', amount: 1, riskLevel: 'low' });
    expect(stillBlocked.allowed).toBe(false);
    expect(stillBlocked.reason.toLowerCase()).toMatch(/frozen/);
  });

  test('autopilot medium risk requires approval without spending', () => {
    const service = createService();
    service.setMode('autopilot');
    const decision = service.spend({
      dimension: 'networkSends',
      amount: 1,
      riskLevel: 'medium',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.state.counters.networkSends).toBe(0);
    expect(decision.state.frozen).toBe(false);
  });

  test('setMode emits proof system event', () => {
    let seq = 0;
    const proof = new ProofLedgerService({
      adapter: new InMemoryProofLedgerAdapter(),
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-mode-${++seq}`,
    });
    const service = createService({ proofLedger: proof });
    const state = service.setMode('observer');
    expect(state.mode).toBe('observer');
    const events = proof.list({ query: 'Risk budget mode changed' });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('system');
    expect(events[0].title).toBe('Risk budget mode changed');
    expect(events[0].metadata).toMatchObject({ previousMode: 'operator', mode: 'observer' });
  });

  test('spend denial when frozen', () => {
    const service = createService();
    service.freeze('manual');
    const decision = service.spend({ dimension: 'diskMutations', amount: 1, riskLevel: 'low' });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reason.toLowerCase()).toMatch(/frozen/);
  });

  test('operator allows until hard ceiling then requires approval', () => {
    const service = createService();
    // leave default operator
    const limit = DEFAULT_OPERATOR_LIMITS.diskMutations;
    const almost = service.spend({
      dimension: 'diskMutations',
      amount: limit,
      riskLevel: 'low',
    });
    expect(almost.allowed).toBe(true);
    expect(almost.state.counters.diskMutations).toBe(limit);

    const over = service.spend({ dimension: 'diskMutations', amount: 1, riskLevel: 'low' });
    expect(over.allowed).toBe(false);
    expect(over.requiresApproval).toBe(true);
    expect(over.state.frozen).toBe(false);
    expect(over.state.counters.diskMutations).toBe(limit);
  });

  test('JSON persistence round-trip (temp dir)', () => {
    const dir = createTempDir();
    const stateFile = path.join(dir, 'risk-budget.json');
    const a = createService({ stateFile });
    a.setMode('autopilot');
    a.spend({ dimension: 'networkSends', amount: 2, riskLevel: 'low' });

    expect(fs.existsSync(stateFile)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    expect(raw.mode).toBe('autopilot');
    expect(raw.counters.networkSends).toBe(2);

    const b = createService({ stateFile });
    const state = b.getState();
    expect(state.mode).toBe('autopilot');
    expect(state.counters.networkSends).toBe(2);
    expect(state.dayKey).toBe('2026-07-11');
  });

  test('resetDay clears counters and freeze', () => {
    const service = createService();
    service.setMode('operator');
    service.spend({ dimension: 'shellCommands', amount: 3, riskLevel: 'low' });
    service.freeze('x');
    const reset = service.resetDay();
    expect(reset.counters.shellCommands).toBe(0);
    expect(reset.frozen).toBe(false);
  });

  test('suggestModeFromAutonomyLevel mapping', () => {
    expect(suggestModeFromAutonomyLevel('conservative')).toBe('observer');
    expect(suggestModeFromAutonomyLevel('balanced')).toBe('operator');
    expect(suggestModeFromAutonomyLevel('business')).toBe('operator');
    expect(suggestModeFromAutonomyLevel('advanced')).toBe('autopilot');
  });

  test('toMarkdown / toJson include mode and counters', () => {
    const service = createService();
    const state = service.getState();
    const md = service.toMarkdown(state);
    expect(md).toMatch(/Risk Budget/i);
    expect(md).toMatch(/operator/i);
    const json = service.toJson(state);
    expect(JSON.parse(json).mode).toBe('operator');
  });

  test('trusted operator slightly raises operator limits', () => {
    const service = createService({
      trustedOperator: { isEnabled: () => true },
    });
    const state = service.getState();
    expect(state.mode).toBe('operator');
    expect(state.limits.diskMutations).toBeGreaterThan(DEFAULT_OPERATOR_LIMITS.diskMutations);
  });
  test('unfreeze clears freeze but keeps counters', () => {
    const service = createService();
    service.spend({ dimension: 'diskMutations', amount: 4, riskLevel: 'low' });
    service.freeze('manual');
    expect(service.getState().frozen).toBe(true);
    const state = service.unfreeze();
    expect(state.frozen).toBe(false);
    expect(state.counters.diskMutations).toBe(4);
  });

  test('unknown riskLevel normalizes to low (autopilot may allow)', () => {
    const service = createService();
    service.setMode('autopilot');
    const decision = service.spend({
      dimension: 'diskMutations',
      amount: 1,
      // intentionally invalid — documents current permissive normalize
      riskLevel: 'banana' as any,
    });
    expect(decision.allowed).toBe(true);
  });

  test('timezone dayKey uses IANA zone near UTC boundary', () => {
    const now = () => new Date('2026-07-11T23:30:00.000Z');
    const dir = createTempDir();
    const utc = createService({
      stateFile: path.join(dir, 'utc.json'),
      now,
      timezone: 'UTC',
    });
    const tokyo = createService({
      stateFile: path.join(dir, 'tokyo.json'),
      now,
      timezone: 'Asia/Tokyo',
    });
    expect(utc.getState().dayKey).toBe('2026-07-11');
    expect(tokyo.getState().dayKey).toBe('2026-07-12');
  });
});
