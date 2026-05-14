export interface GatewayChannelAdapter {
  id: string; // e.g., 'telegram', 'web', 'whatsapp', 'cli'
  name: string;
  type: 'sync' | 'async' | 'duplex';
  
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  // Channels may emit events inward
  onMessageReceived?(payload: unknown): Promise<void>;
  
  // Channels may receive generic payloads outward
  sendMessage?(payload: unknown): Promise<void>;
}
