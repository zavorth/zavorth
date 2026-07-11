/**
 * Risk Budget OS CLI.
 *
 *   zavorth risk-budget
 *   zavorth risk-budget status [--json]
 *   zavorth risk-budget mode <observer|operator|autopilot>
 *   zavorth risk-budget spend --dimension diskMutations [--amount 1] [--risk low] [--json]
 *   zavorth risk-budget freeze|unfreeze
 *   zavorth risk-budget reset-day
 *   zavorth risk-budget --help
 *
 * Aliases: `zavorth budget …`, `zavorth trust budget …`
 */

import path from 'node:path';
import {
  RISK_BUDGET_DIMENSIONS,
  RISK_BUDGET_MODE_LABELS,
  RISK_BUDGET_MODES,
  type RiskBudgetDimension,
  type RiskBudgetMode,
  type RiskBudgetRiskLevel,
} from '../contracts/risk/RiskBudgetContract.js';
import {
  RiskBudgetService,
  defaultRiskBudgetStatePath,
  suggestModeFromAutonomyLevel,
} from '../services/risk/RiskBudgetService.js';
import {
  ProofLedgerService,
  defaultProofLedgerJsonlPath,
} from '../services/proof/ProofLedgerService.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readOption(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  const pref = `${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function printHelp(): void {
  console.log([
    '=== Zavorth Risk Budget OS ===',
    '',
    'Daily risk ceilings for disk / shell / network / model cost units.',
    'Composes with autonomy slider and trusted operator; does not replace them.',
    '',
    'Usage:',
    '  zavorth risk-budget',
    '  zavorth risk-budget status [--json]',
    '  zavorth risk-budget mode <observer|operator|autopilot>',
    '  zavorth risk-budget spend --dimension <dim> [--amount N] [--risk low|medium|high] [--json]',
    '  zavorth risk-budget freeze [reason...]',
    '  zavorth risk-budget unfreeze',
    '  zavorth risk-budget reset-day',
    '  zavorth risk-budget suggest-mode <conservative|balanced|business|advanced>',
    '  zavorth risk-budget --help',
    '',
    'Aliases:',
    '  zavorth budget …',
    '  zavorth trust budget …',
    '',
    'Modes:',
    '  observer   — no mutation spends without explicit approval',
    '  operator   — default governed path; track until hard ceilings',
    '  autopilot  — low-risk auto-spend up to daily ceilings; then freeze',
    '',
    'Dimensions:',
    `  ${RISK_BUDGET_DIMENSIONS.join(' | ')}`,
    '',
    'Storage:',
    `  Default state: ${defaultRiskBudgetStatePath()}`,
    '  Override with env ZAVORTH_RISK_BUDGET_PATH',
    '',
    'Examples:',
    '  zavorth risk-budget status',
    '  zavorth risk-budget mode operator',
    '  zavorth risk-budget spend --dimension diskMutations --amount 1 --risk low',
    '  zavorth budget status --json',
  ].join('\n'));
}

