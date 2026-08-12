export interface StreamChunk {
  type: "text" | "tool_call" | "reasoning" | "error";
  content?: string;
  delta?: Record<string, unknown>;
}

export interface RequestPipelinePayloads {
  requestId: string;
  provider: string;
  model: string;
  startTime: number;
  streamChunks: StreamChunk[];
  finalUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: { message: string; code?: string };
}
