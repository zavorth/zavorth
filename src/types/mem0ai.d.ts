declare module 'mem0ai' {
  export class MemoryClient {
    constructor(config?: { apiKey?: string; user_id?: string });
    add(content: string, params?: { user_id?: string; [key: string]: unknown }): Promise<unknown>;
    search(query: string, params?: { user_id?: string; [key: string]: unknown }): Promise<unknown[]>;
    getAll(params?: { user_id?: string }): Promise<unknown[]>;
    get(id: string): Promise<unknown>;
    history(id: string): Promise<unknown[]>;
    delete(id: string): Promise<unknown>;
  }
}
