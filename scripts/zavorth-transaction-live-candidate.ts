import {
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
  type ZavorthTransactionLiveCandidateInput,
} from '../src/contracts/ZavorthTransactionLiveCandidateContract.js';
import type {
  ZavorthTransactionSurfaceKind,
} from '../src/contracts/ZavorthTransactionSurfaceContract.js';
import type {
  ZavorthTransactionConnectorMode,
} from '../src/contracts/ZavorthTransactionConnectorContract.js';
import { ZavorthTransactionLiveCandidateEnvelopeService } from '../src/services/ZavorthTransactionLiveCandidateEnvelopeService.js';

type CliOptions = ZavorthTransactionLiveCandidateInput & {
  json: boolean;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionLiveCandidateEnvelopeService({
  ledgerFile: options.ledgerFile,
  credentialStoreFile: options.credentialStoreFile,
});

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-live-candidate] Phase 10 owner-gated live candidate envelope');
    console.log(`[transaction-live-candidate] version: ${snapshot.version}`);
    console.log(`[transaction-live-candidate] owner-phrase: ${snapshot.ownerPhrase}`);
  }
  process.exit(0);
}

const result = service.propose(options);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(service.renderReport(result));
}

process.exit(result.status === 'candidate-ready' ? 0 : 1);

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
    } else if (arg === '--owner-confirm') {
      options.ownerConfirmed = true;
    } else if (arg === '--owner-phrase') {
      options.ownerIntent = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--owner-phrase-default') {
      options.ownerIntent = ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE;
    } else if (arg === '--owner-id') {
      options.ownerId = args[index + 1] ?? 'owner';
      index += 1;
    } else if (arg === '--text') {
      options.text = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--text=')) {
      options.text = arg.slice('--text='.length);
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
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['web', 'cli', 'telegram', 'api', 'natural-first'].includes(normalized)) {
    return normalized as ZavorthTransactionSurfaceKind;
  }
  return undefined;
}

function normalizeMode(value: string | undefined): ZavorthTransactionConnectorMode | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'dry-run' || normalized === 'sandbox' || normalized === 'paper') {
    return normalized;
  }
  return undefined;
}
