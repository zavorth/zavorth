import { LocalOAuthCallbackServer } from '../../../src/services/connection/LocalOAuthCallbackServer.js';

describe('LocalOAuthCallbackServer', () => {
  let serverService: LocalOAuthCallbackServer;

  beforeEach(() => {
    serverService = new LocalOAuthCallbackServer({
      timeoutMs: 2000,
    });
  });

  it('generates a 64-character hexadecimal random state string', () => {
    const state1 = serverService.generateState();
    const state2 = serverService.generateState();

    expect(typeof state1).toBe('string');
    expect(state1.length).toBe(64);
    expect(state1).not.toBe(state2);
  });

  it('starts on an ephemeral loopback port and accepts valid callback', async () => {
    const instance = await serverService.start();

    expect(instance.port).toBeGreaterThan(0);
    expect(instance.redirectUri).toBe(`http://127.0.0.1:${instance.port}/oauth/callback`);

    // Simulate browser redirect to callback with code & state
    const callbackUrl = `${instance.redirectUri}?code=auth_code_12345&state=${instance.state}`;
    const fetchPromise = fetch(callbackUrl);

    const result = await instance.waitForCallback();
    expect(result.code).toBe('auth_code_12345');
    expect(result.state).toBe(instance.state);

    const httpResponse = await fetchPromise;
    expect(httpResponse.status).toBe(200);
    const html = await httpResponse.text();
    expect(html).toContain('Authorization Successful');
  });

  it('rejects callback with mismatched state (CSRF defense)', async () => {
    const instance = await serverService.start();

    const attackUrl = `${instance.redirectUri}?code=malicious_code&state=forged_state_parameter`;
    const fetchPromise = fetch(attackUrl);

    await expect(instance.waitForCallback()).rejects.toThrow('OAuth state mismatch');

    const httpResponse = await fetchPromise;
    expect(httpResponse.status).toBe(403);
    const html = await httpResponse.text();
    expect(html).toContain('CSRF protection blocked this request');
  });

  it('rejects callback when provider returns error parameter', async () => {
    const instance = await serverService.start();

    const errorUrl = `${instance.redirectUri}?error=access_denied&error_description=User+declined+permission&state=${instance.state}`;
    const fetchPromise = fetch(errorUrl);

    await expect(instance.waitForCallback()).rejects.toThrow('User declined permission');

    const httpResponse = await fetchPromise;
    expect(httpResponse.status).toBe(400);
  });

  it('auto-closes and rejects when callback times out', async () => {
    const shortTimeoutServer = new LocalOAuthCallbackServer({
      timeoutMs: 150,
    });

    const instance = await shortTimeoutServer.start();
    await expect(instance.waitForCallback()).rejects.toThrow('timed out after 0.15 seconds');
  });

  it('supports explicit stop cleanly', async () => {
    const instance = await serverService.start();
    await instance.stop();

    // Verify port is freed
    await expect(fetch(instance.redirectUri)).rejects.toThrow();
  });
});
