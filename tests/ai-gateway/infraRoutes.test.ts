import { POST as handleDrain } from '../../src/ai-gateway/app/api/infra/drain/route.js';
import { GET as handleStatus } from '../../src/ai-gateway/app/api/infra/status/route.js';
import { STARTUP_EPOCH } from '../../src/ai-gateway/lib/gracefulShutdown.js';

jest.mock('@/lib/api/requireManagementAuth', () => ({
  requireStrictManagementAuth: async () => null,
}));

describe('Infra API Routes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('GET /api/infra/status returns current shutdown state', async () => {
    const response = await handleStatus();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      shuttingDown: false,
      activeRequests: 0,
      epoch: STARTUP_EPOCH,
    });
  });

  it('POST /api/infra/drain returns 400 on invalid payload', async () => {
    const req = new Request('http://localhost/api/infra/drain', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await handleDrain(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('epoch is required');
  });

  it('POST /api/infra/drain returns 400 on epoch mismatch', async () => {
    const req = new Request('http://localhost/api/infra/drain', {
      method: 'POST',
      body: JSON.stringify({ epoch: STARTUP_EPOCH - 1 }),
    });
    const response = await handleDrain(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Epoch mismatch');
  });

  it('POST /api/infra/drain triggers SIGTERM on correct epoch', async () => {
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(((_pid: number, _signal?: string | number) => {}) as unknown as (pid: number, signal?: string | number) => boolean);
    
    const req = new Request('http://localhost/api/infra/drain', {
      method: 'POST',
      body: JSON.stringify({ epoch: STARTUP_EPOCH }),
    });
    const response = await handleDrain(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Advance timer past the 500ms delay in route.ts
    jest.advanceTimersByTime(501);
    expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');

    killSpy.mockRestore();
  });
});
