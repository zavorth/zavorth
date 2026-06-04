import { IntegrationConnectorMeshService } from '../../src/services/IntegrationConnectorMeshService';

describe('IntegrationConnectorMeshService', () => {
  it('registers the expected connector brokers', () => {
    const service = new IntegrationConnectorMeshService({ env: {} });

    const ids = service.listManifests().map((manifest) => manifest.id);

    expect(ids).toEqual(expect.arrayContaining([
      'composio',
      'nango',
      'pipedream',
      'zapier',
      'n8n',
      'workato',
    ]));
  });

  it('reports missing config honestly without calling the network', async () => {
    const fetchImpl = jest.fn();
    const service = new IntegrationConnectorMeshService({ env: {}, fetchImpl: fetchImpl as any });

    const doctor = await service.doctor('composio');

    expect(doctor.status).toBe('missing_config');
    expect(doctor.configured).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('runs a Composio toolkit readiness probe with secret headers only', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const service = new IntegrationConnectorMeshService({
      env: { COMPOSIO_API_KEY: 'secret-composio-key' } as any,
      fetchImpl: fetchImpl as any,
      now: () => new Date('2026-06-01T10:00:00.000Z'),
    });

    const doctor = await service.doctor('composio');

    expect(doctor.status).toBe('ready');
    expect(doctor.checkedTarget).toBe('https://backend.composio.dev/api/v3.1/toolkits');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://backend.composio.dev/api/v3.1/toolkits',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'secret-composio-key' }),
      }),
    );
    expect(JSON.stringify(doctor)).not.toContain('secret-composio-key');
  });

  it('runs a Nango connection readiness probe with bearer auth', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ connections: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const service = new IntegrationConnectorMeshService({
      env: { NANGO_SECRET_KEY: 'secret-nango-key' } as any,
      fetchImpl: fetchImpl as any,
    });

    const doctor = await service.doctor('nango');

    expect(doctor.status).toBe('ready');
    expect(doctor.checkedTarget).toBe('https://api.nango.dev/connections');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.nango.dev/connections',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret-nango-key' }),
      }),
    );
    expect(JSON.stringify(doctor)).not.toContain('secret-nango-key');
  });

  it('builds approval-gated execution previews and redacts input secrets', () => {
    const service = new IntegrationConnectorMeshService({
      env: { COMPOSIO_API_KEY: 'secret-composio-key' } as any,
    });

    const preview = service.buildExecutePreview({
      connectorId: 'composio',
      toolSlug: 'gmail_send_email',
      input: { to: 'user@example.com', apiKey: 'must-not-leak' },
    });

    expect(preview.requiresApproval).toBe(true);
    expect(preview.target).toBe('https://backend.composio.dev/api/v3.1/tools/execute/gmail_send_email');
    expect(JSON.stringify(preview)).not.toContain('must-not-leak');
    expect(JSON.stringify(preview)).toContain('***');
  });

  it('builds n8n webhook execution previews without requiring an API key', () => {
    const service = new IntegrationConnectorMeshService({
      env: {
        N8N_EXECUTE_URL: 'http://127.0.0.1:5678/webhook/private-secret-path',
      } as any,
    });

    const preview = service.buildExecutePreview({
      connectorId: 'n8n',
      input: { customer: 'Ada', token: 'must-not-leak' },
    });

    expect(preview.toolSlug).toBe('default');
    expect(preview.target).toBe('http://127.0.0.1:5678/[N8N_EXECUTE_URL]');
    expect(JSON.stringify(preview)).not.toContain('private-secret-path');
    expect(JSON.stringify(preview)).not.toContain('must-not-leak');
    expect(JSON.stringify(preview)).toContain('***');
  });

  it('executes n8n through the configured webhook endpoint and redacts response secrets', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      ok: true,
      token: 'response-secret',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const service = new IntegrationConnectorMeshService({
      env: {
        N8N_EXECUTE_URL: 'http://127.0.0.1:5678/webhook/private-secret-path',
      } as any,
      fetchImpl: fetchImpl as any,
    });

    const execution = await service.executeTool({
      connectorId: 'n8n',
      input: { message: 'run workflow' },
    });

    expect(execution.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:5678/webhook/private-secret-path',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: 'run workflow' }),
      }),
    );
    expect(JSON.stringify(execution)).not.toContain('response-secret');
  });

  it.each([
    ['pipedream', 'PIPEDREAM_EXECUTE_URL', 'PIPEDREAM_API_KEY', 'Bearer secret-pipedream-key'],
    ['zapier', 'ZAPIER_EXECUTE_URL', 'ZAPIER_API_KEY', 'Bearer secret-zapier-key'],
    ['workato', 'WORKATO_EXECUTE_URL', 'WORKATO_API_TOKEN', 'Bearer secret-workato-key'],
  ])('executes %s through an approval-gated configured endpoint', async (connectorId, executeKey, apiKey, authHeader) => {
    const env = {
      [executeKey]: `https://example.com/hooks/${connectorId}/private-secret`,
      [apiKey]: `secret-${connectorId}-key`,
    } as any;
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    }));
    const service = new IntegrationConnectorMeshService({ env, fetchImpl: fetchImpl as any });

    const preview = service.buildExecutePreview({
      connectorId,
      toolSlug: 'send_summary',
      input: { apiKey: 'must-not-leak' },
    });
    const execution = await service.executeTool({
      connectorId,
      toolSlug: 'send_summary',
      input: { payload: 'hello' },
    });

    expect(preview.target).toBe(`https://example.com/[${executeKey}]`);
    expect(JSON.stringify(preview)).not.toContain('private-secret');
    expect(execution.ok).toBe(true);
    expect(execution.httpStatus).toBe(202);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://example.com/hooks/${connectorId}/private-secret`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: authHeader }),
      }),
    );
  });

  it('treats health URLs as configured readiness even when a webhook connector has no API key', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const service = new IntegrationConnectorMeshService({
      env: {
        N8N_HEALTH_URL: 'http://127.0.0.1:5678/healthz',
      } as any,
      fetchImpl: fetchImpl as any,
    });

    const doctor = await service.doctor('n8n');

    expect(doctor.status).toBe('ready');
    expect(doctor.configured).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:5678/healthz',
      expect.objectContaining({
        method: 'GET',
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    );
  });
});
