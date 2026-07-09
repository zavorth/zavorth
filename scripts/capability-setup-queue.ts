import type {
  CapabilitySetupAudience,
} from '../src/contracts/CapabilitySetupConversationContract.js';
import type {
  CapabilitySetupQueueUpdateInput,
  CapabilitySetupQueueTicketStatus,
} from '../src/contracts/CapabilitySetupQueueContract.js';
import { ZavorthCapabilitySetupQueueApiService } from '../src/services/ZavorthCapabilitySetupQueueApiService.js';
import { asErrorLike } from '../src/utils/errorLike';

const args = process.argv.slice(2);
const api = new ZavorthCapabilitySetupQueueApiService();
const asJson = args.includes('--json');

try {
  if (args.includes('--create')) {
    const ticket = api.createTicket({
      ticketId: readOption('--ticket-id'),
      text: readOption('--text') || readOption('--prompt'),
      targetItemId: readOption('--target') || readOption('--capability'),
      packId: readOption('--pack') || readOption('--pack-id'),
      actorLabel: readOption('--actor'),
      approvalId: readOption('--approval-id'),
      audience: (readOption('--audience') || 'everyday') as CapabilitySetupAudience,
      priority: (readOption('--priority') || 'normal') as 'low' | 'normal' | 'high',
      availableSecretRefs: readOptions('--secret-ref'),
      availableEnvKeys: readOptions('--env-key'),
      availableBinaries: readOptions('--binary'),
      completedManualSteps: readOptions('--manual-step'),
      completedReadinessChecks: readOptions('--readiness-check'),
      localRoutes: readRoutes(),
    });
    print(ticket);
  } else if (readOption('--update')) {
    const ticket = api.updateTicket({
      ticketId: readOption('--update') || '',
      action: (readOption('--action') || 'refresh') as CapabilitySetupQueueUpdateInput['action'],
      actorLabel: readOption('--actor'),
      reason: readOption('--reason'),
      secretRef: readOption('--secret-ref'),
      manualStep: readOption('--manual-step'),
      readinessCheck: readOption('--readiness-check'),
      approvalId: readOption('--approval-id'),
    });
    print(ticket);
  } else if (readOption('--show')) {
    const ticket = api.getTicket(readOption('--show') || '');
    print(ticket || { error: 'ticket not found' });
  } else {
    const status = readOption('--status') as CapabilitySetupQueueTicketStatus | 'open' | 'closed' | null;
    const snapshot = api.listTickets({ status: status || undefined });
    if (asJson) {
      print(snapshot);
    } else {
      console.log(api.renderReport({ status: status || undefined }));
    }
  }
} catch (error: unknown) {
  const err = asErrorLike(error);
  const message = error instanceof Error ? error.message : String(error);
  if (asJson) {
    console.log(JSON.stringify({ status: 'failed', error: message }, null, 2));
  } else {
    console.error(`[capability-setup-queue] ${message}`);
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

function readOptions(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) {
      continue;
    }
    const value = args[index + 1];
    if (value && !value.startsWith('--')) {
      values.push(value);
    }
  }
  return values;
}

function readRoutes(): Record<string, boolean> {
  const routes: Record<string, boolean> = {};
  for (const value of readOptions('--local-route')) {
    const [id, state] = value.split('=');
    if (id) {
      routes[id] = state ? state === 'true' || state === '1' || state === 'ok' : true;
    }
  }
  return routes;
}
