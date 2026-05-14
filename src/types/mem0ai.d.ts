declare module 'mem0ai' {
  export class MemoryClient {
    constructor(config?: { apiKey?: string; user_id?: string });
    add(content: string, params?: { user_id?: string; [key: string]: any }): Promise<any>;
    search(query: string, params?: { user_id?: string; [key: string]: any }): Promise<any[]>;
    getAll(params?: { user_id?: string }): Promise<any[]>;
    get(id: string): Promise<any>;
    history(id: string): Promise<any[]>;
    delete(id: string): Promise<any>;
  }
}
