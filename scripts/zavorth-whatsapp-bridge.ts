import { WhatsAppBridgeSupervisorService } from '../src/services/WhatsAppBridgeSupervisorService.js';
import { WhatsAppBridgeInboundPollerService } from '../src/services/WhatsAppBridgeInboundPollerService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const command = args.find((arg) => !arg.startsWith('--')) || 'status';

let activePoller: WhatsAppBridgeInboundPollerService | null = null;

async function main(): Promise<void> {
  const service = new WhatsAppBridgeSupervisorService({ projectRoot: process.cwd() });

  if (command === 'poll' || command === 'poll-once') {
    const poller = new WhatsAppBridgeInboundPollerService({
      bridgeUrl: service.bridgeUrl,
      onMessage: async (message) => {
        const text = String(message.text || message.body || '').trim();
        const from = String(message.from || message.sender || '').trim();
        if (!json) {
          console.log(`[inbound] from=${from || '-'} text=${text.slice(0, 160)}`);
        }
        return Boolean(text);
      },
    });
    if (command === 'poll-once') {
      const result = await poller.pollOnce();
      const snapshot = { ...poller.snapshot(), lastResult: result };
      if (json) console.log(JSON.stringify(snapshot, null, 2));
      else console.log(`poll-once messages=${result.messages} accepted=${result.accepted}`);
      return;
    }
    activePoller = poller;
    poller.start();
    if (!json) {
      console.log(`Polling ${service.bridgeUrl}/messages (Ctrl+C to stop)`);
    }
    const shutdown = async () => {
      await poller.stop();
      if (json) console.log(JSON.stringify(poller.snapshot(), null, 2));
      process.exit(0);
    };
    process.on('SIGINT', () => { void shutdown(); });
    process.on('SIGTERM', () => { void shutdown(); });
    await new Promise(() => undefined);
    return;
  }

  let snapshot;
  if (command === 'start') {
    snapshot = await service.start({ pairOnly: args.includes('--pair-only') });
    if (args.includes('--with-poll')) {
      activePoller = new WhatsAppBridgeInboundPollerService({
        bridgeUrl: service.bridgeUrl,
        onMessage: async (message) => {
          const text = String(message.text || '').trim();
          if (text && !json) console.log(`[inbound] ${String(message.from || '')}: ${text.slice(0, 120)}`);
          return Boolean(text);
        },
      });
      activePoller.start();
    }
  } else if (command === 'stop') {
    if (activePoller) await activePoller.stop();
    snapshot = await service.stop();
  } else if (command === 'pair') {
    snapshot = await service.start({ pairOnly: true });
  } else {
    snapshot = await service.status();
  }

  if (json) {
    console.log(JSON.stringify({
      bridge: snapshot,
      poller: activePoller?.snapshot() || null,
    }, null, 2));
    return;
  }

  console.log(`WhatsApp Baileys bridge (${snapshot.tier} ${snapshot.productionClaim})`);
  console.log(`desired=${snapshot.desired} running=${snapshot.process.running} pid=${snapshot.process.pid || '-'}`);
  console.log(`health=${snapshot.health.ok ? 'ok' : 'down'} connection=${snapshot.health.connection || '-'}`);
  console.log(`bridgeUrl=${snapshot.bridgeUrl}`);
  console.log(`packageReady=${snapshot.packageReady}`);
  if (snapshot.process.lastError) console.log(`lastError=${snapshot.process.lastError}`);
  if (snapshot.nextStep) console.log(`next=${snapshot.nextStep}`);
  if (activePoller) {
    const poll = activePoller.snapshot();
    console.log(`poller running=${poll.running} messages=${poll.stats.messages} errors=${poll.stats.errors}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
