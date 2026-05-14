import type {
  ZavorthTransactionConnectorMode,
} from '../src/contracts/ZavorthTransactionConnectorContract.js';
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
    console.log('[transaction-runtime] Phase 6 transaction runtime');
    console.log(`[transaction-runtime] version: ${snapshot.version}`);
    console.log(`[transaction-runtime] summary: ${snapshot.summary}`);
    console.log(`[transaction-runtime] stages: ${snapshot.stages.join(', ')}`);
  }
  process.exit(0);
}

const result = service.run({
  text: options.text,
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

process.exit(result.status === 'simulated' || result.status === 'preview-ready' ? 0 : 1);

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
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'dry-run' || normalized === 'sandbox' || normalized === 'paper') {
    return normalized;
  }
  return undefined;
}
