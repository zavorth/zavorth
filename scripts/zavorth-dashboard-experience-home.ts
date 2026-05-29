import { ZavorthControlExperienceHomeService } from '../src/services/ZavorthControlExperienceHomeService.js';

const args = process.argv.slice(2);
const service = new ZavorthControlExperienceHomeService();
const snapshot = service.buildSnapshot();

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
