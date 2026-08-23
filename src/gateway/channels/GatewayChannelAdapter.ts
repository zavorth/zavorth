export interface GatewayChannelAdapter {
  id: string; // e.g., 'telegram', 'web', 'whatsapp', 'cli'
  name: string;
  type: 'sync' | 'async' | 'duplex';

  /**
   * Declared outbound message size limit used by the shared formatting
   * pipeline. Optional: adapters without a hard platform limit omit it.
   */
  readonly messageCharLimit?: number;

  /**
   * Optional API negotiation of the effective outbound message size limit,
   * invoked once during channel registration when implemented. Returns the
   * negotiated limit, or null to keep the declared limit.
   */
  negotiateMessageCharLimit?(): Promise<number | null>;

  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Channels may emit events inward
  onMessageReceived?(payload: unknown): Promise<unknown>;

  // Channels may receive generic payloads outward
  sendMessage?(payload: unknown): Promise<unknown>;

  /**
   * Renews a chat presence indicator (for example a "typing" action) for
   * transports that support live presence. Optional: outbox-based transports
   * without a presence API simply do not implement it.
   */
  renewTyping?(chatId: string): Promise<void>;
}
