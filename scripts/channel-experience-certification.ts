import { ChannelExperienceCertificationService } from '../src/services/ChannelExperienceCertificationService.js';

const args = new Set(process.argv.slice(2));
const selectedArg = process.argv.slice(2).find((arg) => arg.startsWith('--channel='));
const selectedId = selectedArg ? selectedArg.slice('--channel='.length) : null;

const service = new ChannelExperienceCertificationService();
const snapshot = service.buildSnapshot({ selectedId });

if (args.has('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderReport({ selectedId })}\n`);
}

if (args.has('--require-pass') && !snapshot.summary.releaseReady) {
  process.stderr.write(
    `Channel experience certification blocked: ${snapshot.summary.blockers} blocker(s).\n`,
  );
  process.exitCode = 1;
}
