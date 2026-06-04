import { ZavorthBatchWorkloadService } from '../src/services/ZavorthBatchWorkloadService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const live = args.includes('--live');
const objective = valueAfter('--objective') || args.filter((arg) => !arg.startsWith('--')).join(' ');
const items = valuesAfter('--item');
const approvalId = valueAfter('--approval-id');
const outputPath = valueAfter('--output-path');
const concurrency = valueAfter('--concurrency');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const snapshot = await new ZavorthBatchWorkloadService().buildSnapshot({
    objective,
    items: items.length ? items : null,
    live,
    approvalId,
    outputPath,
    concurrency: concurrency ? Number(concurrency) : undefined,
  });

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log('Zavorth batch workload');
    console.log(`status: ${snapshot.status}`);
    console.log(`runId: ${snapshot.runId}`);
    console.log(`items: ${snapshot.summary.items}`);
    console.log(`completed: ${snapshot.summary.completed}`);
  }
}

function valueAfter(name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) return null;
  return args[index + 1] || null;
}

function valuesAfter(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) values.push(args[index + 1]);
  }
  return values;
}
