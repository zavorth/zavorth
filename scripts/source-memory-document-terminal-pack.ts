import { SourceMemoryDocumentTerminalPackService } from '../src/services/SourceMemoryDocumentTerminalPackService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const confirmLiveNetwork = args.includes('--confirm-live-network');
const sourceRoot = readArg('--source-root');
const zavorthRoot = readArg('--zavorth-root');
const fetchUrl = readArg('--fetch');
const terminalCommand = readArg('--terminal');
const terminalCwd = readArg('--cwd');
const approvalId = readArg('--approval-id');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new SourceMemoryDocumentTerminalPackService();
  const snapshot = await service.buildSnapshot({
    sourceRoot,
    zavorthRoot,
  });

  const liveFetchReceipt = fetchUrl
    ? await service.runLiveFetch({
        url: fetchUrl,
        confirmLiveNetwork,
      })
    : null;
  const terminalReceipt = terminalCommand
    ? await service.runTerminalSmoke({
        command: terminalCommand,
        cwd: terminalCwd || zavorthRoot || process.cwd(),
        approvalId,
        allowExecution: Boolean(approvalId),
      })
    : null;

  if (asJson) {
    console.log(JSON.stringify({
      ...snapshot,
      ...(liveFetchReceipt ? { liveFetchReceipt } : {}),
      ...(terminalReceipt ? { terminalReceipt } : {}),
    }, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
    if (liveFetchReceipt) {
      console.log('Live fetch receipt:');
      console.log(JSON.stringify(liveFetchReceipt, null, 2));
    }
    if (terminalReceipt) {
      console.log('Terminal receipt:');
      console.log(JSON.stringify(terminalReceipt, null, 2));
    }
  }

  if (requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
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
