import type {
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalReplyPacket,
  UniversalReplyPort,
} from '../agent/UniversalAgentRuntimeTypes.js';
import { ChannelCapabilityMatrix } from './ChannelCapabilityMatrix.js';
import { OutboundPolicy } from './OutboundPolicy.js';
import { ReplyChunker } from './ReplyChunker.js';

export type ReplyPipelineInput = {
  run: UniversalAgentRun;
  text: string;
  ports?: UniversalReplyPort[];
  now?: Date;
};

export type ReplyPipelineOptions = {
  channelCapabilities?: ChannelCapabilityMatrix;
  chunker?: ReplyChunker;
  outboundPolicy?: OutboundPolicy;
};

export class ReplyPipeline {
  private readonly channelCapabilities: ChannelCapabilityMatrix;
  private readonly chunker: ReplyChunker;
  private readonly outboundPolicy: OutboundPolicy;

  constructor(options: ReplyPipelineOptions = {}) {
    this.channelCapabilities = options.channelCapabilities || new ChannelCapabilityMatrix();
    this.chunker = options.chunker || new ReplyChunker();
    this.outboundPolicy = options.outboundPolicy || new OutboundPolicy();
  }

  public buildReplies(input: ReplyPipelineInput): UniversalReplyPacket[] {
    const now = (input.now || new Date()).toISOString();
    const targetPorts = this.outboundPolicy.selectPorts({
      run: input.run,
      ports: input.ports,
    });
    const replies: UniversalReplyPacket[] = [];

    targetPorts.forEach((port, portIndex) => {
      const capabilities = this.channelCapabilities.get(port.kind);
      const chunks = this.chunker.chunk({
        text: input.text,
        maxLength: capabilities.maxTextLength,
      });

      chunks.forEach((chunk) => {
        replies.push({
          id: chunk.index === 0
            ? `${input.run.id}:reply:${portIndex + 1}`
            : `${input.run.id}:reply:${portIndex + 1}:chunk:${chunk.index + 1}`,
          runId: input.run.id,
          port,
          text: chunk.text,
          createdAt: now,
          metadata: {
            channel: port.kind,
            sessionId: input.run.sessionId,
            traceId: input.run.traceId,
            chunkIndex: chunk.index,
            chunkCount: chunk.total,
          },
        });
      });
    });

    return replies;
  }

  public buildResult(input: ReplyPipelineInput): UniversalAgentRunResult {
    const replies = this.buildReplies(input);
    const now = replies[0]?.createdAt || (input.now || new Date()).toISOString();
    input.run.events.push({
      id: `${input.run.id}:reply-event:${input.run.events.length + 1}`,
      runId: input.run.id,
      kind: 'reply',
      title: 'Resposta preparada',
      detail: `${replies.length} pacote(s) de resposta preparado(s).`,
      status: 'done',
      createdAt: now,
      metadata: {
        replyCount: replies.length,
        portIds: replies.map((reply) => reply.port.id),
      },
    });
    return {
      ok: input.run.status !== 'failed' && input.run.status !== 'cancelled',
      run: input.run,
      replies,
    };
  }
}
