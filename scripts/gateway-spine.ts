import { GatewayChannelRegistryService } from '../src/services/GatewayChannelRegistryService.js';
import { GatewaySpineService } from '../src/services/GatewaySpineService.js';

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const gatewayRuntimeSnapshot = {
  lifecycle: {
    status: 'attached',
  },
  route: 'gateway-runtime',
  sessions: [],
};
const channelRegistry = new GatewayChannelRegistryService({
  hasDispatcher: true,
  canSpawnWeb: true,
});
const service = new GatewaySpineService({
  channelRegistry,
  now: () => new Date(),
});

const snapshot = service.buildSnapshot({
  gatewayRuntimeSnapshot,
  approvals: {
    source: 'GatewayApprovalPlane',
    total: 0,
    pending: 0,
  },
  receipts: {
    source: 'GatewayReceiptPlane',
    total: 0,
    pending: 0,
  },
  artifacts: {
    source: 'GatewayArtifactPlane',
    total: 0,
    pending: 0,
  },
});

process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
