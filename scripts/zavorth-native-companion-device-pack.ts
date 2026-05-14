import { ZavorthNativeCompanionDevicePackService } from '../src/services/ZavorthNativeCompanionDevicePackService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const mlxText = readArg('--mlx-tts');
const approvalId = readArg('--approval-id');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthNativeCompanionDevicePackService();
  const snapshot = await service.buildSnapshot();
  const mlxTtsPreviewReceipt = mlxText
    ? service.buildMlxTtsPreviewReceipt({
        text: mlxText,
        approvalId,
      })
    : null;

  if (asJson) {
    console.log(JSON.stringify({
      ...snapshot,
      ...(mlxTtsPreviewReceipt ? { mlxTtsPreviewReceipt } : {}),
    }, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
    if (mlxTtsPreviewReceipt) {
      console.log('MLX TTS receipt:');
      console.log(JSON.stringify(mlxTtsPreviewReceipt, null, 2));
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
