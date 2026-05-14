import { ZavorthTransactionApprovalLedgerService } from '../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionConnectorRegistryService } from '../src/services/ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionPreviewService } from '../src/services/ZavorthTransactionPreviewService.js';
import type { ZavorthTransactionConnectorMode } from '../src/contracts/ZavorthTransactionConnectorContract.js';

type CliOptions = {
  json: boolean;
  list: boolean;
  approve: boolean;
  text?: string;
  mode?: ZavorthTransactionConnectorMode;
  connectorId?: string;
  credentialRef?: string;
  ledgerFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const registry = new ZavorthTransactionConnectorRegistryService();

if (options.list) {
  const connectors = registry.listConnectors();
  if (options.json) {
    console.log(JSON.stringify(connectors, null, 2));
  } else {
    for (const connector of connectors) {
      console.log(`[transaction-connector] ${connector.id} | ${connector.kind} | enabled=${connector.enabled} | modes=${connector.supportedModes.join(',')}`);
    }
  }
  process.exit(0);
}

if (!options.text) {
  const snapshot = registry.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-connector] Phase 4 typed connector dry-run');
    console.log(`[transaction-connector] version: ${snapshot.version}`);
    console.log(`[transaction-connector] summary: ${snapshot.summary}`);
    console.log(`[transaction-connector] supported modes: ${snapshot.supportedModes.join(', ')}`);
    console.log(`[transaction-connector] connectors: ${snapshot.connectors.map((connector) => connector.id).join(', ')}`);
  }
  process.exit(0);
}

const previewService = new ZavorthTransactionPreviewService();
const approvalLedger = new ZavorthTransactionApprovalLedgerService({
  ledgerFile: options.ledgerFile,
});
const preview = previewService.buildPreview({
  text: options.text,
  channel: 'cli',
});
const approvalEntry = options.approve
  ? (() => {
    approvalLedger.recordPreview(preview, 'system');
    return approvalLedger.decide({
      preview,
      decision: 'approved',
      actor: 'owner',
      reason: 'Phase 4 typed connector dry-run approval.',
    });
  })()
  : null;

const result = registry.run({
  preview,
  approvalEntry,
  connectorId: options.connectorId,
  mode: options.mode,
  credentialRef: options.credentialRef,
});

if (options.json) {
  console.log(JSON.stringify({ preview, approvalEntry, result }, null, 2));
} else {
  console.log(registry.renderReport(result));
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    list: false,
    approve: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--approve') {
      options.approve = true;
    } else if (arg === '--text') {
      options.text = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--text=')) {
      options.text = arg.slice('--text='.length);
    } else if (arg === '--mode') {
      options.mode = normalizeMode(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--mode=')) {
      options.mode = normalizeMode(arg.slice('--mode='.length));
    } else if (arg === '--connector-id') {
      options.connectorId = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--connector-id=')) {
      options.connectorId = arg.slice('--connector-id='.length);
    } else if (arg === '--credential-ref') {
      options.credentialRef = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--credential-ref=')) {
      options.credentialRef = arg.slice('--credential-ref='.length);
    } else if (arg === '--ledger-file') {
      options.ledgerFile = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--ledger-file=')) {
      options.ledgerFile = arg.slice('--ledger-file='.length);
    }
  }

  return options;
}

function normalizeMode(value: string | undefined): ZavorthTransactionConnectorMode | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'dry-run' || normalized === 'sandbox' || normalized === 'paper') {
    return normalized;
  }
  return undefined;
}
