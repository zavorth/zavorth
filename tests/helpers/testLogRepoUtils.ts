export function createTestLogRepo() {
  return {
    log: jest.fn(),
    getRecentLogs: jest.fn(() => []),
  } as any;
}
