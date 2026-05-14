import { chunkDiscordMessage } from '../DiscordGatewayMessageHelpers.js';
import type {
  DiscordGatewayInteractionLike,
  DiscordGatewayMessageLike,
} from '../DiscordGatewayTypes.js';
import { DiscordGatewayPersistence } from './DiscordGatewayPersistence.js';

type DiscordGatewayReplyServiceOptions = {
  persistence: DiscordGatewayPersistence;
};

export type DiscordGatewayReplyOptions = {
  allowedMentions?: { parse: string[] };
  components?: unknown[];
};

type DiscordGatewayReplyPayload = {
  content: string;
  allowedMentions: { parse: string[] };
  components?: unknown[];
};

export class DiscordGatewayReplyService {
  private readonly persistence: DiscordGatewayPersistence;

  constructor(options: DiscordGatewayReplyServiceOptions) {
    this.persistence = options.persistence;
  }

  public async replyToMessage(
    message: DiscordGatewayMessageLike,
    text: string,
    options: DiscordGatewayReplyOptions = {},
  ): Promise<void> {
    const chunks = chunkDiscordMessage(text);
    for (const [index, chunk] of chunks.entries()) {
      const payload = this.buildReplyPayload(chunk, options, index);
      if (message.reply) {
        await message.reply(payload);
      } else if (message.channel?.send) {
        await message.channel.send(payload);
      }
    }

    this.persistence.markOutbound();
  }

  public async editChannelMessage(
    message: DiscordGatewayMessageLike,
    messageId: string,
    text: string,
  ): Promise<void> {
    const editor = message.channel?.messages?.fetch;
    if (!editor) {
      return;
    }

    const target = await editor(String(messageId || '').trim());
    if (!target?.edit) {
      return;
    }

    await target.edit({
      content: chunkDiscordMessage(text)[0] || '',
      allowedMentions: { parse: [] },
    });
    this.persistence.markOutbound();
  }

  public async replyToInteraction(
    interaction: DiscordGatewayInteractionLike,
    text: string,
    options: DiscordGatewayReplyOptions = {},
  ): Promise<void> {
    const chunks = chunkDiscordMessage(text);
    for (const [index, chunk] of chunks.entries()) {
      const payload = this.buildReplyPayload(chunk, options, index);
      if (!interaction.replied && !interaction.deferred && interaction.reply) {
        await interaction.reply(payload);
        interaction.replied = true;
      } else if (interaction.followUp) {
        await interaction.followUp(payload);
      } else if (interaction.channel?.send) {
        await interaction.channel.send(payload);
      }
    }

    this.persistence.markOutbound();
  }

  public async editInteractionReply(interaction: DiscordGatewayInteractionLike, text: string): Promise<void> {
    if (!interaction.editReply) {
      return;
    }

    await interaction.editReply({
      content: chunkDiscordMessage(text)[0] || '',
      allowedMentions: { parse: [] },
    });
    this.persistence.markOutbound();
  }

  private buildReplyPayload(
    content: string,
    options: DiscordGatewayReplyOptions,
    chunkIndex: number,
  ): DiscordGatewayReplyPayload {
    const components = Array.isArray(options.components) && options.components.length > 0 && chunkIndex === 0
      ? options.components
      : undefined;
    return {
      content,
      allowedMentions: options.allowedMentions || { parse: [] },
      ...(components ? { components } : {}),
    };
  }
}
