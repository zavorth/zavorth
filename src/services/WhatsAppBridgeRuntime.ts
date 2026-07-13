import { WhatsAppBridgeSupervisorService } from './WhatsAppBridgeSupervisorService.js';
import { WhatsAppBridgeInboundPollerService } from './WhatsAppBridgeInboundPollerService.js';
import type { WhatsAppGateway } from '../gateways/channels/whatsapp/WhatsAppGateway.js';

let supervisor: WhatsAppBridgeSupervisorService | null = null;
let poller: WhatsAppBridgeInboundPollerService | null = null;

export function getWhatsAppBridgeSupervisor(projectRoot?: string): WhatsAppBridgeSupervisorService {
  if (!supervisor) {
    supervisor = new WhatsAppBridgeSupervisorService({ projectRoot: projectRoot || process.cwd() });
  }
  return supervisor;
}

export function getWhatsAppBridgeInboundPoller(options?: {
  projectRoot?: string;
  gateway?: Pick<WhatsAppGateway, 'onMessageReceived' | 'handleWebhookEvent'> | null;
  onMessage?: ((message: Record<string, unknown>) => Promise<boolean> | boolean) | null;
  bridgeUrl?: string | null;
}): WhatsAppBridgeInboundPollerService {
  if (!poller) {
    const bridgeUrl = options?.bridgeUrl || getWhatsAppBridgeSupervisor(options?.projectRoot).bridgeUrl;
    poller = new WhatsAppBridgeInboundPollerService({
      bridgeUrl,
      gateway: options?.gateway || null,
      onMessage: options?.onMessage || null,
    });
  } else if (options?.gateway || options?.onMessage) {
    poller = new WhatsAppBridgeInboundPollerService({
      bridgeUrl: options.bridgeUrl || poller.snapshot().bridgeUrl,
      gateway: options.gateway || null,
      onMessage: options.onMessage || null,
    });
  }
  return poller;
}

export function resetWhatsAppBridgeRuntimeForTests(): void {
  supervisor = null;
  poller = null;
}
