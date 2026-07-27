import type {
  ChannelRuntimeAction,
  ChannelRuntimeId,
  ChannelRuntimeMessage,
  ChannelRuntimeReceipt,
  ChannelSimulatorSnapshot,
} from '../contracts/SourceChannelMeshExpansionContract.js';

type Runtime = {
  now?: () => Date;
};

type MessageInput = {
  senderId?: string;
  recipientId?: string;
  text?: string;
  threadId?: string | null;
};

export class SourceChannelSimulatorService {
  private readonly now: () => Date;
  private sequence = 0;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public runScenario(channelId: ChannelRuntimeId = 'slack'): ChannelSimulatorSnapshot {
    this.sequence = 0;
    const messages: ChannelRuntimeMessage[] = [];
    const receipts: ChannelRuntimeReceipt[] = [];
    const root = this.send(channelId, messages, receipts, {
      senderId: 'operator',
      recipientId: 'channel-alpha',
      text: 'Connector registry simulator root message',
    });
    this.receive(channelId, messages, receipts, {
      senderId: 'user-a',
      recipientId: 'zavorth',
      text: 'Inbound normalized message',
    });
    const reply = this.thread(channelId, messages, receipts, root.id, {
      senderId: 'zavorth',
      recipientId: 'channel-alpha',
      text: 'Threaded reply',
    });
    this.edit(channelId, messages, receipts, reply.id, 'Threaded reply edited');
    this.react(channelId, messages, receipts, root.id, 'ack', 'operator');
    this.attach(channelId, messages, receipts, root.id, {
      name: 'receipt.txt',
      mimeType: 'text/plain',
      bytes: 128,
    });
    this.delete(channelId, messages, receipts, reply.id);

    const actionsCovered = Array.from(new Set(receipts.map((receipt) => receipt.action)));
    const requiredActions: ChannelRuntimeAction[] = ['send', 'receive', 'thread', 'edit', 'delete', 'reaction', 'attachment'];
    const status = requiredActions.every((action) => actionsCovered.includes(action)) ? 'passed' : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      status,
      channelId,
      actionsCovered,
      messages,
      receipts,
      summary: {
        messages: messages.length,
        receipts: receipts.length,
        send: receipts.filter((receipt) => receipt.action === 'send').length,
        receive: receipts.filter((receipt) => receipt.action === 'receive').length,
        thread: receipts.filter((receipt) => receipt.action === 'thread').length,
        edit: receipts.filter((receipt) => receipt.action === 'edit').length,
        delete: receipts.filter((receipt) => receipt.action === 'delete').length,
        reaction: receipts.filter((receipt) => receipt.action === 'reaction').length,
        attachment: receipts.filter((receipt) => receipt.action === 'attachment').length,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      },
    };
  }

  public send(
    channelId: ChannelRuntimeId,
    messages: ChannelRuntimeMessage[],
    receipts: ChannelRuntimeReceipt[],
    input: MessageInput,
  ): ChannelRuntimeMessage {
    const message = this.message(channelId, input);
    messages.push(message);
    receipts.push(this.receipt(channelId, 'send', message, 'offline simulator send applied'));
    return message;
  }

  public receive(
    channelId: ChannelRuntimeId,
    messages: ChannelRuntimeMessage[],
    receipts: ChannelRuntimeReceipt[],
    input: MessageInput,
  ): ChannelRuntimeMessage {
    const message = this.message(channelId, input);
    messages.push(message);
    receipts.push(this.receipt(channelId, 'receive', message, 'offline simulator receive normalized'));
    return message;
  }

  public thread(
    channelId: ChannelRuntimeId,
    messages: ChannelRuntimeMessage[],
    receipts: ChannelRuntimeReceipt[],
    threadId: string,
    input: MessageInput,
  ): ChannelRuntimeMessage {
    const message = this.message(channelId, {
      ...input,
      threadId,
    });
    messages.push(message);
    receipts.push(this.receipt(channelId, 'thread', message, 'offline simulator thread reply applied'));
    return message;
  }

  public edit(
    channelId: ChannelRuntimeId,
    messages: ChannelRuntimeMessage[],
    receipts: ChannelRuntimeReceipt[],
    messageId: string,
    text: string,
  ): void {
    const message = findMessage(messages, messageId);
    message.text = text;
    message.updatedAt = this.now().toISOString();
    receipts.push(this.receipt(channelId, 'edit', message, 'offline simulator edit applied'));
  }

  public delete(
    channelId: ChannelRuntimeId,
    messages: ChannelRuntimeMessage[],
    receipts: ChannelRuntimeReceipt[],
    messageId: string,
  ): void {
    const message = findMessage(messages, messageId);
    message.deleted = true;
    message.updatedAt = this.now().toISOString();
    receipts.push(this.receipt(channelId, 'delete', message, 'offline simulator delete applied'));
  }

  public react(
    channelId: ChannelRuntimeId,
    messages: ChannelRuntimeMessage[],
    receipts: ChannelRuntimeReceipt[],
    messageId: string,
    name: string,
    senderId: string,
  ): void {
    const message = findMessage(messages, messageId);
    message.reactions.push({
      name,
      senderId,
    });
    message.updatedAt = this.now().toISOString();
    receipts.push(this.receipt(channelId, 'reaction', message, 'offline simulator reaction applied'));
  }

  public attach(
    channelId: ChannelRuntimeId,
    messages: ChannelRuntimeMessage[],
    receipts: ChannelRuntimeReceipt[],
    messageId: string,
    attachment: { name: string; mimeType: string; bytes: number },
  ): void {
    const message = findMessage(messages, messageId);
    message.attachments.push({
      id: this.id('attachment'),
      name: attachment.name,
      mimeType: attachment.mimeType,
      bytes: attachment.bytes,
    });
    message.updatedAt = this.now().toISOString();
    receipts.push(this.receipt(channelId, 'attachment', message, 'offline simulator attachment applied'));
  }

  private message(channelId: ChannelRuntimeId, input: MessageInput): ChannelRuntimeMessage {
    const timestamp = this.now().toISOString();
    return {
      id: this.id('message'),
      channelId,
      threadId: input.threadId || null,
      senderId: String(input.senderId || 'zavorth'),
      recipientId: String(input.recipientId || 'channel'),
      text: String(input.text || '').trim(),
      attachments: [],
      reactions: [],
      deleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private receipt(
    channelId: ChannelRuntimeId,
    action: ChannelRuntimeAction,
    message: ChannelRuntimeMessage,
    reason: string,
  ): ChannelRuntimeReceipt {
    return {
      id: this.id('receipt'),
      channelId,
      action,
      status: 'dryRun',
      messageId: message.id,
      threadId: message.threadId,
      liveIoPerformed: false,
      secretValuesSerialized: false,
      reason,
    };
  }

  private id(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, '0')}`;
  }
}

function findMessage(messages: ChannelRuntimeMessage[], messageId: string): ChannelRuntimeMessage {
  const message = messages.find((entry) => entry.id === messageId);
  if (!message) {
    throw new Error(`Simulator message not found: ${messageId}`);
  }
  return message;
}
