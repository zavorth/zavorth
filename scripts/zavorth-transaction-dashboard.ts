import type { ZavorthTransactionZavorthControlProjectInput } from '../src/contracts/ZavorthTransactionZavorthControlContract.js';
import type { ZavorthTransactionSurfaceKind } from '../src/contracts/ZavorthTransactionSurfaceContract.js';
import type { ZavorthTransactionConnectorMode } from '../src/contracts/ZavorthTransactionConnectorContract.js';
import { ZavorthTransactionApprovalLedgerService } from '../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionZavorthControlProjectionService } from '../src/services/ZavorthTransactionZavorthControlProjectionService.js';
import { ZavorthTransactionConnectorRegistryService } from '../src/services/ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionCredentialRefService } from '../src/services/ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionPreviewService } from '../src/services/ZavorthTransactionPreviewService.js';
import { ZavorthTransactionRuntimeOrchestratorService } from '../src/services/ZavorthTransactionRuntimeOrchestratorService.js';
import { ZavorthTransactionSurfaceGatewayService } from '../src/services/ZavorthTransactionSurfaceGatewayService.js';

type CliOptions = ZavorthTransactionZavorthControlProjectInput & {
  json: boolean;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const previewService = new ZavorthTransactionPreviewService();
const service = new ZavorthTransactionZavorthControlProjectionService({
  surfaceGateway: new ZavorthTransactionSurfaceGatewayService({
    runtime: new ZavorthTransactionRuntimeOrchestratorService({
      previewService,
      approvalLedger: new ZavorthTransactionApprovalLedgerService({
        ledgerFile: options.ledgerFile,
        previewService,
      }),
      credentialRefs: new ZavorthTransactionCredentialRefService({
        storeFile: options.credentialStoreFile,
      }),
      connectorRegistry: new ZavorthTransactionConnectorRegistryService(),
    }),
  }),
});

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-zavorthControl] ZavorthControl controls transaction ZavorthControl projection');
    console.log(`[transaction-zavorthControl] version: ${snapshot.version}`);
    console.log(`[transaction-zavorthControl] summary: ${snapshot.summary}`);
    console.log(`[transaction-zavorthControl] lanes: ${snapshot.laneKinds.join(', ')}`);
  }
  process.exit(0);
}

const projection = service.project(options);

if (options.json) {
  console.log(JSON.stringify(projection, null, 2));
} else {
  console.log(service.renderReport(projection));
}

process.exit(projection.status === 'blocked' ? 1 : 0);

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    text: '',
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
      options.text = args[index + 1] ?? '';
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
    } else if (arg === '--surface') {
      options.surface = normalizeSurface(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--surface=')) {
      options.surface = normalizeSurface(arg.slice('--surface='.length));
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

function normalizeSurface(value: string | undefined): ZavorthTransactionSurfaceKind | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['web', 'cli', 'telegram', 'api', 'natural-first'].includes(normalized)) {
    return normalized as ZavorthTransactionSurfaceKind;
  }
  return undefined;
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
