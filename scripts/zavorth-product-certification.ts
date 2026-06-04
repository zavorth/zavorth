import { ZavorthProductCertificationService } from '../src/services/ZavorthProductCertificationService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const strict = args.includes('--strict') || args.includes('--require-pass');
const requireLive = args.includes('--require-live');
const deep = args.includes('--deep');

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

async function main(): Promise<void> {
  const service = new ZavorthProductCertificationService({
    includeDeepProductCheck: deep,
  });
  const snapshot = await service.buildSnapshot();

  if (json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }

  if (snapshot.status === 'blocked') {
    process.exitCode = 1;
    return;
  }
  if (strict && snapshot.status !== 'ready') {
    process.exitCode = 1;
    return;
  }
  if (requireLive && snapshot.summary.liveCredentialGated > 0) {
    process.exitCode = 2;
  }
}
