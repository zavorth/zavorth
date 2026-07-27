// Local for test resolution — jest.local replaces this at runtime
export class DayPathDiscoveryService {
  constructor(_catalog: any) {}
  async discover(_options: any): Promise<any> { return { mode: 'auto', count: 0, commands: [] }; }
}
