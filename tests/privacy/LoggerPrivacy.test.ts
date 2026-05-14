import { logger } from '../../src/logger.js';

describe('logger privacy', () => {
  const originalInfo = console.info;

  afterEach(() => {
    console.info = originalInfo;
  });

  it('redacts sensitive message text and metadata before writing to console', () => {
    const info = jest.fn();
    console.info = info;

    logger.info('token=sk-testabcdefghijklmnopqrstuvwxyz for jane@example.com', {
      authorization: 'Bearer abcdefghijklmnopqrstuvwxyz',
      nested: {
        password: 'super-secret-value',
      },
    });

    const serialized = JSON.stringify(info.mock.calls[0]);
    expect(serialized).toContain('[redacted]');
    expect(serialized).toContain('[email-redacted]');
    expect(serialized).not.toContain('sk-test');
    expect(serialized).not.toContain('jane@example.com');
    expect(serialized).not.toContain('super-secret-value');
  });
});
