import { ZavorthInnovationRadarService } from '../src/services/ZavorthInnovationRadarService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');
const persist = !args.includes('--no-persist');
const inputFiles = valuesFor('--input');
const feedUrls = valuesFor('--feed');
const allowedHosts = valuesFor('--allowed-host');

void main().catch((error) => {
  process.stderr.write(`[innovation-radar] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthInnovationRadarService();
  const snapshot = await service.run({
    inputFiles,
    feedUrls,
    allowedHosts,
    persist,
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\n`);
  }

  if (snapshot.status === 'blocked') {
    process.exitCode = 1;
  } else if (requirePass && snapshot.summary.sourcesBlocked + snapshot.summary.sourcesFailed > 0) {
    process.exitCode = 2;
  }
}

function valuesFor(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }
  return values;
}
