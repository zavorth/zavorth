import {
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
} from '../src/contracts/ZavorthTransactionLiveActivationReviewContract.js';
import {
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
} from '../src/contracts/ZavorthTransactionLiveCandidateContract.js';
import type {
  ZavorthTransactionConnectorKind,
} from '../src/contracts/ZavorthTransactionPreviewContract.js';
import type {
  ZavorthTransactionSandboxAdapterCertificationInput,
} from '../src/contracts/ZavorthTransactionSandboxAdapterCertificationContract.js';
import { ZavorthTransactionSandboxAdapterCertificationService } from '../src/services/ZavorthTransactionSandboxAdapterCertificationService.js';

type CliOptions = ZavorthTransactionSandboxAdapterCertificationInput & {
  json: boolean;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionSandboxAdapterCertificationService({
  ledgerFile: options.ledgerFile,
  credentialStoreFile: options.credentialStoreFile,
});

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-sandbox-adapter-certification] Intent model2 sandbox adapter certification');
    console.log(`[transaction-sandbox-adapter-certification] version: ${snapshot.version}`);
  }
  process.exit(0);
}

const result = service.certify(options);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(service.renderReport(result));
}

process.exit(result.status === 'sandbox-certification-ready' ? 0 : 1);

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
    } else if (arg === '--activation-review-confirm') {
      options.activationReviewConfirmed = true;
    } else if (arg === '--activation-review-phrase') {
      options.activationReviewIntent = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--activation-review-phrase-default') {
      options.activationReviewIntent = ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE;
    } else if (arg === '--activation-review-id') {
      options.activationReviewId = args[index + 1] ?? '';
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
    } else if (arg === '--safe-default-controls') {
      options.useSafeDefaultControls = true;
    } else if (arg === '--safe-sandbox-adapter') {
      options.useSafeSandboxAdapter = true;
    } else if (arg === '--max-amount') {
      ensureLimits(options).maxSingleAmount = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--max-amount=')) {
      ensureLimits(options).maxSingleAmount = numberArg(arg.slice('--max-amount='.length));
    } else if (arg === '--daily-limit') {
      ensureLimits(options).maxDailyAmount = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--daily-limit=')) {
      ensureLimits(options).maxDailyAmount = numberArg(arg.slice('--daily-limit='.length));
    } else if (arg === '--max-executions-per-day') {
      ensureLimits(options).maxExecutionsPerDay = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--max-executions-per-day=')) {
      ensureLimits(options).maxExecutionsPerDay = numberArg(arg.slice('--max-executions-per-day='.length));
    } else if (arg === '--allow-target') {
      ensureLimits(options).allowedTargetLabels = pushList(ensureLimits(options).allowedTargetLabels, args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--allow-target=')) {
      ensureLimits(options).allowedTargetLabels = pushList(ensureLimits(options).allowedTargetLabels, arg.slice('--allow-target='.length));
    } else if (arg === '--allow-connector') {
      ensureLimits(options).allowedConnectorIds = pushList(ensureLimits(options).allowedConnectorIds, args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--allow-connector=')) {
      ensureLimits(options).allowedConnectorIds = pushList(ensureLimits(options).allowedConnectorIds, arg.slice('--allow-connector='.length));
    } else if (arg === '--currency') {
      ensureLimits(options).currency = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--currency=')) {
      ensureLimits(options).currency = arg.slice('--currency='.length);
    } else if (arg === '--kill-switch-id') {
      ensureKillSwitch(options).id = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--kill-switch-id=')) {
      ensureKillSwitch(options).id = arg.slice('--kill-switch-id='.length);
    } else if (arg === '--kill-switch-enabled') {
      ensureKillSwitch(options).enabled = true;
    } else if (arg === '--kill-switch-tested') {
      ensureKillSwitch(options).tested = true;
    } else if (arg === '--kill-switch-command') {
      ensureKillSwitch(options).command = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--kill-switch-command=')) {
      ensureKillSwitch(options).command = arg.slice('--kill-switch-command='.length);
    } else if (arg === '--rollback-drill-id') {
      ensureRollbackDrill(options).drillId = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--rollback-drill-id=')) {
      ensureRollbackDrill(options).drillId = arg.slice('--rollback-drill-id='.length);
    } else if (arg === '--rollback-drill-performed') {
      ensureRollbackDrill(options).performed = true;
    } else if (arg === '--rollback-drill-successful') {
      ensureRollbackDrill(options).successful = true;
    } else if (arg === '--rollback-summary') {
      ensureRollbackDrill(options).summary = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--rollback-summary=')) {
      ensureRollbackDrill(options).summary = arg.slice('--rollback-summary='.length);
    } else if (arg === '--replay-command') {
      ensureRollbackDrill(options).replayCommand = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--replay-command=')) {
      ensureRollbackDrill(options).replayCommand = arg.slice('--replay-command='.length);
    } else if (arg === '--rollback-command') {
      ensureRollbackDrill(options).rollbackCommand = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--rollback-command=')) {
      ensureRollbackDrill(options).rollbackCommand = arg.slice('--rollback-command='.length);
    } else if (arg === '--rollback-artifact') {
      ensureRollbackDrill(options).artifacts = pushList(ensureRollbackDrill(options).artifacts, args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--rollback-artifact=')) {
      ensureRollbackDrill(options).artifacts = pushList(ensureRollbackDrill(options).artifacts, arg.slice('--rollback-artifact='.length));
    } else if (arg === '--adapter-id') {
      ensureAdapter(options).id = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--adapter-id=')) {
      ensureAdapter(options).id = arg.slice('--adapter-id='.length);
    } else if (arg === '--adapter-kind') {
      ensureAdapter(options).connectorKind = normalizeConnectorKind(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--adapter-kind=')) {
      ensureAdapter(options).connectorKind = normalizeConnectorKind(arg.slice('--adapter-kind='.length));
    } else if (arg === '--adapter-environment') {
      ensureAdapter(options).environment = normalizeAdapterEnvironment(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--adapter-environment=')) {
      ensureAdapter(options).environment = normalizeAdapterEnvironment(arg.slice('--adapter-environment='.length));
    } else if (arg === '--adapter-endpoint') {
      ensureAdapter(options).endpointBaseUrl = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--adapter-endpoint=')) {
      ensureAdapter(options).endpointBaseUrl = arg.slice('--adapter-endpoint='.length);
    } else if (arg === '--adapter-allow-host') {
      ensureAdapter(options).allowedHosts = pushList(ensureAdapter(options).allowedHosts, args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--adapter-allow-host=')) {
      ensureAdapter(options).allowedHosts = pushList(ensureAdapter(options).allowedHosts, arg.slice('--adapter-allow-host='.length));
    } else if (arg === '--adapter-credential-ref') {
      ensureAdapter(options).credentialRef = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--adapter-credential-ref=')) {
      ensureAdapter(options).credentialRef = arg.slice('--adapter-credential-ref='.length);
    } else if (arg === '--adapter-idempotency-header') {
      ensureAdapter(options).idempotencyHeader = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--adapter-idempotency-header=')) {
      ensureAdapter(options).idempotencyHeader = arg.slice('--adapter-idempotency-header='.length);
    } else if (arg === '--adapter-rate-limit') {
      ensureAdapter(options).maxRequestsPerMinute = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--adapter-rate-limit=')) {
      ensureAdapter(options).maxRequestsPerMinute = numberArg(arg.slice('--adapter-rate-limit='.length));
    } else if (arg === '--adapter-timeout-ms') {
      ensureAdapter(options).timeoutMs = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--adapter-timeout-ms=')) {
      ensureAdapter(options).timeoutMs = numberArg(arg.slice('--adapter-timeout-ms='.length));
    } else if (arg === '--adapter-circuit-breaker') {
      ensureAdapter(options).circuitBreaker = true;
    } else if (arg === '--adapter-supports-live') {
      ensureAdapter(options).supportsLive = true;
    } else if (arg === '--adapter-raw-secrets-accepted') {
      ensureAdapter(options).rawSecretsAccepted = true;
    } else if (arg === '--adapter-dry-run-command') {
      ensureAdapter(options).dryRunCommand = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--adapter-dry-run-command=')) {
      ensureAdapter(options).dryRunCommand = arg.slice('--adapter-dry-run-command='.length);
    } else if (arg === '--adapter-smoke-command') {
      ensureAdapter(options).sandboxSmokeCommand = args[index + 1] ?? '';
      index += 1;
    } else if (arg?.startsWith('--adapter-smoke-command=')) {
      ensureAdapter(options).sandboxSmokeCommand = arg.slice('--adapter-smoke-command='.length);
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

function ensureLimits(options: CliOptions): NonNullable<CliOptions['limits']> {
  options.limits ??= {};
  return options.limits;
}

function ensureKillSwitch(options: CliOptions): NonNullable<CliOptions['killSwitch']> {
  options.killSwitch ??= {};
  return options.killSwitch;
}

function ensureRollbackDrill(options: CliOptions): NonNullable<CliOptions['rollbackDrill']> {
  options.rollbackDrill ??= {};
  return options.rollbackDrill;
}

function ensureAdapter(options: CliOptions): NonNullable<CliOptions['adapterManifest']> {
  options.adapterManifest ??= {};
  return options.adapterManifest;
}

function normalizeSurface(value: string | undefined): CliOptions['surface'] {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['web', 'cli', 'telegram', 'api', 'natural-first'].includes(normalized)) {
    return normalized as CliOptions['surface'];
  }
  return undefined;
}

function normalizeMode(value: string | undefined): CliOptions['mode'] {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'dry-run' || normalized === 'sandbox' || normalized === 'paper') {
    return normalized;
  }
  return undefined;
}

function normalizeAdapterEnvironment(value: string | undefined): 'sandbox' | 'paper' | 'live' | 'production' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'paper' || normalized === 'live' || normalized === 'production') {
    return normalized;
  }
  return 'sandbox';
}

function normalizeConnectorKind(value: string | undefined): ZavorthTransactionConnectorKind {
  const normalized = String(value ?? '').trim();
  const allowed: ZavorthTransactionConnectorKind[] = [
    'market-data',
    'commerce',
    'payment',
    'exchange',
    'currency-exchange',
    'subscription',
    'wallet',
    'unknown',
  ];
  return allowed.includes(normalized as ZavorthTransactionConnectorKind)
    ? normalized as ZavorthTransactionConnectorKind
    : 'unknown';
}

function numberArg(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pushList(current: string[] | null | undefined, value: string | undefined): string[] {
  const next = String(value ?? '').trim();
  return next ? [...(current ?? []), next] : [...(current ?? [])];
}
