import { LlmRuntimeService } from '../src/services/llm/LlmRuntimeService.js';
import { SourceProviderMeshExpansionService } from '../src/services/SourceProviderMeshExpansionService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const confirmLiveIo = args.includes('--confirm-live-io');
const sourceRoot = readArg('--source-root');
const zavorthRoot = readArg('--zavorth-root');
const provider = readArg('--provider');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new SourceProviderMeshExpansionService();
  const snapshot = service.buildSnapshot({
    sourceRoot,
    zavorthRoot,
  });

  if (provider && confirmLiveIo) {
    const liveReceipt = await runLiveSmoke(provider);
    if (asJson) {
      console.log(JSON.stringify({
        ...snapshot,
        liveSmokeReceipt: liveReceipt,
      }, null, 2));
    } else {
      console.log(service.formatSnapshotText(snapshot));
      console.log('Live smoke receipt:');
      console.log(JSON.stringify(liveReceipt, null, 2));
    }
  } else {
    if (asJson) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      console.log(service.formatSnapshotText(snapshot));
      if (provider && !confirmLiveIo) {
        console.log(`Live smoke for ${provider} was not run. Pass --confirm-live-io explicitly.`);
      }
    }
  }

  if (requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}

async function runLiveSmoke(providerName: string): Promise<Record<string, unknown>> {
  const startedAt = new Date().toISOString();
  const runtime = new LlmRuntimeService(providerName);
  const result = await runtime.chatDetailed([
    {
      role: 'system',
      content: 'Return a compact health-check response.',
    },
    {
      role: 'user',
      content: 'Say OK and nothing else.',
    },
  ], [], {
    providerName,
    allowFallback: false,
  });

  return {
    providerName,
    modelName: result.modelName,
    status: 'passed',
    liveIoPerformed: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    contentLength: String(result.response.content || '').length,
    finishReason: result.response.finishReason,
    secretValuesSerialized: false,
    route: result.route,
  };
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}
