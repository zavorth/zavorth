import type { UniversalReplyPacket } from '../../agent/UniversalAgentRuntimeTypes.js';

export type TelegramReplySender = {
  reply(text: string, options?: Record<string, unknown>): Promise<unknown> | unknown;
};

export type TelegramReplyDelivery = {
  packet: UniversalReplyPacket;
  sent: boolean;
  result?: unknown;
  skippedReason?: string;
};

export class TelegramReplyPortAdapter {
  constructor(private readonly sender: TelegramReplySender) {}

  public async send(packet: UniversalReplyPacket): Promise<TelegramReplyDelivery> {
    if (packet.port.kind !== 'telegram') {
      return {
        packet,
        sent: false,
        skippedReason: `Port ${packet.port.kind} is not Telegram.`,
      };
    }

    const result = await this.sender.reply(packet.text);
    return {
      packet,
      sent: true,
      result,
    };
  }

  public async sendAll(packets: UniversalReplyPacket[]): Promise<TelegramReplyDelivery[]> {
    const deliveries: TelegramReplyDelivery[] = [];
    for (const packet of packets) {
      deliveries.push(await this.send(packet));
    }
    return deliveries;
  }
}
