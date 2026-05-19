import type {
  ZavorthTransactionActionKind,
} from '../src/contracts/ZavorthTransactionPlaneContract.js';
import type {
  ZavorthTransactionConnectorKind,
} from '../src/contracts/ZavorthTransactionPreviewContract.js';
import type {
  ZavorthTransactionCredentialEnvironment,
} from '../src/contracts/ZavorthTransactionCredentialContract.js';
import { ZavorthTransactionCredentialRefService } from '../src/services/ZavorthTransactionCredentialRefService.js';

type CliOptions = {
  json: boolean;
  list: boolean;
  summary: boolean;
  register: boolean;
  validate: boolean;
  storeFile?: string;
  label?: string;
  connectorKind?: ZavorthTransactionConnectorKind;
  connectorId?: string;
  environment?: ZavorthTransactionCredentialEnvironment;
  actions: ZavorthTransactionActionKind[];
  ownerApproved: boolean;
  expiresAt?: string;
  ref?: string;
  secretValue?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionCredentialRefService({
  storeFile: options.storeFile,
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

if (options.list) {
  const records = service.readRecords();
  if (options.json) {
    console.log(JSON.stringify(records, null, 2));
  } else {
    for (const record of records) {
      console.log(`[transaction-credential] ${record.ref} | ${record.connectorKind} | ${record.environment} | actions=${record.allowedActions.join(',')}`);
    }
  }
  process.exit(0);
}

if (options.register) {
  const result = service.register({
    label: options.label ?? 'transaction credential',
    connectorKind: options.connectorKind ?? 'unknown',
    connectorId: options.connectorId,
    environment: options.environment,
    allowedActions: options.actions,
    ownerApproved: options.ownerApproved,
    expiresAt: options.expiresAt,
    ref: options.ref,
    secretValue: options.secretValue,
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(service.renderRegister(result));
  }
  process.exit(result.status === 'blocked' ? 1 : 0);
}

if (options.validate) {
  const result = service.validate({
    ref: options.ref ?? '',
    connectorKind: options.connectorKind ?? 'unknown',
    actionKind: options.actions[0] ?? 'market-data-read',
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(service.renderValidation(result));
  }
  process.exit(result.canUseForConnectorRun ? 0 : 1);
}

const snapshot = service.buildSnapshot();
if (options.json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[transaction-credential] Credential vault credential ref');
  console.log(`[transaction-credential] version: ${snapshot.version}`);
  console.log(`[transaction-credential] summary: ${snapshot.summary}`);
  console.log(`[transaction-credential] environments: ${snapshot.environments.join(', ')}`);
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    list: false,
    summary: false,
    register: false,
    validate: false,
    actions: [],
    ownerApproved: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--summary') {
      options.summary = true;
    } else if (arg === '--register') {
      options.register = true;
    } else if (arg === '--validate') {
      options.validate = true;
    } else if (arg === '--owner-approved') {
      options.ownerApproved = true;
    } else if (arg === '--store-file') {
      options.storeFile = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--store-file=')) {
      options.storeFile = arg.slice('--store-file='.length);
    } else if (arg === '--label') {
      options.label = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--label=')) {
      options.label = arg.slice('--label='.length);
    } else if (arg === '--connector-kind') {
      options.connectorKind = normalizeConnectorKind(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--connector-kind=')) {
      options.connectorKind = normalizeConnectorKind(arg.slice('--connector-kind='.length));
    } else if (arg === '--connector-id') {
      options.connectorId = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--connector-id=')) {
      options.connectorId = arg.slice('--connector-id='.length);
    } else if (arg === '--environment') {
      options.environment = normalizeEnvironment(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--environment=')) {
      options.environment = normalizeEnvironment(arg.slice('--environment='.length));
    } else if (arg === '--actions' || arg === '--action') {
      options.actions = parseActions(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--actions=')) {
      options.actions = parseActions(arg.slice('--actions='.length));
    } else if (arg?.startsWith('--action=')) {
      options.actions = parseActions(arg.slice('--action='.length));
    } else if (arg === '--expires-at') {
      options.expiresAt = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--expires-at=')) {
      options.expiresAt = arg.slice('--expires-at='.length);
    } else if (arg === '--ref') {
      options.ref = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--ref=')) {
      options.ref = arg.slice('--ref='.length);
    } else if (arg === '--secret-value') {
      options.secretValue = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--secret-value=')) {
      options.secretValue = arg.slice('--secret-value='.length);
    }
  }

  return options;
}

function normalizeConnectorKind(value: string | undefined): ZavorthTransactionConnectorKind | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['market-data', 'commerce', 'payment', 'exchange', 'currency-exchange', 'subscription', 'wallet', 'unknown'].includes(normalized)) {
    return normalized as ZavorthTransactionConnectorKind;
  }
  return undefined;
}

function normalizeEnvironment(value: string | undefined): ZavorthTransactionCredentialEnvironment | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['dry-run', 'sandbox', 'paper', 'live-candidate'].includes(normalized)) {
    return normalized as ZavorthTransactionCredentialEnvironment;
  }
  return undefined;
}

function parseActions(value: string | undefined): ZavorthTransactionActionKind[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as ZavorthTransactionActionKind[];
}
