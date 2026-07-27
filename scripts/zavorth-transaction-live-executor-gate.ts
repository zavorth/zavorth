import { ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE } from '../src/contracts/ZavorthTransactionLiveActivationReviewContract.js';
import { ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE } from '../src/contracts/ZavorthTransactionLiveCandidateContract.js';
import {
  ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
  type ZavorthTransactionLiveExecutorGateInput,
} from '../src/contracts/ZavorthTransactionLiveExecutorGateContract.js';
import {
  ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
  type ZavorthTransactionLiveMicroRolloutCertificationScenarioId,
} from '../src/contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.js';
import { ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE } from '../src/contracts/ZavorthTransactionSandboxControlledExecutorContract.js';
import type { ZavorthTransactionActionKind } from '../src/contracts/ZavorthTransactionPlaneContract.js';
import type { ZavorthTransactionConnectorKind } from '../src/contracts/ZavorthTransactionPreviewContract.js';
import { ZavorthTransactionLiveExecutorGateService } from '../src/services/ZavorthTransactionLiveExecutorGateService.js';

type CliOptions = ZavorthTransactionLiveExecutorGateInput & {
  json: boolean;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionLiveExecutorGateService({
  ledgerFile: options.ledgerFile,
  credentialStoreFile: options.credentialStoreFile,
});

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-live-executor-gate] Intent model6 live executor readiness gate');
    console.log(`[transaction-live-executor-gate] version: ${snapshot.version}`);
    console.log(`[transaction-live-executor-gate] owner-phrase: ${snapshot.ownerPhrase}`);
  }
  process.exit(0);
}

const result = service.prepare(options);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(service.renderReport(result));
}

