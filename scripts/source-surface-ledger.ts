import { SourceSurfaceLedgerService } from '../src/services/SourceSurfaceLedgerService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const ledgerPath = readArg('--ledger');
const sourceRoot = readArg('--source-root');

const service = new SourceSurfaceLedgerService();
const receipt = service.buildReceipt({
  ledgerPath: ledgerPath || undefined,
  sourceRoot: sourceRoot || undefined,
});

if (asJson) {
  console.log(JSON.stringify(receipt, null, 2));
} else {
  console.log(service.formatReceiptText(receipt));
}

if (requirePass && receipt.status !== 'passed') {
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
