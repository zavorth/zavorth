import { ZavorthApiError, ZavorthClient } from '../../sdk/typescript/src';
import {
  readPublicPlatformCatalog,
  summarizePublicEcosystemContracts,
} from '../../examples/clients/public-ecosystem-contracts';
import { PUBLIC_ECOSYSTEM_CONTRACT_VERSION } from '../../src/runtime/agent/index.js';

describe('Zavorth TypeScript SDK', () => {
  it('calls the canonical REST endpoints', async () => {
    const calls: string[] = [];
    const client = new ZavorthClient({
      baseUrl: 'http://127.0.0.1:33333',
      token: 'token-123',
      fetchImpl: (async (input: URL | RequestInfo) => {
        calls.push(String(input));
        return {
          ok: true,
          json: async () => ({ status: 'ready' }),
        } as Response;
      }) as typeof fetch,
    });

    const status = await client.getGatewayStatus();
    expect(status).toEqual({ status: 'ready' });
    expect(calls[0]).toBe('http://127.0.0.1:33333/api/v1/gateway/status');
  });

  it('serializes query params for list endpoints', async () => {
    const calls: string[] = [];
    const client = new ZavorthClient({
      baseUrl: 'http://127.0.0.1:33333',
      fetchImpl: (async (input: URL | RequestInfo) => {
        calls.push(String(input));
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as Response;
      }) as typeof fetch,
    });

    await client.listArtifacts({ sessionId: 'sess-1', chatId: 'web:sess-1' });
    expect(calls[0]).toContain('/api/v1/artifacts?');
    expect(calls[0]).toContain('sessionId=sess-1');
    expect(calls[0]).toContain('chatId=web%3Asess-1');
  });

  it('covers learning, layered memory and ops quality endpoints', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new ZavorthClient({
      baseUrl: 'http://127.0.0.1:33333',
      token: 'token-abc',
      fetchImpl: (async (input: URL | RequestInfo, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }) as typeof fetch,
    });

    await client.getLearningCandidates({ workspace: 'workspace-a' });
    await client.getLearningMetrics({ workspace: 'workspace-a' });
    await client.promoteLearningCandidate('candidate:wf-1');
    await client.searchMemory({ query: 'gateway release', sessionId: 'sess-1' });
    await client.getMemoryProcedures({ workspaceHint: 'workspace-a' });
    await client.getMemoryMetrics({ sessionId: 'sess-1' });
    await client.getOpsQuality({ live: true, sessionId: 'sess-1', workspaceHint: 'workspace-a' });

    expect(calls[0].url).toContain('/api/v1/learning/candidates?');
    expect(calls[0].url).toContain('workspace=workspace-a');
    expect(calls[1].url).toContain('/api/v1/learning/metrics?');
    expect(calls[1].url).toContain('workspace=workspace-a');
    expect(calls[2].url).toBe('http://127.0.0.1:33333/api/v1/learning/actions');
    expect(calls[2].init).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          candidateId: 'candidate:wf-1',
          actionId: 'promote',
        }),
      }),
    );
    expect(calls[3].url).toContain('/api/v1/memory/search?');
    expect(calls[3].url).toContain('q=gateway+release');
    expect(calls[3].url).toContain('sessionId=sess-1');
    expect(calls[4].url).toContain('/api/v1/memory/procedures?');
    expect(calls[4].url).toContain('workspace=workspace-a');
    expect(calls[5].url).toContain('/api/v1/memory/metrics?');
    expect(calls[5].url).toContain('sessionId=sess-1');
    expect(calls[6].url).toContain('/api/v1/ops/quality?');
    expect(calls[6].url).toContain('live=true');
    expect(calls[6].url).toContain('sessionId=sess-1');
    expect(calls[6].url).toContain('workspace=workspace-a');
  });

  it('covers the public platform catalog endpoint', async () => {
    const calls: string[] = [];
    const client = new ZavorthClient({
      baseUrl: 'http://127.0.0.1:33333',
      fetchImpl: (async (input: URL | RequestInfo) => {
        calls.push(String(input));
        return {
          ok: true,
          json: async () => ({ items: [] }),
        } as Response;
      }) as typeof fetch,
    });

    await client.getPlatformCatalog({ query: 'openrouter' });

    expect(calls[0]).toContain('/api/v1/platform/catalog?');
    expect(calls[0]).toContain('q=openrouter');
  });

  it('keeps the public ecosystem example aligned with REST SDK and the runtime contract manifest', async () => {
    const calls: string[] = [];
    const client = new ZavorthClient({
      baseUrl: 'http://127.0.0.1:33333',
      fetchImpl: (async (input: URL | RequestInfo) => {
        calls.push(String(input));
        return {
          ok: true,
          json: async () => ({
            generatedAt: '2026-04-27T00:00:00.000Z',
            items: [],
          }),
        } as Response;
      }) as typeof fetch,
    });

    const summary = summarizePublicEcosystemContracts();
    const catalog = await readPublicPlatformCatalog(client);

    expect(summary).toEqual(expect.objectContaining({
      version: PUBLIC_ECOSYSTEM_CONTRACT_VERSION,
      restEndpoint: '/api/v1/platform/catalog',
    }));
    expect(summary.stable).toBeGreaterThan(0);
    expect(summary.experimental).toBeGreaterThan(0);
    expect(summary.areas.channel).toBeGreaterThan(0);
    expect(summary.areas.skill).toBeGreaterThan(0);
    expect(catalog.items).toEqual([]);
    expect(calls[0]).toContain('/api/v1/platform/catalog?');
    expect(calls[0]).toContain('q=public+contracts');
  });

  it('sends sdk headers and maps api errors', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new ZavorthClient({
      baseUrl: 'http://127.0.0.1:33333',
      token: 'token-xyz',
      defaultHeaders: {
        'X-Test-Header': 'sdk-check',
      },
      fetchImpl: (async (input: URL | RequestInfo, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return {
          ok: false,
          status: 409,
          text: async () => JSON.stringify({
            error: {
              code: 'CONFLICT',
              message: 'acao bloqueada',
              details: {
                field: 'candidateId',
              },
            },
          }),
        } as Response;
      }) as typeof fetch,
    });

    await expect(
      client.requestJson('POST', '/api/v1/learning/actions', {
        body: {
          candidateId: 'candidate:wf-1',
          actionId: 'promote',
        },
      }),
    ).rejects.toMatchObject({
      name: 'ZavorthApiError',
      status: 409,
      code: 'CONFLICT',
      details: {
        field: 'candidateId',
      },
      message: 'acao bloqueada',
    } satisfies Partial<ZavorthApiError>);

    expect(calls[0].url).toBe('http://127.0.0.1:33333/api/v1/learning/actions');
    expect(calls[0].init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer token-xyz',
          'Content-Type': 'application/json',
          'X-Zavorth-SDK': 'zavorth-typescript-sdk/1.0',
          'X-Test-Header': 'sdk-check',
        }),
      }),
    );
  });
});
