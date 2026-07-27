import { ZavorthChannelDeepeningService } from '../src/services/ZavorthChannelDeepeningService.js';

async function main() {
  const asJson = process.argv.includes('--json');
  const requirePass = process.argv.includes('--require-pass');
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const service = new ZavorthChannelDeepeningService();
  const snapshot = service.buildSnapshot();
  const first = String(positional[0] || '').trim().toLowerCase();
  const action = String(positional[1] || 'inspect').trim().toLowerCase();

  if (first && !['catalog', 'list', 'all', 'inventory', 'status', 'coverage', 'deepening'].includes(first)) {
    const item = snapshot.items.find((entry) =>
      entry.id === first || entry.aliases.map((alias) => alias.toLowerCase()).includes(first));
    if (!item) {
      const message = [
        `Unknown channel: ${first}`,
        '',
        `Known channels: ${snapshot.items.map((entry) => entry.id).join(', ')}`,
      ].join('\n');
      if (asJson) {
        console.log(JSON.stringify({ status: 'failed', error: message }, null, 2));
      } else {
        console.error(message);
      }
      process.exitCode = 1;
      return;
    }

    if (asJson) {
      console.log(JSON.stringify({ ...item, requestedAction: action }, null, 2));
    } else {
      console.log(formatChannelAction(item, action));
    }
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (requirePass && snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function formatChannelAction(
  item: ReturnType<ZavorthChannelDeepeningService['buildSnapshot']>['items'][number],
  action: string,
): string {
  const normalizedAction = normalizeAction(action);
  const commands = [
    `setup: ${item.commands.setup}`,
    `doctor: ${item.commands.doctor}`,
    `pairing: ${item.commands.pairing}`,
    `proof: ${item.commands.liveProof}`,
    item.commands.safeOutbox ? `outbox: ${item.commands.safeOutbox}` : null,
  ].filter(Boolean);
  const actionGuidance = guidanceForAction(item, normalizedAction);
  return [
    `Zavorth Channel - ${item.label}`,
    '',
    `Status: ${item.status}`,
    `Risk: ${item.risk}`,
    `Family: ${item.family}`,
    `Requested action: ${normalizedAction}`,
    '',
    actionGuidance,
    '',
    'Capabilities:',
    `- read: ${yesNo(item.capabilities.read)}`,
    `- send: ${yesNo(item.capabilities.send)}`,
    `- pairing: ${yesNo(item.capabilities.pairing)}`,
    `- safe outbox: ${yesNo(item.capabilities.safeOutbox)}`,
    `- attachments: ${yesNo(item.capabilities.attachments)}`,
    `- threads: ${yesNo(item.capabilities.threads)}`,
    `- QR: ${yesNo(item.capabilities.qr)}`,
    '',
    'Configuration:',
    `- required env: ${item.configuration.requiredEnvKeys.join(', ') || 'none'}`,
    `- missing env: ${item.configuration.missingRequiredEnvKeys.join(', ') || 'none'}`,
    `- allowlist env: ${item.configuration.allowlistEnvKeys.join(', ') || 'none'}`,
    `- allowlist configured: ${yesNo(item.configuration.allowlistConfigured)}`,
    '',
    'Commands:',
    ...commands.map((line) => `- ${line}`),
    '',
    `Next safe action: ${item.nextAction}`,
    `Default route: ${item.safeDefaultRoute ? 'allowed' : `blocked ? ${item.defaultBlockReason}`}`,
  ].join('\n');
}

function normalizeAction(action: string): string {
  if (action === 'pair' || action === 'allowlist') return 'pairing';
  if (action === 'health') return 'doctor';
  if (action === 'send-test' || action === 'test') return 'proof';
  return action || 'inspect';
}

function guidanceForAction(
  item: ReturnType<ZavorthChannelDeepeningService['buildSnapshot']>['items'][number],
  action: string,
): string {
  if (action === 'setup') {
    return `Setup prepares ${item.label} without sending live traffic. It should capture credentials through secret fields, then keep recipients behind allowlists.`;
  }
  if (action === 'doctor') {
    return `Doctor checks config, allowlists, bridge posture and proof receipts. It must not serialize secrets or send live messages.`;
  }
  if (action === 'pairing') {
    return `Pairing binds trusted users, chats, rooms or recipients before ${item.label} can reach tools. Unknown senders stay blocked.`;
  }
  if (action === 'proof') {
    return `Live proof is allowed only after credentials and allowlists are present. Proof must leave a redacted receipt before default routing is enabled.`;
  }
  if (action === 'outbox') {
    return item.commands.safeOutbox ? `Safe outbox stores governed drafts locally at data/channel-outbox/${item.id} instead of pretending a live message was delivered.`
      : `${item.label} is internal and does not use an external outbox.`;
  }
  if (action === 'send' || action === 'read') {
    if (item.safeDefaultRoute) {
      return `${item.label} can route live only through policy, receipts and rate limits.`;
    }
    return `${item.label} is not live-ready. Use setup, pairing and proof first; outbound work must use safe outbox or stay blocked.`;
  }
    return `${item.label} is represented by the all-channel readiness contract. Catalog support is not live proof.`;
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}
