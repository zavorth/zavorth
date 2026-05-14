import { ZavorthBridgeMobileAccessVerificationService } from '../../src/services/ZavorthBridgeMobileAccessVerificationService.js';

describe('ZavorthBridgeMobileAccessVerificationService', () => {
  it('accepts a public URL when the root route responds with HTTP 200', async () => {
    const service = new ZavorthBridgeMobileAccessVerificationService({
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
      })) as any,
      now: () => new Date('2026-04-05T12:00:00.000Z'),
    });

    const result = await service.verify({
      accessUrl: 'https://ag.example.com',
      mode: 'public',
    });

    expect(result.ok).toBe(true);
    expect(result.route).toBe('root');
    expect(result.httpStatus).toBe(200);
  });

  it('falls back to /health when the root route does not validate', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
    const service = new ZavorthBridgeMobileAccessVerificationService({
      fetchImpl: fetchImpl as any,
      now: () => new Date('2026-04-05T12:00:00.000Z'),
    });

    const result = await service.verify({
      accessUrl: 'https://ag.example.com',
      mode: 'public',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.route).toBe('health');
  });
});
