import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConnectionVerificationService } from '../../../src/services/connection/ConnectionVerificationService.js';
import type { PluginConnectionDescriptor } from '../../../src/contracts/connection/index.js';

describe('ConnectionVerificationService', () => {
  let tempDir: string;
  let service: ConnectionVerificationService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-conn-test-'));
    service = new ConnectionVerificationService({ requestTimeoutMs: 1000 });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('verifies a valid local directory connection with expected marker', async () => {
    const marker = '.vault_marker';
    fs.writeFileSync(path.join(tempDir, marker), 'vault-data');

    const descriptor: PluginConnectionDescriptor = {
      authType: 'local_path',
      usePkce: false,
      localPath: {
        kind: 'directory',
        label: 'My Vault',
        expectedMarker: marker,
      },
    };

    const res = await service.verify('vault', descriptor, { localPath: tempDir });

    expect(res.ok).toBe(true);
    expect(res.details).toContain('Valid path verified');
  });

  it('fails verification when local path does not exist', async () => {
    const descriptor: PluginConnectionDescriptor = {
      authType: 'local_path',
      usePkce: false,
      localPath: {
        kind: 'directory',
        label: 'Missing Dir',
      },
    };

    const res = await service.verify('missing', descriptor, {
      localPath: path.join(tempDir, 'nonexistent_folder'),
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe('Directory not found');
  });

  it('fails verification when expected marker is missing in local directory', async () => {
    const descriptor: PluginConnectionDescriptor = {
      authType: 'local_path',
      usePkce: false,
      localPath: {
        kind: 'directory',
        label: 'My Vault',
        expectedMarker: '.missing_marker',
      },
    };

    const res = await service.verify('vault', descriptor, { localPath: tempDir });

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Missing expected marker');
  });

  it('verifies API key format when no remote endpoint is specified', async () => {
    const descriptor: PluginConnectionDescriptor = {
      authType: 'api_key',
      usePkce: false,
      apiKey: {
        label: 'API Key',
        placeholder: 'key_...',
      },
    };

    const res = await service.verify('stripe', descriptor, { apiKey: 'sk_live_123456789' });

    expect(res.ok).toBe(true);
    expect(res.details).toContain('without remote ping');
  });

  it('rejects an empty or suspiciously short API key', async () => {
    const descriptor: PluginConnectionDescriptor = {
      authType: 'api_key',
      usePkce: false,
      apiKey: {
        label: 'API Key',
        placeholder: 'key_...',
      },
    };

    const res = await service.verify('stripe', descriptor, { apiKey: 'ab' });

    expect(res.ok).toBe(false);
    expect(res.error).toBe('Invalid API key length');
  });

  it('verifies OAuth access token presence and validates without remote ping when userinfo is not defined', async () => {
    const descriptor: PluginConnectionDescriptor = {
      authType: 'oauth2',
      usePkce: true,
      oauth: {
        tokenUrl: 'https://oauth.example.com/token',
        scopes: ['read'],
      },
    };

    const validRes = await service.verify('oauth-target', descriptor, { token: 'gho_123456' });
    expect(validRes.ok).toBe(true);
    expect(validRes.details).toContain('without remote ping');

    const missingRes = await service.verify('oauth-target', descriptor, {});
    expect(missingRes.ok).toBe(false);
    expect(missingRes.error).toBe('Missing access token');
  });

  it('performs live remote verification when userinfoUrl is provided', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    try {
      const descriptor: PluginConnectionDescriptor = {
        authType: 'oauth2',
        usePkce: true,
        oauth: {
          tokenUrl: 'https://oauth.example.com/token',
          userinfoUrl: 'https://oauth.example.com/userinfo',
          scopes: ['read'],
        },
      };

      const res = await service.verify('oauth-target', descriptor, { token: 'gho_123456' });
      expect(res.ok).toBe(true);
      expect(res.details).toContain('verified against remote userinfo endpoint');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('implements Fail-open Option B when revokeUrl is undefined', async () => {
    const descriptor: PluginConnectionDescriptor = {
      authType: 'oauth2',
      usePkce: false,
      oauth: {
        tokenUrl: 'https://oauth.example.com/token',
        scopes: [],
      },
    };

    const res = await service.revoke('no-revoke-provider', descriptor, 'token-to-purge');

    expect(res.ok).toBe(true);
    expect(res.remoteRevoked).toBe(false);
    expect(res.auditNote).toContain('Local secret purged without remote revocation');
  });

  it('evaluates PKCE properly (only required when authorizationUrl is present)', () => {
    const authCodeDescriptor: PluginConnectionDescriptor = {
      authType: 'oauth2',
      usePkce: true,
      oauth: {
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        scopes: [],
      },
    };

    const clientCredentialsDescriptor: PluginConnectionDescriptor = {
      authType: 'oauth2',
      usePkce: true, // declared true, but client credentials flow has no authorizationUrl
      oauth: {
        tokenUrl: 'https://auth.example.com/token',
        scopes: [],
      },
    };

    const apiKeyDescriptor: PluginConnectionDescriptor = {
      authType: 'api_key',
      usePkce: false,
    };

    expect(service.evaluatePkce(authCodeDescriptor)).toBe(true);
    expect(service.evaluatePkce(clientCredentialsDescriptor)).toBe(false);
    expect(service.evaluatePkce(apiKeyDescriptor)).toBe(false);
  });
});
