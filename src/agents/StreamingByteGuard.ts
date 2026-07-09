import { logger } from '../logger.js';/**
 * StreamingByteGuard — Protection against unlimited provider response consumption.
 *
 * Wraps a ReadableStreamDefaultReader to track accumulated bytes
 * and enforce a hard limit. If the stream exceeds the cap, the reader is
 * cancelled and a canonical error is thrown.
 *
 * Usage:
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
      `Stream exceeded limit of ${maxBytes} bytes (received: ${totalBytes})`,
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
   * Reads the next chunk from the stream. Returns null when stream ends.
   * Throws ByteLimitExceededError if limit is exceeded.
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
    } catch (error: unknown) {// Ignore cancellation errors.
      logger.warn('[Streaming Byte Guard] operation failed', error);
    }
  }

  /** Bytes accumulated so far. */
  get totalBytes(): number {
    return this.accumulatedBytes;
  }

  /** Whether the stream was manually cancelled. */
  get isCancelled(): boolean {
    return this.cancelled;
  }

  /** Se o stream excedeu o limite. */
  get isOverflowed(): boolean {
    return this.overflowed;
  }
}
