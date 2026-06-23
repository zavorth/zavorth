import fs from 'fs';
import path from 'path';

export interface StreamChunk {
  id: string;
  content: string;
  tokens: number;
  timestamp: string;
  model: string;
  finish_reason: string | null;
}

export interface StreamSession {
  id: string;
  model: string;
  provider: string;
  started_at: string;
  chunks: StreamChunk[];
  total_tokens: number;
  status: 'streaming' | 'complete' | 'error' | 'cancelled';
  error: string | null;
}

export class StreamingLLMService {
  private readonly storageDir: string;
  private sessions: Map<string, StreamSession> = new Map();
  private activeStreams: Map<string, { abort: () => void }> = new Map();

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'streaming');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  public async streamChat(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      provider?: string;
      onChunk?: (chunk: StreamChunk) => void;
      onComplete?: (session: StreamSession) => void;
      onError?: (error: string) => void;
      max_tokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const provider = options?.provider || 'openai';

    const session: StreamSession = {
      id: sessionId,
      model,
      provider,
      started_at: new Date().toISOString(),
      chunks: [],
      total_tokens: 0,
      status: 'streaming',
      error: null,
    };

    this.sessions.set(sessionId, session);

    try {
      const { execFileSync } = await import('child_process');

      const apiKey = this.getApiKey(provider);
      if (!apiKey) {
        session.status = 'error';
        session.error = `API key not configured for ${provider}`;
        return session.error;
      }

      const baseUrl = this.getBaseUrl(provider);
      const payload = JSON.stringify({
        model,
        messages,
        max_tokens: options?.max_tokens || 4096,
        temperature: options?.temperature || 0.7,
        stream: true,
      });

      const tmpFile = path.join(this.storageDir, `${sessionId}.json`);
      fs.writeFileSync(tmpFile, payload);

      const headers = this.getHeaders(provider, apiKey);
      const curlArgs = [
        '-s', '-N',
        '-X', 'POST',
        ...headers.flatMap((h) => ['-H', h]),
        '-d', `@${tmpFile}`,
        `${baseUrl}/chat/completions`,
      ];

      const result = execFileSync('curl', curlArgs, {
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const lines = result.split('\n').filter((l) => l.startsWith('data: '));
      let fullContent = '';

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            const chunk: StreamChunk = {
              id: `chunk_${Date.now()}`,
              content: delta.content,
              tokens: Math.ceil(delta.content.length / 4),
              timestamp: new Date().toISOString(),
              model,
              finish_reason: parsed.choices?.[0]?.finish_reason || null,
            };
            session.chunks.push(chunk);
            session.total_tokens += chunk.tokens;
            options?.onChunk?.(chunk);
          }
        } catch { /* skip non-JSON lines */ }
      }

      session.status = 'complete';
      this.saveSession(session);
      options?.onComplete?.(session);

      return fullContent;
    } catch (error: unknown) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : String(error);
      options?.onError?.(session.error);
      return `Error: ${session.error}`;
    }
  }

  public cancel(sessionId: string): string {
    const stream = this.activeStreams.get(sessionId);
    if (stream) {
      stream.abort();
      this.activeStreams.delete(sessionId);
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'cancelled';
      this.saveSession(session);
    }

    return `Stream "${sessionId}" cancelled.`;
  }

  public getSession(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return `Session "${sessionId}" not found.`;

    return [
      `Stream Session: ${session.id}`,
      `  Model: ${session.model} (${session.provider})`,
      `  Status: ${session.status}`,
      `  Chunks: ${session.chunks.length}`,
      `  Tokens: ${session.total_tokens}`,
      `  Started: ${session.started_at}`,
      session.error ? `  Error: ${session.error}` : '',
    ].filter(Boolean).join('\n');
  }

  public listSessions(): string {
    if (this.sessions.size === 0) return 'No stream sessions.';

    const lines: string[] = ['Stream Sessions:'];
    for (const [, s] of this.sessions) {
      const icon = { streaming: '🔄', complete: '✅', error: '❌', cancelled: '🚫' }[s.status];
      lines.push(`  ${icon} ${s.id}: ${s.model} [${s.status}] ${s.total_tokens} tokens`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const sessions = Array.from(this.sessions.values());
    const totalChunks = sessions.reduce((sum, s) => sum + s.chunks.length, 0);
    const totalTokens = sessions.reduce((sum, s) => sum + s.total_tokens, 0);
    const completed = sessions.filter((s) => s.status === 'complete').length;

    return [
      'Streaming Stats:',
      `  Sessions: ${sessions.length}`,
      `  Completed: ${completed}`,
      `  Total chunks: ${totalChunks}`,
      `  Total tokens: ${totalTokens}`,
    ].join('\n');
  }

  private getApiKey(provider: string): string | null {
    const keyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GEMINI_API_KEY',
      groq: 'GROQ_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      mistral: 'MISTRAL_API_KEY',
    };
    return process.env[keyMap[provider]] || null;
  }

  private getBaseUrl(provider: string): string {
    const urlMap: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      google: 'https://generativelanguage.googleapis.com/v1beta',
      groq: 'https://api.groq.com/openai/v1',
      deepseek: 'https://api.deepseek.com/v1',
      mistral: 'https://api.mistral.ai/v1',
    };
    return urlMap[provider] || 'https://api.openai.com/v1';
  }

  private getHeaders(provider: string, apiKey: string): string[] {
    if (provider === 'anthropic') {
      return [
        `x-api-key: ${apiKey}`,
        'anthropic-version: 2023-06-01',
        'Content-Type: application/json',
      ];
    }
    return [
      `Authorization: Bearer ${apiKey}`,
      'Content-Type: application/json',
    ];
  }

  private saveSession(session: StreamSession): void {
    const filePath = path.join(this.storageDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }
}
