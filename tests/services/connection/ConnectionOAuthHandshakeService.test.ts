import * as crypto from 'node:crypto';
import { ConnectionOAuthHandshakeService } from '../../../src/services/connection/ConnectionOAuthHandshakeService.js';
import { LocalOAuthCallbackServer } from '../../../src/services/connection/LocalOAuthCallbackServer.js';
import type { PluginConnectionDescriptor } from '../../../src/contracts/connection/index.js';

describe('ConnectionOAuthHandshakeService', () => {
  let handshakeService: ConnectionOAuthHandshakeService;

  beforeEach(() => {
    handshakeService = new ConnectionOAuthHandshakeService({
      callbackServer: new LocalOAuthCallbackServer({ timeoutMs: 1500 }),
    });
  });

  it('generates a valid RFC 7636 PKCE code verifier (43 chars base64url)', () => {
    const verifier1 = handshakeService.generateCodeVerifier();
    const verifier2 = handshakeService.generateCodeVerifier();

    expect(typeof verifier1).toBe('string');
    expect(verifier1.length).toBe(43);
    // RFC 7636 unreserved chars
    expect(verifier1).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier1).not.toBe(verifier2);
  });

  it('generates an RFC 7636 S256 code challenge from a verifier', () => {
    const verifier = 'test_verifier_string_123456789012345678901234';
    const expected = crypto.createHash('sha256').update(verifier).digest('base64url');

    const challenge = handshakeService.generateCodeChallenge(verifier);
    expect(challenge).toBe(expected);
  });

  it('prepares Authorization Code flow URL with PKCE parameters and loopback server', async () => {
    const descriptor: PluginConnectionDescriptor = {
      authType: 'oauth2',
      usePkce: true,
      oauth: {
        authorizationUrl: 'https://auth.example.com/oauth/authorize',
        tokenUrl: 'https://auth.example.com/oauth/token',
        scopes: ['read:profile', 'repo'],
      },
    };

    const flow = await handshakeService.prepareAuthCodeFlow(
      'claude',
      descriptor,
      'test-client-id-123'
    );

    expect(flow.serverInstance).toBeDefined();
    expect(flow.codeVerifier).toBeDefined();

    const parsed = new URL(flow.authorizationUrl);
    expect(parsed.origin).toBe('https://auth.example.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id-123');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe(flow.serverInstance.state);
    expect(parsed.searchParams.get('scope')).toBe('read:profile repo');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBe(
      handshakeService.generateCodeChallenge(flow.codeVerifier)
    );

    // Clean up server
    await flow.serverInstance.stop();
  });

  it('throws error when preparing flow for descriptor without authorizationUrl', async () => {
    const invalidDescriptor: PluginConnectionDescriptor = {
      authType: 'oauth2',
      usePkce: true,
      oauth: {
        tokenUrl: 'https://auth.example.com/token',
        scopes: [],
      },
    };

    await expect(
      handshakeService.prepareAuthCodeFlow('no-auth-url', invalidDescriptor, 'client-id')
    ).rejects.toThrow('missing authorizationUrl');
  });

  it('throws error when initiating device code flow without deviceCodeUrl', async () => {
    const descriptor: PluginConnectionDescriptor = {
      authType: 'oauth2',
      usePkce: false,
      oauth: {
        tokenUrl: 'https://auth.example.com/token',
        scopes: [],
      },
    };

    await expect(
      handshakeService.initiateDeviceCodeFlow('no-device-url', descriptor, 'client-id')
    ).rejects.toThrow('does not declare a deviceCodeUrl');
  });
});
