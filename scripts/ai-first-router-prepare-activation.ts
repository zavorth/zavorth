import { AiFirstActivationPreparationService } from '../src/services/AiFirstActivationPreparationService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const service = new AiFirstActivationPreparationService({
  outputDir: readArg('--output-dir') || undefined,
});

const result = service.prepare({
  ownerApprovalId: readArg('--owner-approval-id'),
  outputPath: readArg('--output'),
  write: !args.includes('--no-write'),
});

if (asJson) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderText(result)}\n`);
}

if (requirePass && result.status !== 'ready') {
  process.exitCode = 1;
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1] || null;
  }
  return null;
}
