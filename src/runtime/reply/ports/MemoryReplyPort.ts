import type { UniversalReplyPacket } from '../../agent/UniversalAgentRuntimeTypes.js';

export type MemoryReplyDelivery = UniversalReplyPacket & {
  deliveredAt: string;
};

export class MemoryReplyPort {
  private readonly deliveries: MemoryReplyDelivery[] = [];
  private readonly now: () => Date;

  constructor(input: { now?: () => Date } = {}) {
    this.now = input.now || (() => new Date());
  }

  public async send(packet: UniversalReplyPacket): Promise<MemoryReplyDelivery> {
    const delivery = {
      ...packet,
      deliveredAt: this.now().toISOString(),
    };
    this.deliveries.push(delivery);
    return delivery;
  }

  public async sendAll(packets: UniversalReplyPacket[]): Promise<MemoryReplyDelivery[]> {
    const deliveries: MemoryReplyDelivery[] = [];
    for (const packet of packets) {
      deliveries.push(await this.send(packet));
    }
    return deliveries;
  }

  public list(): MemoryReplyDelivery[] {
    return this.deliveries.slice();
  }

  public clear(): void {
    this.deliveries.splice(0, this.deliveries.length);
  }
}
