import { ZavorthCapabilitySetupExecutorApiService } from '../src/services/ZavorthCapabilitySetupExecutorApiService.js';

const args = process.argv.slice(2);
const api = new ZavorthCapabilitySetupExecutorApiService();
const asJson = args.includes('--json');

try {
  const ticketId = readOption('--ticket') || readOption('--ticket-id');
  if (ticketId) {
    const result = api.execute({
      ticketId,
      actorLabel: readOption('--actor'),
      ownerApprovalId: readOption('--owner-approval-id') || readOption('--approval-id'),
      confirmOwnerControlledActivation: args.includes('--confirm-owner-controlled-activation') || args.includes('--execute'),
      dryRun: !args.includes('--execute'),
    });
    print(result);
  } else if (asJson) {
    print(api.listRequests(readNumber('--limit') || 20));
  } else {
    console.log(api.renderReport(readNumber('--limit') || 20));
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (asJson) {
    console.log(JSON.stringify({ status: 'failed', error: message }, null, 2));
  } else {
    console.error(`[capability-setup-executor] ${message}`);
  }
  process.exitCode = 1;
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function readOption(name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return value;
}

function readNumber(name: string): number | null {
  const value = Number(readOption(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

