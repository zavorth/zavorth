// Local for test resolution — jest.local replaces this at runtime
export class DayPathDiscoveryService {
  constructor(_catalog: unknown) {}
  async discover(_options: unknown): Promise<unknown> { return { mode: 'auto', count: 0, commands: [] }; }
}
