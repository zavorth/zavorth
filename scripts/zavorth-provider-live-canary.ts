#!/usr/bin/env tsx
import { ZavorthProviderLiveCanaryService } from '../src/services/ZavorthProviderLiveCanaryService.js';

type Args = {
  json: boolean;
  runLive: boolean;
  requirePass: boolean;
  providerName: string | null;
  modelName: string | null;
  timeoutMs: number | null;
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthProviderLiveCanaryService();
  const snapshot = await service.buildSnapshot({
    runLive: args.runLive,
    providerName: args.providerName,
    modelName: args.modelName,
    timeoutMs: args.timeoutMs,
  });
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.renderReport(snapshot));
  }
  if (args.requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    runLive: false,
    requirePass: false,
    providerName: null,
    modelName: null,
    timeoutMs: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--run-live' || arg === '--live') out.runLive = true;
    else if (arg === '--require-pass') out.requirePass = true;
    else if (arg === '--provider') out.providerName = argv[++index] || null;
    else if (arg.startsWith('--provider=')) out.providerName = arg.slice('--provider='.length);
    else if (arg === '--model') out.modelName = argv[++index] || null;
    else if (arg.startsWith('--model=')) out.modelName = arg.slice('--model='.length);
    else if (arg === '--timeout-ms') out.timeoutMs = parsePositive(argv[++index]);
    else if (arg.startsWith('--timeout-ms=')) out.timeoutMs = parsePositive(arg.slice('--timeout-ms='.length));
  }
  return out;
}

function parsePositive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}
