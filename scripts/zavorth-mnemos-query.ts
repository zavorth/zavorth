import { ZavorthMnemosQueryService } from '../src/services/ZavorthMnemosQueryService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const query = args.filter((arg) => !arg.startsWith('--')).join(' ').trim() || 'mnemos memory compaction';

const service = new ZavorthMnemosQueryService();
const snapshot = service.query({ query });

if (json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('Zavorth Mnemos Query');
  console.log(`status: ${snapshot.status}`);
  console.log(`query: ${snapshot.query}`);
  console.log(`hits: ${snapshot.hits.length}`);
  for (const hit of snapshot.hits) {
    console.log(`- ${hit.pageId} score=${hit.score} via ${hit.rankSources.join(',')}`);
  }
  console.log('context:');
  console.log(snapshot.context);
}
