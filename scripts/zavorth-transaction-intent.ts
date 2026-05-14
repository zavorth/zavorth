import { ZavorthTransactionIntentService } from '../src/services/ZavorthTransactionIntentService.js';

type CliOptions = {
  json: boolean;
  examples: boolean;
  text?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionIntentService();

if (options.examples) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot.examples, null, 2));
  } else {
    for (const example of snapshot.examples) {
      console.log(`[transaction-intent] ${example.text}`);
    }
  }
  process.exit(0);
}

if (!options.text) {
  const snapshot = service.buildSnapshot();
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('[transaction-intent] Phase 1 natural transaction intent');
    console.log(`[transaction-intent] version: ${snapshot.version}`);
    console.log(`[transaction-intent] summary: ${snapshot.summary}`);
    console.log(`[transaction-intent] supported intents: ${snapshot.supportedIntents.join(', ')}`);
    console.log(`[transaction-intent] natural-first routes: ${snapshot.naturalFirstRoutes.join(', ')}`);
  }
  process.exit(0);
}

const result = service.parse({
  text: options.text,
  channel: 'cli',
});

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(service.renderReport(result));
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    examples: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--examples') {
      options.examples = true;
    } else if (arg === '--text') {
      options.text = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--text=')) {
      options.text = arg.slice('--text='.length);
    }
  }

  return options;
}