process.exit(result.status === 'live-ready-held' ? 0 : 1);

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
    } else if (arg === '--sandbox-execution-confirm') {
      options.sandboxExecutionConfirmed = true;
    } else if (arg === '--sandbox-execution-phrase') {
      options.sandboxExecutionIntent = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--sandbox-execution-phrase-default') {
      options.sandboxExecutionIntent = ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE;
    } else if (arg === '--sandbox-run-id') {
      options.sandboxRunId = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--micro-rollout-confirm') {
      options.microRolloutReviewConfirmed = true;
    } else if (arg === '--micro-rollout-phrase') {
      options.microRolloutReviewIntent = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--micro-rollout-phrase-default') {
      options.microRolloutReviewIntent = ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE;
    } else if (arg === '--micro-rollout-review-id') {
      options.microRolloutReviewId = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--safe-micro-rollout-controls') {
      options.useSafeMicroRolloutControls = true;
    } else if (arg === '--fail-certification-scenario') {
      options.failCertificationScenario = normalizeScenario(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--fail-certification-scenario=')) {
      options.failCertificationScenario = normalizeScenario(arg.slice('--fail-certification-scenario='.length));
    } else if (arg === '--live-operator-confirm') {
      options.liveOperatorConfirmed = true;
    } else if (arg === '--live-operator-phrase') {
      options.liveOperatorIntent = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-operator-phrase-default') {
      options.liveOperatorIntent = ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE;
    } else if (arg === '--live-run-id') {
      options.liveRunId = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--safe-live-adapter') {
      options.useSafeLiveAdapterControls = true;
    } else if (arg === '--execute-live') {
      options.executeLive = true;
    } else if (arg === '--force-kill-switch') {
      options.forceKillSwitch = true;
    } else if (arg === '--simulate-sandbox-failure') {
      options.dryRunSandboxFailure = true;
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
    } else if (arg === '--safe-default-controls') {
      options.useSafeDefaultControls = true;
    } else if (arg === '--safe-sandbox-adapter') {
      options.useSafeSandboxAdapter = true;
    } else if (arg === '--micro-max-amount') {
      ensureRolloutLimits(options).maxMicroAmount = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--micro-max-amount=')) {
      ensureRolloutLimits(options).maxMicroAmount = numberArg(arg.slice('--micro-max-amount='.length));
    } else if (arg === '--micro-daily-limit') {
      ensureRolloutLimits(options).maxDailyAmount = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--micro-daily-limit=')) {
      ensureRolloutLimits(options).maxDailyAmount = numberArg(arg.slice('--micro-daily-limit='.length));
    } else if (arg === '--micro-max-executions-per-day') {
      ensureRolloutLimits(options).maxExecutionsPerDay = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--micro-max-executions-per-day=')) {
      ensureRolloutLimits(options).maxExecutionsPerDay = numberArg(arg.slice('--micro-max-executions-per-day='.length));
    } else if (arg === '--micro-observation-hours') {
      ensureRolloutLimits(options).requiredObservationHours = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--micro-observation-hours=')) {
      ensureRolloutLimits(options).requiredObservationHours = numberArg(arg.slice('--micro-observation-hours='.length));
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
    } else if (arg === '--allow-connector') {
      ensureLimits(options).allowedConnectorIds = pushList(ensureLimits(options).allowedConnectorIds, args[index + 1]);
      index += 1;
    } else if (arg === '--kill-switch-id') {
      ensureKillSwitch(options).id = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--kill-switch-enabled') {
      ensureKillSwitch(options).enabled = true;
    } else if (arg === '--kill-switch-tested') {
      ensureKillSwitch(options).tested = true;
    } else if (arg === '--kill-switch-command') {
      ensureKillSwitch(options).command = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--rollback-drill-id') {
      ensureRollbackDrill(options).drillId = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--rollback-drill-performed') {
      ensureRollbackDrill(options).performed = true;
    } else if (arg === '--rollback-drill-successful') {
      ensureRollbackDrill(options).successful = true;
    } else if (arg === '--rollback-summary') {
      ensureRollbackDrill(options).summary = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--replay-command') {
      ensureRollbackDrill(options).replayCommand = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--rollback-command') {
      ensureRollbackDrill(options).rollbackCommand = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--rollback-artifact') {
      ensureRollbackDrill(options).artifacts = pushList(ensureRollbackDrill(options).artifacts, args[index + 1]);
      index += 1;
    } else if (arg === '--adapter-id') {
      ensureAdapter(options).id = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--adapter-kind') {
      ensureAdapter(options).connectorKind = normalizeConnectorKind(args[index + 1]);
      index += 1;
    } else if (arg === '--adapter-environment') {
      ensureAdapter(options).environment = normalizeAdapterEnvironment(args[index + 1]);
      index += 1;
    } else if (arg === '--adapter-endpoint') {
      ensureAdapter(options).endpointBaseUrl = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--adapter-allow-host') {
      ensureAdapter(options).allowedHosts = pushList(ensureAdapter(options).allowedHosts, args[index + 1]);
      index += 1;
    } else if (arg === '--adapter-credential-ref') {
      ensureAdapter(options).credentialRef = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--adapter-idempotency-header') {
      ensureAdapter(options).idempotencyHeader = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--adapter-rate-limit') {
      ensureAdapter(options).maxRequestsPerMinute = numberArg(args[index + 1]);
      index += 1;
    } else if (arg === '--adapter-timeout-ms') {
      ensureAdapter(options).timeoutMs = numberArg(args[index + 1]);
      index += 1;
    } else if (arg === '--adapter-circuit-breaker') {
      ensureAdapter(options).circuitBreaker = true;
    } else if (arg === '--live-adapter-id') {
      ensureLiveAdapter(options).id = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-connector-id') {
      ensureLiveAdapter(options).connectorId = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-connector-kind') {
      ensureLiveAdapter(options).connectorKind = normalizeConnectorKind(args[index + 1]);
      index += 1;
    } else if (arg === '--live-action-kind') {
      ensureLiveAdapter(options).actionKind = normalizeActionKind(args[index + 1]);
      index += 1;
    } else if (arg === '--live-endpoint') {
      ensureLiveAdapter(options).endpointBaseUrl = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-allow-host') {
      ensureLiveAdapter(options).allowedHosts = pushList(ensureLiveAdapter(options).allowedHosts, args[index + 1]);
      index += 1;
    } else if (arg === '--live-credential-ref') {
      ensureLiveAdapter(options).credentialRef = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-idempotency-header') {
      ensureLiveAdapter(options).idempotencyHeader = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-maximum-amount') {
      ensureLiveAdapter(options).maximumLiveAmount = numberArg(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith('--live-maximum-amount=')) {
      ensureLiveAdapter(options).maximumLiveAmount = numberArg(arg.slice('--live-maximum-amount='.length));
    } else if (arg === '--live-rate-limit') {
      ensureLiveAdapter(options).maxRequestsPerMinute = numberArg(args[index + 1]);
      index += 1;
    } else if (arg === '--live-timeout-ms') {
      ensureLiveAdapter(options).timeoutMs = numberArg(args[index + 1]);
      index += 1;
    } else if (arg === '--live-circuit-breaker') {
      ensureLiveAdapter(options).circuitBreaker = true;
    } else if (arg === '--live-supports-idempotency') {
      ensureLiveAdapter(options).supportsIdempotency = true;
    } else if (arg === '--live-supports-balance-check') {
      ensureLiveAdapter(options).supportsBalanceCheck = true;
    } else if (arg === '--live-supports-price-recheck') {
      ensureLiveAdapter(options).supportsPriceRecheck = true;
    } else if (arg === '--live-supports-receipt-fetch') {
      ensureLiveAdapter(options).supportsReceiptFetch = true;
    } else if (arg === '--live-kill-switch-id') {
      ensureLiveAdapter(options).killSwitchId = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-rollback-drill-id') {
      ensureLiveAdapter(options).rollbackDrillId = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-rollback-command') {
      ensureLiveAdapter(options).rollbackCommand = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-health-check-command') {
      ensureLiveAdapter(options).healthCheckCommand = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--live-smoke-command') {
      ensureLiveAdapter(options).liveSmokeCommand = args[index + 1] ?? '';
      index += 1;
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
  options.limits ......= {};
  return options.limits;
}

function ensureRolloutLimits(options: CliOptions): NonNullable<CliOptions['rolloutLimits']> {
  options.rolloutLimits ......= {};
  return options.rolloutLimits;
}

function ensureKillSwitch(options: CliOptions): NonNullable<CliOptions['killSwitch']> {
  options.killSwitch ......= {};
  return options.killSwitch;
}

function ensureRollbackDrill(options: CliOptions): NonNullable<CliOptions['rollbackDrill']> {
  options.rollbackDrill ......= {};
  return options.rollbackDrill;
}

function ensureAdapter(options: CliOptions): NonNullable<CliOptions['adapterManifest']> {
  options.adapterManifest ......= {};
  return options.adapterManifest;
}

function ensureLiveAdapter(options: CliOptions): NonNullable<CliOptions['liveAdapterManifest']> {
  options.liveAdapterManifest ......= {};
  return options.liveAdapterManifest;
}

function normalizeSurface(value: string | undefined): CliOptions['surface'] {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['web', 'cli', 'telegram', 'api', 'natural-first'].includes(normalized)) {
    return normalized as CliOptions['surface'];
  }
  return undefined;
}

function normalizeMode(value: string | undefined): CliOptions['mode'] {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'dry-run' || normalized === 'sandbox' || normalized === 'paper') {
    return normalized;
  }
  return undefined;
}

