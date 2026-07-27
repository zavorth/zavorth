import type { ZavorthTransactionConnectorMode } from '../src/contracts/ZavorthTransactionConnectorContract.js';
import type {
  ZavorthTransactionIntentKind,
  ZavorthTransactionIntentTargetKind,
} from '../src/contracts/ZavorthTransactionIntentContract.js';
import type { ZavorthTransactionActionKind } from '../src/contracts/ZavorthTransactionPlaneContract.js';
import { ZavorthTransactionApprovalLedgerService } from '../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionConnectorRegistryService } from '../src/services/ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionCredentialRefService } from '../src/services/ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionPreviewService } from '../src/services/ZavorthTransactionPreviewService.js';
import { ZavorthTransactionRuntimeOrchestratorService } from '../src/services/ZavorthTransactionRuntimeOrchestratorService.js';

type CliOptions = {
  json: boolean;
  approve: boolean;
  reject: boolean;
  requireCredential: boolean;
  text?: string;
  kind?: ZavorthTransactionIntentKind;
  actionKind?: ZavorthTransactionActionKind;
  targetKind?: ZavorthTransactionIntentTargetKind;
  mode?: ZavorthTransactionConnectorMode;
  credentialRef?: string;
  connectorId?: string;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const previewService = new ZavorthTransactionPreviewService();
const service = new ZavorthTransactionRuntimeOrchestratorService({
  previewService,
  approvalLedger: new ZavorthTransactionApprovalLedgerService({
    ledgerFile: options.ledgerFile,
    previewService,
  }),
  credentialRefs: new ZavorthTransactionCredentialRefService({
    storeFile: options.credentialStoreFile,
  }),
  connectorRegistry: new ZavorthTransactionConnectorRegistryService(),
});

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-runtime] Runtime gateway transaction runtime');
    console.log(`[transaction-runtime] version: ${snapshot.version}`);
    console.log(`[transaction-runtime] summary: ${snapshot.summary}`);
    console.log(`[transaction-runtime] stages: ${snapshot.stages.join(', ')}`);
  }
  process.exit(0);
}

const result = service.run({
  text: options.text,
  kind: options.kind,
  actionKind: options.actionKind,
  targetKind: options.targetKind,
  channel: 'cli',
  mode: options.mode,
  approve: options.approve,
  reject: options.reject,
  requireCredential: options.requireCredential,
  credentialRef: options.credentialRef,
  connectorId: options.connectorId,
});

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(service.renderReport(result));
}

process.exit(result.status === 'dry-run' || result.status === 'preview-ready' ? 0 : 1);

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    approve: false,
    reject: false,
    requireCredential: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--approve') {
      options.approve = true;
    } else if (arg === '--reject') {
      options.reject = true;
    } else if (arg === '--require-credential') {
      options.requireCredential = true;
    } else if (arg === '--text') {
      options.text = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--text=')) {
      options.text = arg.slice('--text='.length);
    } else if (arg === '--kind') {
      options.kind = args[index + 1] as ZavorthTransactionIntentKind;
      index += 1;
    } else if (arg?.startsWith('--kind=')) {
      options.kind = arg.slice('--kind='.length) as ZavorthTransactionIntentKind;
    } else if (arg === '--action-kind') {
      options.actionKind = args[index + 1] as ZavorthTransactionActionKind;
      index += 1;
    } else if (arg?.startsWith('--action-kind=')) {
      options.actionKind = arg.slice('--action-kind='.length) as ZavorthTransactionActionKind;
    } else if (arg === '--target-kind') {
      options.targetKind = args[index + 1] as ZavorthTransactionIntentTargetKind;
      index += 1;
    } else if (arg?.startsWith('--target-kind=')) {
      options.targetKind = arg.slice('--target-kind='.length) as ZavorthTransactionIntentTargetKind;
    } else if (arg === '--mode') {
      options.mode = normalizeMode(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--mode=')) {
      options.mode = normalizeMode(arg.slice('--mode='.length));
    } else if (arg === '--credential-ref') {
      options.credentialRef = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--credential-ref=')) {
      options.credentialRef = arg.slice('--credential-ref='.length);
    } else if (arg === '--connector-id') {
      options.connectorId = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--connector-id=')) {
      options.connectorId = arg.slice('--connector-id='.length);
    } else if (arg === '--ledger-file') {
      options.ledgerFile = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--ledger-file=')) {
      options.ledgerFile = arg.slice('--ledger-file='.length);
    } else if (arg === '--credential-store-file') {
      options.credentialStoreFile = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--credential-store-file=')) {
      options.credentialStoreFile = arg.slice('--credential-store-file='.length);
    }
  }

  return options;
}

function normalizeMode(value: string | undefined): ZavorthTransactionConnectorMode | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'dry-run' || normalized === 'sandbox' || normalized === 'paper') {
    return normalized;
  }
  return undefined;
}
