export { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions, type WebhookGatewayStatusSnapshot } from './WebhookGateway.js';
export { ChannelGatewayRegistry } from './ChannelGatewayRegistry.js';
export { ChannelGatewayFactory } from './ChannelGatewayFactory.js';
export { ChannelGatewayBridge } from './ChannelGatewayBridge.js';
// Channel-specific exports (unified from src/gateways/channels/)
export * from './channels/index.js';
