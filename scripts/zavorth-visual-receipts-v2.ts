import { ZavorthVisualReceiptsV2Service } from '../src/services/ZavorthVisualReceiptsV2Service.js';

const args = process.argv.slice(2);
const service = new ZavorthVisualReceiptsV2Service();
const snapshot = service.buildSnapshot({
  includeAdvanced: args.includes('--advanced'),
  includeAdvancedStory: args.includes('--advanced-story') || args.includes('--advanced'),
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
