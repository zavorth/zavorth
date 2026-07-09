import type { IMemoryBackend } from './IMemoryBackend.js';

type Mem0ClientLike = {
  add(content: string, params?: { user_id?: string; [key: string]: any }): Promise<any>;
  search(query: string, params?: { user_id?: string; [key: string]: any }): Promise<any[]>;
};

type Mem0Module = {
  MemoryClient: new (config?: { apiKey?: string; user_id?: string }) => Mem0ClientLike;
};

type ModuleImporter = () => Promise<Mem0Module>;

export class Mem0MemoryBackend implements IMemoryBackend {
  public readonly name = 'mem0';
  private client: Mem0ClientLike | null = null;
  private availabilityChecked = false;
  private available = false;

  constructor(
    private readonly apiKey: string = process.env.MEM0_API_KEY || '',
    private readonly importer: ModuleImporter = async () => {
      const moduleName = 'mem0ai';
      return import(moduleName) as Promise<Mem0Module>;
    },
  ) {}

  public async isAvailable(): Promise<boolean> {
    if (this.availabilityChecked) {
      return this.available;
    }

    this.availabilityChecked = true;

    if (!this.apiKey) {
      this.available = false;
      return false;
    }

    try {
      const module = await this.importer();
      this.client = new module.MemoryClient({ apiKey: this.apiKey });
      this.available = true;
      return true;
    } catch (error: any) {
      this.client = null;
      this.available = false;
      return false;
    }
  }

  public async addMemory(userId: string, content: string): Promise<void> {
    if (!(await this.isAvailable()) || !this.client) {
      throw new Error('Mem0 indisponivel neste runtime.');
    }

    await this.client.add(content, { user_id: userId });
  }

  public async searchMemory(userId: string, query: string): Promise<string[]> {
    if (!(await this.isAvailable()) || !this.client) {
      throw new Error('Mem0 indisponivel neste runtime.');
    }

    const results = await this.client.search(query, { user_id: userId });
    return (results || [])
      .map((entry: any) => String(entry?.memory || '').trim())
      .filter(Boolean);
  }
}
