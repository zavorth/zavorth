/**
 * StreamingByteGuard — Proteção contra consumo ilimitado de respostas de providers.
 *
 * Envolva um ReadableStreamDefaultReader para rastrear bytes acumulados
 * e aplicar um limite rígido. Se o stream exceder o cap, o reader é
 * cancelado e um erro canônico é lançado.
 *
 * Uso:
 *   const guard = new StreamingByteGuard(reader, { maxBytes: 10_000_000 });
 *   while (true) {
 *     const chunk = await guard.read();
 *     if (!chunk) break;
 *     processChunk(chunk);
 *   }
 */

export class ByteLimitExceededError extends Error {
  public readonly totalBytes: number;
  public readonly maxBytes: number;

  constructor(totalBytes: number, maxBytes: number) {
    super(
      `Stream excedeu o limite de ${maxBytes} bytes (recebidos: ${totalBytes})`,
    );
    this.name = 'ByteLimitExceededError';
    this.totalBytes = totalBytes;
    this.maxBytes = maxBytes;
  }
}

export interface StreamingByteGuardOptions {
  maxBytes?: number;
}

export class StreamingByteGuard {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly maxBytes: number;
  private accumulatedBytes = 0;
  private cancelled = false;
  private overflowed = false;

  constructor(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    options: StreamingByteGuardOptions = {},
  ) {
    this.reader = reader;
    this.maxBytes = options.maxBytes ?? 10_000_000; // 10MB default
  }

  /**
   * Lê o próximo chunk do stream. Retorna null quando o stream termina.
   * Lança ByteLimitExceededError se o limite for excedido.
   */
  async read(): Promise<Uint8Array | null> {
    if (this.cancelled || this.overflowed) {
      return null;
    }

    const { value, done } = await this.reader.read();

    if (done) {
      return null;
    }

    if (value) {
      this.accumulatedBytes += value.byteLength;

      if (this.accumulatedBytes > this.maxBytes) {
        this.overflowed = true;
        await this.cancel();
        throw new ByteLimitExceededError(this.accumulatedBytes, this.maxBytes);
      }
    }

    return value ?? null;
  }

  /**
   * Cancela o reader subjacente.
   */
  async cancel(): Promise<void> {
    if (this.cancelled) return;
    this.cancelled = true;
    try {
      await this.reader.cancel();
    } catch {
      // ignora erros de cancelamento
    }
  }

  /** Bytes acumulados até o momento. */
  get totalBytes(): number {
    return this.accumulatedBytes;
  }

  /** Se o stream foi cancelado manualmente. */
  get isCancelled(): boolean {
    return this.cancelled;
  }

  /** Se o stream excedeu o limite. */
  get isOverflowed(): boolean {
    return this.overflowed;
  }
}
