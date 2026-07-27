import type fs from 'fs';
import type { PlatformCapability } from '../../../contracts/PlatformContract.js';

export type ChannelSetupChannelId =
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'whatsapp'
  | 'instagram'
  | 'signal'
  | 'imessage'
  | 'teams'
  | 'email';

export type ChannelSetupMode =
  | 'native'
  | 'bridge'
  | 'local'
  | 'local-outbox'
  | 'cloud-api'
  | 'baileys'
  | 'meta-messaging'
  | 'signal-cli'
  | 'mac-bridge'
  | 'graph-bot'
  | 'smtp-imap';

export type ChannelSetupCapabilityDescriptor = {
  describe: (channelId: ChannelSetupChannelId) => PlatformCapability;
};

export type ChannelSetupCatalogEntry = {
  channelId: ChannelSetupChannelId;
  label: string;
  status: 'ready' | 'prepared' | 'needs-config';
  configured: boolean;
  currentMode: string;
  recommendedMode: ChannelSetupMode;
  summary: string;
  setupCommand: string;
  doctorCommand: string;
  docsPath: string;
  webhookPath: string | null;
  envKeys: string[];
  requiredEnvKeys: string[];
  optionalEnvKeys: string[];
  notes: string[];
};

export type ChannelSetupCatalogReport = {
  generatedAt: string;
  command: string;
  summary: string;
  entries: ChannelSetupCatalogEntry[];
};

export type ChannelSetupApplyInput = {
  channelId: ChannelSetupChannelId;
  mode: ChannelSetupMode;
  values?: Record<string, string | undefined>;
};

export type ChannelSetupApplyResult = {
  channelId: ChannelSetupChannelId;
  mode: ChannelSetupMode;
  summary: string;
  envKeysWritten: string[];
  filesTouched: string[];
  nextSteps: string[];
};

export type ChannelSetupGuideRuntime = {
  envFilePath?: string;
  projectRoot?: string;
  now?: () => Date;
  capabilityService?: ChannelSetupCapabilityDescriptor;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};
