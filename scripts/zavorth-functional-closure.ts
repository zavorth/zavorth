import { ZavorthFunctionalClosureService } from '../src/services/ZavorthFunctionalClosureService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const releaseGateOnly = args.includes('--release-gate');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthFunctionalClosureService();
  const snapshot = await service.buildSnapshot();
  const output = releaseGateOnly ? snapshot.releaseGate : snapshot;

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else if (releaseGateOnly) {
    console.log(`Zavorth Functional Release Gate: ${snapshot.releaseGate.status}`);
    console.log(`Release allowed: ${snapshot.releaseGate.releaseAllowed}`);
    console.log(`P0 closed: ${snapshot.releaseGate.p0.closed}/${snapshot.releaseGate.p0.total}`);
    console.log(`P1 closed: ${snapshot.releaseGate.p1.closed}/${snapshot.releaseGate.p1.total}`);
    console.log(`P2 closed: ${snapshot.releaseGate.p2.closed}/${snapshot.releaseGate.p2.total}`);
    for (const blocker of snapshot.releaseGate.blockers) {
      console.log(`- ${blocker}`);
    }
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}
