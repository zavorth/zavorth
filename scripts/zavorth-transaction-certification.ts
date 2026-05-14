import { ZavorthTransactionCertificationService } from '../src/services/ZavorthTransactionCertificationService.js';

type CliOptions = {
  json: boolean;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthTransactionCertificationService({
  ledgerFile: options.ledgerFile,
  credentialStoreFile: options.credentialStoreFile,
});

const report = service.certify();

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(service.renderReport(report));
}

process.exit(report.status === 'passed' ? 0 : 1);

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--ledger-file') {
      options.ledgerFile = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--ledger-file=')) {
      options.ledgerFile = arg.slice('--ledger-file='.length);
    } else if (arg === '--credential-store-file') {
      options.credentialStoreFile = args[index + 1];
      index += 1;
    } else if (arg?.startsWith('--credential-store-file=')) {
      options.credentialStoreFile = arg.slice('--credential-store-file='.length);
    }
  }

  return options;
}
