import { ZavorthNativeLearningLoopService } from '../src/services/ZavorthNativeLearningLoopService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');

function readFlag(name: string): string | null {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

async function main(): Promise<void> {
  const service = new ZavorthNativeLearningLoopService();
  const originalLog = console.log;
  console.log = () => undefined;
  let snapshot;
  try {
    snapshot = await service.buildSnapshot({
      query: readFlag('--query'),
      observation: readFlag('--observe') || readFlag('--observation'),
      userId: readFlag('--user') || 'zavorth-runtime',
      sessionId: readFlag('--session'),
      workspace: readFlag('--workspace') || process.cwd(),
      sourceSurface: readFlag('--surface') || 'cli',
      limit: Number(readFlag('--limit') || 0) || undefined,
    });
  } finally {
    console.log = originalLog;
  }

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log(service.formatSnapshotText(snapshot));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
