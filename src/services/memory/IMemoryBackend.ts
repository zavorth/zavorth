export interface IMemoryBackend {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  addMemory(userId: string, content: string): Promise<void>;
  searchMemory(userId: string, query: string, limit?: number): Promise<string[]>;
}
