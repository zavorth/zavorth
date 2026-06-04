import { ZavorthCapabilityActionSurfaceService } from '../src/services/ZavorthCapabilityActionSurfaceService.js';

const args = new Set(process.argv.slice(2));
const service = new ZavorthCapabilityActionSurfaceService({
  projectRoot: process.cwd(),
  env: process.env,
});
const snapshot = service.buildSnapshot();

if (args.has('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderText(snapshot)}\n`);
}
