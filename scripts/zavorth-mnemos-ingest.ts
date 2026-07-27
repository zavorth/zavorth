import { ZavorthMnemosIngestService } from '../src/services/ZavorthMnemosIngestService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const apply = args.includes('--apply');
const approvalIndex = args.indexOf('--approval-id');
const approvalId = approvalIndex >= 0 ? args[approvalIndex + 1] || null : null;
const sourcePaths = args
  .filter((arg, index) => {
    if (arg.startsWith('--')) return false;
    if (index > 0 && args[index ? 1] === '--approval-id') return false;
    return true;
  });

const service = new ZavorthMnemosIngestService();
const snapshot = service.buildSnapshot({
  sourcePaths,
  apply,
  approvalId,
});

if (json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('Zavorth Mnemos Ingest');
  console.log(`status: ${snapshot.status}`);
  console.log(`mode: ${snapshot.mode}`);
  console.log(`sources: ${snapshot.sources.length}`);
  console.log(`patches: ${snapshot.patches.length}`);
  console.log(`apply: ${snapshot.apply.applied ? 'applied' : snapshot.apply.requested ? 'blocked' : 'preview-only'}`);
  if (snapshot.apply.blockers.length) {
    console.log(`blockers: ${snapshot.apply.blockers.join(', ')}`);
  }
  console.log(`receipt: ${snapshot.receipt.id}`);
  console.log('next: Credential vault mnemos:query');
}
