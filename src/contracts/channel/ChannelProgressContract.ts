import type { CanonicalChannelPlatform } from '../../channels/contracts/ChannelMessageContract.js';

export type ChannelProgressStage =
  | 'accepted'
  | 'planning'
  | 'tool_started'
  | 'tool_progress'
  | 'integration_auth_link'
  | 'approval_waiting'
  | 'tool_completed'
  | 'final'
  | 'failed'
  | 'cancelled';

export type ChannelProgressTransport = 'edit' | 'send' | 'draft' | 'off';

export type ChannelProgressCapability = {
  channel: CanonicalChannelPlatform;
  canSend: boolean;
  canEdit: boolean;
  canDraft: boolean;
  throttleMs: number;
  maxTextLength: number;
  summary: string;
};

export type ChannelProgressEvent = {
  runId: string;
  channel: CanonicalChannelPlatform;
  chatId: string;
  messageId?: string | number | null;
  stage: ChannelProgressStage;
  title?: string | null;
  detail?: string | null;
  toolName?: string | null;
  actionId?: string | null;
  integrationId?: string | null;
  link?: string | null;
  finalText?: string | null;
  createdAt?: string | null;
};

export type ChannelProgressSession = {
  runId: string;
  channel: CanonicalChannelPlatform;
  chatId: string;
  anchorMessageId: string | number | null;
  transport: ChannelProgressTransport;
  startedAt: string;
  updatedAt: string;
  stage: ChannelProgressStage;
  lastText: string;
  lastError: string | null;
};

export type ChannelProgressReceipt = {
  id: string;
  runId: string;
  channel: CanonicalChannelPlatform;
  chatId: string;
  transport: ChannelProgressTransport;
  stage: ChannelProgressStage;
  status: 'sent' | 'edited' | 'skipped' | 'failed';
  createdAt: string;
  messageId: string | number | null;
  summary: string;
  safety: {
    secretsRedacted: true;
    progressNotTranscript: true;
    outboundPolicyRequired: true;
  };
  error?: string | null;
};

export type ChannelProgressSnapshot = {
  contractVersion: 'channel-progress-surface/1';
  generatedAt: string;
  capabilities: ChannelProgressCapability[];
  sessions: ChannelProgressSession[];
  receipts: ChannelProgressReceipt[];
};
