#!/usr/bin/env node
import { ZavorthTransactionPlanePolicyService } from '../src/services/ZavorthTransactionPlanePolicyService.js';
import type {
  ZavorthTransactionActionKind,
  ZavorthTransactionActor,
  ZavorthTransactionApprovalStatus,
  ZavorthTransactionExecutionMode,
  ZavorthTransactionPlaneSafetyInput,
} from '../src/contracts/ZavorthTransactionPlaneContract.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const evaluate = argv.includes('--evaluate');
const service = new ZavorthTransactionPlanePolicyService();

if (evaluate) {
  const input: ZavorthTransactionPlaneSafetyInput = {
    actor: readFlag('actor', 'llm') as ZavorthTransactionActor,
    actionKind: readFlag('action', 'purchase-submit') as ZavorthTransactionActionKind,
    executionMode: readFlag('mode', 'live') as ZavorthTransactionExecutionMode,
    approvalStatus: readFlag('approval', 'none') as ZavorthTransactionApprovalStatus,
    typedConnector: readBoolFlag('typed-connector'),
    connectorTrusted: readBoolFlag('trusted-connector'),
    previewGenerated: readBoolFlag('preview'),
    ledgerEnabled: readBoolFlag('ledger'),
    usesRealMoney: readOptionalBoolFlag('real-money'),
    movesExternalValue: readOptionalBoolFlag('external-value'),
    touchesRawSecret: readOptionalBoolFlag('touches-secret'),
    persistsRawSecret: readOptionalBoolFlag('persists-secret'),
    sourceSurface: readFlag('surface', 'cli'),
  };
  const decision = service.evaluate(input);
  if (asJson) {
    process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  } else {
    console.log('[transaction-plane] decision');
    console.log(`[transaction-plane] action: ${decision.actionKind} | mode=${decision.executionMode} | actor=${decision.actor}`);
    console.log(`[transaction-plane] status: ${decision.status} | allowed=${decision.allowed ? 'yes' : 'no'} | risk=${decision.riskLevel}`);
    if (decision.blockers.length > 0) {
      console.log(`[transaction-plane] blockers: ${decision.blockers.join(', ')}`);
    }
    if (decision.requiredControls.length > 0) {
      console.log(`[transaction-plane] required controls: ${decision.requiredControls.join(', ')}`);
    }
    for (const reason of decision.reasons) {
      console.log(`- ${reason}`);
    }
  }
  process.exitCode = decision.allowed ? 0 : 1;
} else {
  const snapshot = service.buildSnapshot();
  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log(service.renderReport(snapshot));
  }
}

function readFlag(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const inline = argv.find((entry) => entry.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim() || fallback;
  }
  const index = argv.findIndex((entry) => entry === `--${name}`);
  if (index >= 0) {
    return String(argv[index + 1] || '').trim() || fallback;
  }
  return fallback;
}

function readBoolFlag(name: string): boolean {
  return argv.includes(`--${name}`) || readFlag(name, 'false').toLowerCase() === 'true';
}

function readOptionalBoolFlag(name: string): boolean | null {
  const flag = `--${name}`;
  if (argv.includes(flag)) {
    return true;
  }
  const inline = argv.find((entry) => entry.startsWith(`${flag}=`));
  if (!inline) {
    return null;
  }
  const value = inline.slice(flag.length + 1).trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}
