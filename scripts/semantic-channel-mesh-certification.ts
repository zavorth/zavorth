import { ZavorthSemanticChannelMeshCertificationService } from '../src/services/ZavorthSemanticChannelMeshCertificationService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const sourceRoot = readArg('--source-root');
const zavorthRoot = readArg('--zavorth-root');

const service = new ZavorthSemanticChannelMeshCertificationService();
const snapshot = service.buildSnapshot({
  sourceRoot,
  zavorthRoot,
});

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatSnapshotText(snapshot));
}

if (requirePass && snapshot.status !== 'passed') {
  process.exitCode = 1;
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}
