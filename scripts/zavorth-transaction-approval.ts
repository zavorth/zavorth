import { ZavorthTransactionApprovalLedgerService } from '../src/services/ZavorthTransactionApprovalLedgerService.js';

type CliOptions = {
  json: boolean;
  summary: boolean;
  text?: string;
  kind?: import('../src/contracts/ZavorthTransactionIntentContract.js').ZavorthTransactionIntentKind;
  actionKind?: import('../src/contracts/ZavorthTransactionPlaneContract.js').ZavorthTransactionActionKind;
  targetKind?: import('../src/contracts/ZavorthTransactionIntentContract.js').ZavorthTransactionIntentTargetKind;
  decision?: 'approved' | 'rejected';
  reason?: string;
  actor?: 'owner' | 'operator' | 'system';
  ledgerFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionApprovalLedgerService({
  ledgerFile: options.ledgerFile,
});

if (options.summary) {
  const summary = service.buildSummary();
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(service.renderSummary(summary));
  }
  process.exit(0);
}

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-approval] Approval gate approval ledger');
    console.log(`[transaction-approval] version: ${snapshot.version}`);
    console.log(`[transaction-approval] summary: ${snapshot.summary}`);
    console.log(`[transaction-approval] entry kinds: ${snapshot.ledgerEntryKinds.join(', ')}`);
  }
  process.exit(0);
}

const preview = service.buildPreviewFromText({
  text: options.text,
  kind: options.kind,
  actionKind: options.actionKind,
  targetKind: options.targetKind,
  channel: 'cli',
});
const previewEntry = service.recordPreview(preview, options.actor ?? 'system');

if (!options.decision) {
  if (options.json) {
    console.log(JSON.stringify({ preview, entry: previewEntry, summary: service.buildSummary() }, null, 2));
  } else {
    console.log(service.renderEntry(previewEntry));
  }
  process.exit(0);
}

const decisionEntry = service.decide({
  preview,
  decision: options.decision,
  actor: options.actor ?? 'owner',
  reason: options.reason,
});

if (options.json) {
  console.log(JSON.stringify({ preview, previewEntry, decisionEntry, summary: service.buildSummary() }, null, 2));
} else {
  console.log(service.renderEntry(decisionEntry));
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    summary: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--summary') {
      options.summary = true;
    } else if (arg === '--text') {
      options.text = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--text=')) {
      options.text = arg.slice('--text='.length);
    } else if (arg === '--kind') {
      options.kind = args[index + 1] as CliOptions['kind'];
      index += 1;
    } else if (arg?.startsWith('--kind=')) {
      options.kind = arg.slice('--kind='.length) as CliOptions['kind'];
    } else if (arg === '--action-kind') {
      options.actionKind = args[index + 1] as CliOptions['actionKind'];
      index += 1;
    } else if (arg?.startsWith('--action-kind=')) {
      options.actionKind = arg.slice('--action-kind='.length) as CliOptions['actionKind'];
    } else if (arg === '--target-kind') {
      options.targetKind = args[index + 1] as CliOptions['targetKind'];
      index += 1;
    } else if (arg?.startsWith('--target-kind=')) {
      options.targetKind = arg.slice('--target-kind='.length) as CliOptions['targetKind'];
    } else if (arg === '--decision') {
      options.decision = normalizeDecision(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--decision=')) {
      options.decision = normalizeDecision(arg.slice('--decision='.length));
    } else if (arg === '--reason') {
      options.reason = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--reason=')) {
      options.reason = arg.slice('--reason='.length);
    } else if (arg === '--actor') {
      options.actor = normalizeActor(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--actor=')) {
      options.actor = normalizeActor(arg.slice('--actor='.length));
    } else if (arg === '--ledger-file') {
      options.ledgerFile = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--ledger-file=')) {
      options.ledgerFile = arg.slice('--ledger-file='.length);
    }
  }

  return options;
}

function normalizeDecision(value: string | undefined): 'approved' | 'rejected' | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['approve', 'approved', 'aprovar', 'aprovado'].includes(normalized)) {
    return 'approved';
  }
  if (['reject', 'rejected', 'rejeitar', 'rejeitado'].includes(normalized)) {
    return 'rejected';
  }
  return undefined;
}

function normalizeActor(value: string | undefined): 'owner' | 'operator' | 'system' | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'owner' || normalized === 'operator' || normalized === 'system') {
    return normalized;
  }
  return undefined;
}
