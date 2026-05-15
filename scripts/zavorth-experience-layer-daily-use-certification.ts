import { ZavorthExperienceLayerDailyUseCertificationService } from '../src/services/ZavorthExperienceLayerDailyUseCertificationService.js';

const args = process.argv.slice(2);
const service = new ZavorthExperienceLayerDailyUseCertificationService();
const snapshot = service.buildSnapshot();

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
