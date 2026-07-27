import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT } from 'jose';
import {
  AUTH_SESSION_AUDIENCE,
  AUTH_SESSION_ISSUER,
  createAuthSessionToken,
  readAuthSessionSecret,
  verifyAuthSessionToken,
} from '../../src/ai-gateway/shared/utils/authSession';

const secret = new TextEncoder().encode('z'.repeat(64));

test('auth session rejects missing and undersized signing secrets', () => {
  assert.equal(readAuthSessionSecret({} as NodeJS.ProcessEnv), null);
  assert.equal(readAuthSessionSecret({ JWT_SECRET: 'short' } as NodeJS.ProcessEnv), null);
  assert.equal(readAuthSessionSecret({ JWT_SECRET: 'x'.repeat(32) } as NodeJS.ProcessEnv)?.length, 32);
});

test('auth session signs and verifies bounded issuer and audience claims', async () => {
  const token = await createAuthSessionToken(secret);
  const payload = await verifyAuthSessionToken(token, secret);

  assert.equal(payload.authenticated, true);
  assert.equal(payload.iss, AUTH_SESSION_ISSUER);
  assert.equal(payload.aud, AUTH_SESSION_AUDIENCE);
  assert.ok((payload.exp || 0) > (payload.iat || 0));
});

test('auth session rejects mismatched identity and missing authentication claims', async () => {
  const wrongIssuer = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('other-product')
    .setAudience(AUTH_SESSION_AUDIENCE)
    .setExpirationTime('5m')
    .sign(secret);
  const wrongAudience = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(AUTH_SESSION_ISSUER)
    .setAudience('other-audience')
    .setExpirationTime('5m')
    .sign(secret);
  const missingClaim = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(AUTH_SESSION_ISSUER)
    .setAudience(AUTH_SESSION_AUDIENCE)
    .setExpirationTime('5m')
    .sign(secret);

  await assert.rejects(verifyAuthSessionToken(wrongIssuer, secret));
  await assert.rejects(verifyAuthSessionToken(wrongAudience, secret));
  await assert.rejects(verifyAuthSessionToken(missingClaim, secret), /authenticated session claim/);
});
