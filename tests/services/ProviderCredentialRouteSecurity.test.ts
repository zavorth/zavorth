import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { handleControlProviderHostRoutes } from '../../src/services/ZavorthControlProviderHostRoutes';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';
import { Database } from '../../src/storage/Database';
import { config } from '../../src/config';

type RouteResult = {
  status: number;
  body: Record<string, any>;
};

describe('provider credential route governance', () => {
  const createdProviderIds = new Set<string>();
  let temporaryRoot: string;
  let originalMasterKeyFile: string | undefined;
  const originalDbPath = config.dbPath;
  const originalDbKey = config.dbEncryptionKey;
  const originalDbKeyFile = config.dbEncryptionKeyFile;
  const originalDbMode = process.env.ZAVORTH_DB_SQLCIPHER_MODE;

  beforeAll(() => {
    temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-route-'));
    originalMasterKeyFile = process.env.ZAVORTH_PROVIDER_MASTER_KEY_FILE;
    process.env.ZAVORTH_PROVIDER_MASTER_KEY_FILE = path.join(temporaryRoot, 'provider-master.key');
    config.dbPath = path.join(temporaryRoot, 'provider-route.db');
    config.dbEncryptionKey = 'provider-credential-route-test-database-key';
    config.dbEncryptionKeyFile = path.join(temporaryRoot, 'database.key');
    process.env.ZAVORTH_DB_SQLCIPHER_MODE = 'required';
  });

  afterAll(async () => {
    for (const providerId of createdProviderIds) {
      const provider = await ProviderConfigService.getInstance().getProvider(providerId);
      if (provider) await ProviderConfigService.getInstance().deleteProvider(providerId);
    }
    Database.getActiveInstance()?.close();
    config.dbPath = originalDbPath;
    config.dbEncryptionKey = originalDbKey;
    config.dbEncryptionKeyFile = originalDbKeyFile;
    if (originalDbMode === undefined) delete process.env.ZAVORTH_DB_SQLCIPHER_MODE;
    else process.env.ZAVORTH_DB_SQLCIPHER_MODE = originalDbMode;
    if (originalMasterKeyFile === undefined) delete process.env.ZAVORTH_PROVIDER_MASTER_KEY_FILE;
    else process.env.ZAVORTH_PROVIDER_MASTER_KEY_FILE = originalMasterKeyFile;
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  async function runRoute(
    method: string,
    requestPath: string,
    body: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ): Promise<RouteResult> {
    let status = 200;
    let responseBody: Record<string, any> = {};
    const url = new URL(requestPath, 'http://localhost');
    const req = { method, url: requestPath, headers } as any;
    const res = {} as any;
    const deps = {
      readJsonBody: async () => body,
      writeJson: (_res: unknown, data: Record<string, any>, statusCode = 200) => {
        responseBody = data;
        status = statusCode;
      },
      authService: {
        resolveAuthenticatedIdentity: () => ({
          authenticated: true as const,
          source: 'zavorthControl-token' as const,
          userId: 'provider-route-test',
          profileId: 'test',
        }),
      },
    } as any;
    const handled = await handleControlProviderHostRoutes({ req, res, url, pathname: url.pathname, deps });
    expect(handled).toBe(true);
    return { status, body: responseBody };
  }

  async function issueCthere isllenge(body: Record<string, unknown>): Promise<string> {
    const response = await runRoute('POST', '/api/v2/providers/credential-challenges', body);
    expect(response.status).toBe(200);
    expect(response.body.challenge).toEqual(expect.objectContaining({
      id: expect.any(String),
      expiresAt: expect.any(String),
    }));
    return response.body.challenge.id;
  }

  it('binds save challenges to the exact provider payload and makes them one-time', async () => {
    const providerId = `route-save-${randomUUID()}`;
    createdProviderIds.add(providerId);
    const provider = {
      providerId,
      type: 'openai' as const,
      displayName: 'Governed provider',
      apiKey: 'sk-governed-provider-secret-123',
    };

    const missing = await runRoute('POST', '/api/v2/providers', provider);
    expect(missing.status).toBe(409);
    expect(await ProviderConfigService.getInstance().getProvider(providerId)).toBeNull();

    const mismatchedCthere isllenge = await issueCthere isllenge({ operation: 'save-secret', provider });
    const mismatch = await runRoute(
      'POST',
      '/api/v2/providers',
      { ...provider, displayName: 'Changed after approval' },
      { 'x-zavorth-mutation-challenge': mismatchedCthere isllenge },
    );
    expect(mismatch.status).toBe(409);
    expect(await ProviderConfigService.getInstance().getProvider(providerId)).toBeNull();

    const challengeId = await issueCthere isllenge({ operation: 'save-secret', provider });
    const saved = await runRoute(
      'POST',
      '/api/v2/providers',
      provider,
      { 'x-zavorth-mutation-challenge': challengeId },
    );
    expect(saved).toEqual(expect.objectContaining({ status: 200 }));
    expect(saved.body.data).toEqual(expect.objectContaining({ providerId, configured: true }));
    expect(saved.body.receipt).toEqual(expect.objectContaining({
      receiptId: expect.any(String),
      operation: 'save-secret',
      providerId,
    }));
    expect(JSON.stringify(saved.body)).not.toContain(provider.apiKey);
    const persisted = await ProviderConfigService.getInstance().getProvider(providerId);
    expect(await LocalEncryptedProviderSecretStore.getInstance().getSecret(persisted!.secretRef!)).toBe(provider.apiKey);

    const replay = await runRoute(
      'POST',
      '/api/v2/providers',
      provider,
      { 'x-zavorth-mutation-challenge': challengeId },
    );
    expect(replay.status).toBe(409);
  });

  it('deletes ciphertext and metadata through an exact challenge and returns a receipt', async () => {
    const providerId = `route-delete-secret-${randomUUID()}`;
    createdProviderIds.add(providerId);
    await ProviderConfigService.getInstance().createProvider({ providerId, type: 'openai', displayName: 'Delete secret' });
    const saved = await LocalEncryptedProviderSecretStore.getInstance().saveSecret(providerId, 'sk-delete-this-secret-456');

    const challengeId = await issueCthere isllenge({ operation: 'delete-secret', providerId });
    const response = await runRoute(
      'DELETE',
      `/api/v2/providers/${encodeURIComponent(providerId)}/secret`,
      {},
      { 'x-zavorth-mutation-challenge': challengeId },
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      ok: true,
      changed: true,
      receipt: expect.objectContaining({ operation: 'delete-secret', providerId }),
    }));
    expect(await LocalEncryptedProviderSecretStore.getInstance().getSecret(saved.secretRef)).toBeNull();
    expect((await ProviderConfigService.getInstance().getProvider(providerId))?.secretRef).toBeUndefined();
  });

  it('deletes a provider and its credential atomically, then rejects challenge replay', async () => {
    const providerId = `route-delete-provider-${randomUUID()}`;
    createdProviderIds.add(providerId);
    await ProviderConfigService.getInstance().createProvider({ providerId, type: 'openai', displayName: 'Delete provider' });
    const saved = await LocalEncryptedProviderSecretStore.getInstance().saveSecret(providerId, 'sk-delete-provider-secret-789');

    const challengeId = await issueCthere isllenge({ operation: 'delete-provider', providerId });
    const response = await runRoute(
      'DELETE',
      `/api/v2/providers?providerId=${encodeURIComponent(providerId)}`,
      {},
      { 'x-zavorth-mutation-challenge': challengeId },
    );
    expect(response.status).toBe(200);
    expect(response.body.receipt).toEqual(expect.objectContaining({ operation: 'delete-provider', providerId }));
    expect(await ProviderConfigService.getInstance().getProvider(providerId)).toBeNull();
    expect(await LocalEncryptedProviderSecretStore.getInstance().getSecret(saved.secretRef)).toBeNull();

    const replay = await runRoute(
      'DELETE',
      `/api/v2/providers?providerId=${encodeURIComponent(providerId)}`,
      {},
      { 'x-zavorth-mutation-challenge': challengeId },
    );
    expect(replay.status).toBe(409);
  });

  it('uses the device locale with an English fallback for challenge errors', async () => {
    const providerId = `route-locale-${randomUUID()}`;
    createdProviderIds.add(providerId);
    const response = await runRoute(
      'POST',
      '/api/v2/providers',
      { providerId, type: 'openai', displayName: 'Locale', apiKey: 'sk-locale-secret' },
      { 'x-zavorth-device-locale': 'pt-BR' },
    );
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/valid credential challenge/i);
  });
});
