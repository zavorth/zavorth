import type { CapabilityConsoleView } from '../src/contracts/CapabilityConsoleContract.js';
import type { CapabilityNaturalOperatorResult } from '../src/contracts/CapabilityNaturalOperatorContract.js';
import type { CapabilityPackCategory } from '../src/contracts/CapabilityPackCatalogContract.js';
import type { CapabilitySetupQueueTicketStatus } from '../src/contracts/CapabilitySetupQueueContract.js';
import { ZavorthCapabilityConsoleApiService } from '../src/services/ZavorthCapabilityConsoleApiService.js';
import { ZavorthCapabilityNaturalOperatorApiService } from '../src/services/ZavorthCapabilityNaturalOperatorApiService.js';

const args = process.argv.slice(2);
const api = new ZavorthCapabilityConsoleApiService();
const naturalApi = new ZavorthCapabilityNaturalOperatorApiService();
const asJson = args.includes('--json');
const askText = readOption('--ask') || readOption('--text') || readOption('--prompt');
const input = {
  view: (readOption('--view') || 'overview') as CapabilityConsoleView,
  query: readOption('--query') || readOption('--search'),
  packId: readOption('--pack') || readOption('--pack-id'),
  targetItemId: readOption('--target') || readOption('--capability'),
  category: readOption('--category') as CapabilityPackCategory | null,
  status: readOption('--status') as CapabilitySetupQueueTicketStatus | 'open' | 'closed' | null,
  limit: readNumber('--limit'),
  includeItems: !args.includes('--no-items'),
  includeReadiness: !args.includes('--no-readiness'),
  availableSecretRefs: readOptions('--secret-ref'),
  availableEnvKeys: readOptions('--env-key'),
  availableBinaries: readOptions('--binary'),
  completedManualSteps: readOptions('--manual-step'),
  completedReadinessChecks: readOptions('--readiness-check'),
  localRoutes: readRoutes(),
};

if (askText) {
  const result = naturalApi.execute({
    text: askText,
    actorLabel: readOption('--actor'),
    packId: input.packId,
    targetItemId: input.targetItemId,
    ticketId: readOption('--ticket') || readOption('--ticket-id'),
    ownerApprovalId: readOption('--owner-approval-id') || readOption('--approval-id'),
    confirmOwnerControlledActivation: args.includes('--confirm-owner-controlled-activation') || args.includes('--execute'),
    execute: args.includes('--execute'),
    createTicket: args.includes('--no-create-ticket') ? false : undefined,
    availableSecretRefs: input.availableSecretRefs,
    availableEnvKeys: input.availableEnvKeys,
    availableBinaries: input.availableBinaries,
    completedManualSteps: input.completedManualSteps,
    completedReadinessChecks: input.completedReadinessChecks,
    localRoutes: input.localRoutes,
  });
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderNaturalResult(result));
  }
} else {
  const snapshot = api.buildSnapshot(input);
  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(api.renderConsole(input));
  }
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

function readNumber(name: string): number | null {
  const value = Number(readOption(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
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

function renderNaturalResult(result: CapabilityNaturalOperatorResult): string {
  const lines = [
    result.reply.headline,
    '',
    result.reply.body,
    '',
    result.reply.nextAction,
    '',
    `Decisao: ${result.decision.action} | alvo: ${result.decision.targetItemId || 'nao definido'} | pack: ${result.decision.packId || 'nao definido'}`,
  ];
  if (result.createdTicket) {
    lines.push(`Ticket: ${result.createdTicket.id} (${result.createdTicket.status})`);
  }
  if (result.executorResult) {
    lines.push(`Executor: ${result.executorResult.status}`);
  }
  lines.push('Seguranca: sem segredo bruto, sem ativacao live por linguagem natural.');
  return lines.join('\n');
}
