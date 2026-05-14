import { ZavorthTransactionPreviewService } from '../src/services/ZavorthTransactionPreviewService.js';

type CliOptions = {
  json: boolean;
  text?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionPreviewService();

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-preview] Phase 2 transaction preview');
    console.log(`[transaction-preview] version: ${snapshot.version}`);
    console.log(`[transaction-preview] summary: ${snapshot.summary}`);
    console.log(`[transaction-preview] statuses: ${snapshot.statuses.join(', ')}`);
    console.log(`[transaction-preview] connector kinds: ${snapshot.connectorKinds.join(', ')}`);
  }
  process.exit(0);
}

const preview = service.buildPreview({
  text: options.text,
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
    }
  }

  return options;
}
