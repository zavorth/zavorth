import { ZavorthTrajectoryExportService } from '../src/services/ZavorthTrajectoryExportService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const format = valueAfter('--format') || 'jsonl';
const exportPath = valueAfter('--export-path');
const approvalId = valueAfter('--approval-id');
const limit = valueAfter('--limit');

const snapshot = new ZavorthTrajectoryExportService().buildSnapshot({
  format: format as any,
  exportPath,
  approvalId,
  limit: limit ? Number(limit) : undefined,
});

if (json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('Zavorth trajectory export');
  console.log(`status: ${snapshot.status}`);
  console.log(`format: ${snapshot.format}`);
  console.log(`records: ${snapshot.summary.records}`);
  console.log(`exportPath: ${snapshot.exportPath || 'preview-only'}`);
}

function valueAfter(name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) return null;
  return args[index + 1] || null;
}
