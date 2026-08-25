export * from '../gateways/channels/slack/SlackChannelAdapter.js';
export * from '../gateways/channels/whatsapp/WhatsAppChannelAdapter.js';
export * from '../gateways/channels/signal/SignalChannelAdapter.js';
export * from '../gateways/channels/imessage/IMessageMacBridgeAdapter.js';
export * from '../gateways/channels/teams/TeamsChannelAdapter.js';
export * from '../gateways/channels/email/EmailChannelAdapter.js';
export * from './contracts/ChannelMessageContract.js';
export * from './policies/ChannelPolicyManager.js';
export * from './policies/AuthorizedChatRegistry.js';
export * from './commands/ChannelCommandCatalog.js';
export * from './commands/ChannelCommandParser.js';
export * from './commands/ExternalExecutorIdentity.js';
export {
  channelIdsEqual,
  listChannelIdAliases,
  normalizeChannelId,
} from './normalizeChannelId.js';
