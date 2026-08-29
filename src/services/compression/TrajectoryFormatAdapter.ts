import type { ChatMessage, ToolCall } from '../../providers/ILlmProvider.js';
import type {
  TrajectoryTurn,
  TrajectoryToolCallRecord,
  TrajectoryTurnRole,
} from './ZavorthTrajectoryCompressorService.js';

export class TrajectoryFormatAdapter {
  /**
   * Converts ChatMessage[] to TrajectoryTurn[] with atomic tool-pair grouping.
   * An assistant message and its subsequent matching tool messages are bound together
   * into a single TrajectoryTurn so they cannot be severed across compression boundaries.
   */
  public toTrajectoryTurns(messages: readonly ChatMessage[]): TrajectoryTurn[] {
    const turns: TrajectoryTurn[] = [];
    let i = 0;

    while (i < messages.length) {
      const msg = messages[i];
      if (!msg) {
        i += 1;
        continue;
      }

      if (msg.role === 'assistant' && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
        const toolRecords: TrajectoryToolCallRecord[] = [];
        const assistantToolCalls = msg.toolCalls;
        let j = i + 1;
        const toolMessageMap = new Map<string, ChatMessage>();

        while (j < messages.length && messages[j]?.role === 'tool') {
          const tMsg = messages[j];
          if (tMsg.toolCallId) {
            toolMessageMap.set(tMsg.toolCallId, tMsg);
          }
          j += 1;
        }

        for (const tc of assistantToolCalls) {
          const matchedToolMsg = tc.id ? toolMessageMap.get(tc.id) : undefined;
          const inputPayload =
            typeof tc.arguments === 'object' && tc.arguments !== null
              ? JSON.stringify(tc.arguments)
              : String(tc.arguments ?? '{}');
          const outputPayload = String(matchedToolMsg?.content ?? '');

          toolRecords.push({
            toolName: tc.name || matchedToolMsg?.toolName || 'tool',
            inputPayload,
            outputPayload,
            toolCallId: tc.id,
          });
        }

        const content = String(msg.content ?? '');
        const estimatedTokens = this.estimateTokens(content, toolRecords);

        turns.push({
          id: `turn-${i}`,
          role: 'assistant',
          content,
          toolCalls: toolRecords,
          estimatedTokens,
          isProtectedAnchor: false,
        });

        i = j;
        continue;
      }

      const role: TrajectoryTurnRole = msg.role;
      const content = String(msg.content ?? '');
      const estimatedTokens = Math.ceil(Math.max(1, content.length) / 4);

      turns.push({
        id: `turn-${i}`,
        role,
        content,
        inlineData: msg.inlineData ? [...msg.inlineData] : undefined,
        estimatedTokens,
        isProtectedAnchor: role === 'system',
      });

      i += 1;
    }

    return turns;
  }

  /**
   * Converts TrajectoryTurn[] back to ChatMessage[] guaranteeing tool-pair integrity.
   * Every assistant turn with tool calls emits the assistant message and its matching tool messages together.
   * Compressed digest turns are emitted as clean assistant messages.
   */
  public toChatMessages(turns: readonly TrajectoryTurn[]): ChatMessage[] {
    const messages: ChatMessage[] = [];

    for (let i = 0; i < turns.length; i += 1) {
      const turn = turns[i];

      if (
        turn.id === 'compressed-middle-digest' ||
        turn.content.startsWith('### [Zavorth Trajectory Semantic Compression Digest]')
      ) {
        messages.push({
          role: 'assistant',
          content: turn.content,
        });
        continue;
      }

      if (turn.role === 'assistant' && turn.toolCalls && turn.toolCalls.length > 0) {
        const toolCalls: ToolCall[] = [];
        const toolMessages: ChatMessage[] = [];

        for (let tIdx = 0; tIdx < turn.toolCalls.length; tIdx += 1) {
          const tc = turn.toolCalls[tIdx];
          const callId = tc.toolCallId || `call-${turn.id}-${tIdx}`;

          let parsedArgs: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(tc.inputPayload);
            if (typeof parsed === 'object' && parsed !== null) {
              parsedArgs = parsed as Record<string, unknown>;
            }
          } catch {
            parsedArgs = { raw: tc.inputPayload };
          }

          toolCalls.push({
            id: callId,
            name: tc.toolName,
            arguments: parsedArgs,
          });

          toolMessages.push({
            role: 'tool',
            toolCallId: callId,
            toolName: tc.toolName,
            content: tc.outputPayload,
          });
        }

        messages.push({
          role: 'assistant',
          content: turn.content.length > 0 ? turn.content : null,
          toolCalls,
          inlineData: turn.inlineData ? [...turn.inlineData] : undefined,
        });

        for (const tm of toolMessages) {
          messages.push(tm);
        }
        continue;
      }

      messages.push({
        role: turn.role,
        content: turn.content,
        inlineData: turn.inlineData ? [...turn.inlineData] : undefined,
      });
    }

    return messages;
  }

  private estimateTokens(content: string, toolRecords: readonly TrajectoryToolCallRecord[]): number {
    let chars = content.length;
    for (const tr of toolRecords) {
      chars += tr.inputPayload.length + tr.outputPayload.length + tr.toolName.length;
    }
    return Math.ceil(Math.max(1, chars) / 4);
  }
}
