import { RuntimeBrowserSidecarService } from '../../src/services/RuntimeBrowserSidecarService';

describe('RuntimeBrowserSidecarService', () => {
  it('requires an explicit remote sidecar URL', async () => {
    const service = new RuntimeBrowserSidecarService({
      baseUrl: '',
      fetchImpl: jest.fn() as any,
      receiptService: null,
    });

    expect(service.isConfigured()).toBe(false);
    await expect(service.execute({
      action: 'evaluate_js',
      args: { script: 'document.title' },
    })).rejects.toThrow('ZAVORTH_BROWSER_SIDECAR_URL');
  });

  it('calls the remote browser sidecar with bearer auth', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        result: {
          value: 'isolated title',
        },
      }),
    });
    const receiptService = {
      createAuditId: jest.fn(() => 'audit-browser'),
      hashSensitiveValue: jest.fn(() => 'args-hash'),
      record: jest.fn(),
    };
    const service = new RuntimeBrowserSidecarService({
      baseUrl: 'http://127.0.0.1:35791/',
      token: 'sidecar-token',
      fetchImpl,
      receiptService,
    });

    const result = await service.execute({
      action: 'evaluate_js',
      args: { script: "document.querySelector('#app')?.textContent" },
      timeoutMs: 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.isolated).toBe(true);
    expect(result.payload).toEqual(expect.objectContaining({ ok: true }));
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:35791/mcp/browser',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sidecar-token',
        }),
      }),
    );
    expect(receiptService.record).toHaveBeenCalledWith(expect.objectContaining({
      sidecarId: 'browser-sidecar',
      kind: 'browser',
      action: 'evaluate_js',
      status: 'succeeded',
      auditId: 'audit-browser',
    }));
  });

  it('surfaces sidecar HTTP failures without local fallback', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: 'blocked' }),
    });
    const service = new RuntimeBrowserSidecarService({
      baseUrl: 'http://127.0.0.1:35791',
      fetchImpl,
      receiptService: null,
    });

    await expect(service.execute({
      action: 'browser_navigate',
      args: { url: 'https://example.com' },
    })).rejects.toThrow('blocked');
  });
});
