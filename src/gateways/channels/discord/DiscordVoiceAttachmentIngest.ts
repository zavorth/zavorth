/**
 * Discord voice/audio attachments → shared messaging voice ingest.
 */

import type { MessageAttachment } from '../../../contracts/IMessageBroker.js';
import type { AudioTranscriptionService } from '../../../services/AudioTranscriptionService.js';
import {
  ingestMessagingVoiceAttachments,
  isMessagingAudioAttachment,
  mergeMessagingVoiceText,
  type MessagingVoiceIngestResult,
} from '../../../services/voice/MessagingChannelVoiceIngest.js';

export function isDiscordAudioAttachment(attachment: MessageAttachment): boolean {
  return isMessagingAudioAttachment(attachment);
}

export type DiscordVoiceIngestResult = MessagingVoiceIngestResult;

export async function ingestDiscordVoiceAttachments(input: {
  attachments: MessageAttachment[];
  userId?: string;
  stt?: AudioTranscriptionService;
}): Promise<DiscordVoiceIngestResult> {
  return ingestMessagingVoiceAttachments({
    attachments: input.attachments,
    surface: 'discord',
    userId: input.userId,
    stt: input.stt,
  });
}

export function mergeDiscordVoiceText(
  content: string,
  voice: DiscordVoiceIngestResult,
): string {
  return mergeMessagingVoiceText(content, voice);
}