function resolveStatePath(): string {
  const fromEnv = String(process.env.ZAVORTH_RISK_BUDGET_PATH || '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  return defaultRiskBudgetStatePath(process.cwd());
}

function resolveProofPath(): string {
  const fromEnv = String(process.env.ZAVORTH_PROOF_LEDGER_PATH || '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  return defaultProofLedgerJsonlPath(process.cwd());
}

function createService(): RiskBudgetService {
  let proofLedger: ProofLedgerService | null = null;
  try {
    proofLedger = new ProofLedgerService({ jsonlPath: resolveProofPath() });
  } catch {
    proofLedger = null;
  }
  return new RiskBudgetService({
    stateFile: resolveStatePath(),
    proofLedger,
  });
}

export async function runRiskBudgetCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return 0;
  }

  const first = String(rawArgs[0] || '').trim().toLowerCase();
  const json = hasFlag(rawArgs, '--json');

  if (!first || first.startsWith('--') || first === 'status' || first === 'show') {
    return runStatus(rawArgs.filter((a) => {
      const t = a.toLowerCase();
      return t !== 'status' && t !== 'show';
    }), json || hasFlag(rawArgs, '--json'));
  }

  const rest = rawArgs.slice(1);

  if (first === 'mode' || first === 'set-mode') {
    return runMode(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'spend') {
    return runSpend(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'freeze') {
    return runFreeze(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'unfreeze') {
    return runUnfreeze(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'reset-day' || first === 'reset' || first === 'rollover') {
    return runResetDay(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'suggest-mode' || first === 'from-autonomy') {
    return runSuggestMode(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'help') {
    printHelp();
    return 0;
  }

  console.log(`Unknown risk-budget subcommand: ${first}`);
  console.log('');
  printHelp();
  return 1;
}

function runStatus(args: string[], json: boolean): number {
  const service = createService();
  const state = service.getState();

  if (json) {
    console.log(service.toJson(state));
    return 0;
  }

  const label = RISK_BUDGET_MODE_LABELS[state.mode] || state.mode;
  console.log('Risk budget status');
  console.log(`  contract: ${state.contractVersion}`);
  console.log(`  mode: ${label} (${state.mode})`);
  console.log(`  day: ${state.dayKey}`);
  console.log(`  frozen: ${state.frozen ? 'yes' : 'no'}`);
  console.log(`  path: ${resolveStatePath()}`);
  console.log('  counters:');
  for (const dim of RISK_BUDGET_DIMENSIONS) {
    console.log(`    ${dim}: ${state.counters[dim]} / ${state.limits[dim]}`);
  }
  if (state.notes) {
    console.log(`  notes: ${state.notes}`);
  }
  console.log(`  updatedAt: ${state.updatedAt}`);
  return 0;
}

function runMode(args: string[], json: boolean): number {
  const positional = args.filter((a) => !a.startsWith('--'));
  const raw = String(positional[0] || '').trim().toLowerCase();
  if (!raw || !(RISK_BUDGET_MODES as readonly string[]).includes(raw)) {
    console.log('Usage: zavorth risk-budget mode <observer|operator|autopilot>');
    return 1;
  }
  const service = createService();
  const state = service.setMode(raw as RiskBudgetMode);
  if (json) {
    console.log(service.toJson(state));
    return 0;
  }
  console.log(`Risk budget mode set to ${RISK_BUDGET_MODE_LABELS[state.mode]} (${state.mode}).`);
  console.log(`Day ${state.dayKey} · frozen=${state.frozen ? 'yes' : 'no'}`);
  return 0;
}

function runSpend(args: string[], json: boolean): number {
  const dimRaw = readOption(args, '--dimension')
    || readOption(args, '--dim')
    || args.filter((a) => !a.startsWith('--'))[0]
    || '';
  if (!dimRaw) {
    console.log('Usage: zavorth risk-budget spend --dimension <diskMutations|shellCommands|networkSends|modelCostUnits> [--amount 1] [--risk low]');
    return 1;
  }

  const amountRaw = readOption(args, '--amount');
  const amount = amountRaw == null ? 1 : Number(amountRaw);
  const riskRaw = (readOption(args, '--risk') || readOption(args, '--risk-level') || 'low') as RiskBudgetRiskLevel;
  const toolName = readOption(args, '--tool') || readOption(args, '--tool-name');
  const summary = readOption(args, '--summary') || readOption(args, '--note');

  const service = createService();
  const decision = service.spend({
    dimension: dimRaw as RiskBudgetDimension,
    amount: Number.isFinite(amount) ? amount : 1,
    riskLevel: riskRaw,
    toolName,
    summary,
  });

  if (json) {
    console.log(JSON.stringify(decision, null, 2));
    return decision.allowed ? 0 : 2;
  }

  console.log(decision.allowed ? 'Spend allowed' : 'Spend denied');
  console.log(`  reason: ${decision.reason}`);
  console.log(`  requiresApproval: ${decision.requiresApproval ? 'yes' : 'no'}`);
  console.log(`  remaining: ${decision.remaining}`);
  console.log(`  mode: ${decision.state.mode}`);
  console.log(`  frozen: ${decision.state.frozen ? 'yes' : 'no'}`);
  if (decision.proofEventId) {
    console.log(`  proofEventId: ${decision.proofEventId}`);
  }
  return decision.allowed ? 0 : 2;
}

function runFreeze(args: string[], json: boolean): number {
  const reasonParts = args.filter((a) => !a.startsWith('--'));
  const reason = reasonParts.length ? reasonParts.join(' ') : null;
  const service = createService();
  const state = service.freeze(reason);
  if (json) {
    console.log(service.toJson(state));
    return 0;
  }
  console.log('Risk budget frozen.');
  if (state.notes) console.log(`  notes: ${state.notes}`);
  return 0;
}

function runUnfreeze(_args: string[], json: boolean): number {
  const service = createService();
  const state = service.unfreeze();
  if (json) {
    console.log(service.toJson(state));
    return 0;
  }
  console.log('Risk budget unfrozen.');
  return 0;
}

function runResetDay(_args: string[], json: boolean): number {
  const service = createService();
  const state = service.resetDay();
  if (json) {
    console.log(service.toJson(state));
    return 0;
  }
  console.log(`Risk budget day reset to ${state.dayKey}.`);
  console.log('Counters cleared; freeze cleared.');
  return 0;
}

function runSuggestMode(args: string[], json: boolean): number {
  const level = String(args.filter((a) => !a.startsWith('--'))[0] || '').trim();
  if (!level) {
    console.log('Usage: zavorth risk-budget suggest-mode <conservative|balanced|business|advanced>');
    return 1;
  }
  const mode = suggestModeFromAutonomyLevel(level);
  if (json) {
    console.log(JSON.stringify({ autonomyLevel: level, suggestedMode: mode }, null, 2));
    return 0;
  }
  console.log(`Autonomy level "${level}" → risk budget mode ${RISK_BUDGET_MODE_LABELS[mode]} (${mode}).`);
  return 0;
}
