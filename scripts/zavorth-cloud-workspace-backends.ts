import { ZavorthCloudWorkspaceBackendsService } from '../src/services/ZavorthCloudWorkspaceBackendsService.js';

const json = process.argv.includes('--json');
const snapshot = new ZavorthCloudWorkspaceBackendsService().buildSnapshot();

if (json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('Zavorth cloud workspace backends');
  console.log(`status: ${snapshot.status}`);
  console.log(`ready: ${snapshot.summary.ready}/${snapshot.summary.total}`);
  for (const backend of snapshot.backends) {
    console.log(`- ${backend.id}: ${backend.status} | ${backend.nextAction}`);
  }
}
