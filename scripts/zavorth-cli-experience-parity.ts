import { ZavorthCliExperienceParityService } from '../src/services/ZavorthCliExperienceParityService.js';

const args = process.argv.slice(2);
const service = new ZavorthCliExperienceParityService();
const snapshot = service.buildSnapshot();

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
