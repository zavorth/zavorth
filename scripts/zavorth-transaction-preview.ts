import { ZavorthTransactionPreviewService } from '../src/services/ZavorthTransactionPreviewService.js';
import type {
  ZavorthTransactionIntentKind,
  ZavorthTransactionIntentTargetKind,
} from '../src/contracts/ZavorthTransactionIntentContract.js';
import type { ZavorthTransactionActionKind } from '../src/contracts/ZavorthTransactionPlaneContract.js';

type CliOptions = {
  json: boolean;
  text?: string;
  kind?: ZavorthTransactionIntentKind;
  actionKind?: ZavorthTransactionActionKind;
  targetKind?: ZavorthTransactionIntentTargetKind;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionPreviewService();

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-preview] Preview engine transaction preview');
    console.log(`[transaction-preview] version: ${snapshot.version}`);
    console.log(`[transaction-preview] summary: ${snapshot.summary}`);
    console.log(`[transaction-preview] statuses: ${snapshot.statuses.join(', ')}`);
    console.log(`[transaction-preview] connector kinds: ${snapshot.connectorKinds.join(', ')}`);
  }
  process.exit(0);
}

const preview = service.buildPreview({
  text: options.text,
  kind: options.kind,
  actionKind: options.actionKind,
  targetKind: options.targetKind,
  channel: 'cli',
});

if (options.json) {
  console.log(JSON.stringify(preview, null, 2));
} else {
  console.log(service.renderReport(preview));
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
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
    }
  }

  return options;
}