function normalizeAdapterEnvironment(value: string | undefined): 'sandbox' | 'paper' | 'live' | 'production' {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
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
    ? (normalized as ZavorthTransactionConnectorKind)
    : 'unknown';
}

function normalizeActionKind(value: string | undefined): ZavorthTransactionActionKind {
  const normalized = String(value ?? '').trim();
  const allowed: ZavorthTransactionActionKind[] = [
    'market-data-read',
    'price-monitor',
    'cart-preview',
    'purchase-submit',
    'payment-submit',
    'trade-order',
    'trade-cancel',
    'asset-transfer',
    'asset-withdrawal',
    'currency-conversion',
    'subscription-create',
    'subscription-cancel',
    'api-credit-purchase',
    'refund-request',
    'mandate-create',
    'mandate-revoke',
  ];
  return allowed.includes(normalized as ZavorthTransactionActionKind)
    ? (normalized as ZavorthTransactionActionKind)
    : 'trade-order';
}

function normalizeScenario(
  value: string | undefined,
): ZavorthTransactionLiveMicroRolloutCertificationScenarioId | null {
  const normalized = String(value ?? '').trim();
  const allowed: ZavorthTransactionLiveMicroRolloutCertificationScenarioId[] = [
    'prompt-injection-without-approval',
    'token-leak',
    'approval-replay',
    'expired-mandate',
    'connector-down',
    'price-drift',
    'wrong-user-approval',
    'duplicate-execution',
    'missing-rollback',
    'incomplete-ledger',
  ];
  return allowed.includes(normalized as ZavorthTransactionLiveMicroRolloutCertificationScenarioId)
    ? (normalized as ZavorthTransactionLiveMicroRolloutCertificationScenarioId)
    : null;
}

function numberArg(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pushList(current: string[] | null | undefined, value: string | undefined): string[] {
  const next = String(value ?? '').trim();
  return next ? [...(current ?? []), next] : [...(current ?? [])];
}
