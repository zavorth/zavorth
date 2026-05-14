import { ZavorthVisualReceiptUxService } from '../src/services/ZavorthVisualReceiptUxService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const service = new ZavorthVisualReceiptUxService();
const snapshot = service.buildSnapshot({
  includeAdvanced: args.includes('--advanced'),
});

process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
