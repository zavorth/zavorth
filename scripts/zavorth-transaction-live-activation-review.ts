import {
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
  type ZavorthTransactionLiveActivationReviewInput,
} from '../src/contracts/ZavorthTransactionLiveActivationReviewContract.js';
import {
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
} from '../src/contracts/ZavorthTransactionLiveCandidateContract.js';
import type {
  ZavorthTransactionConnectorMode,
} from '../src/contracts/ZavorthTransactionConnectorContract.js';
import type {
  ZavorthTransactionSurfaceKind,
} from '../src/contracts/ZavorthTransactionSurfaceContract.js';
import { ZavorthTransactionLiveActivationReviewService } from '../src/services/ZavorthTransactionLiveActivationReviewService.js';

type CliOptions = ZavorthTransactionLiveActivationReviewInput & {
  json: boolean;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionLiveActivationReviewService({
  ledgerFile: options.ledgerFile,
  credentialStoreFile: options.credentialStoreFile,
});

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-live-activation-review] Phase 11 live activation review gate');
    console.log(`[transaction-live-activation-review] version: ${snapshot.version}`);
    console.log(`[transaction-live-activation-review] owner-phrase: ${snapshot.ownerPhrase}`);
  }
  process.exit(0);
}

const result = service.review(options);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(service.renderReport(result));
}

process.exit(result.status === 'ready-for-live-activation-review' ? 0 : 1);

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

function numberArg(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pushList(current: string[] | null | undefined, value: string | undefined): string[] {
  const next = String(value ?? '').trim();
  return next ? [...(current ?? []), next] : [...(current ?? [])];
}
