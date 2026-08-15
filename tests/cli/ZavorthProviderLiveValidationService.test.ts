import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

import {
  validateZavorthProviderLive,
  writeZavorthProviderLiveValidationProof,
} from '../../src/cli/ZavorthProviderLiveValidationService';

describe('ZavorthProviderLiveValidationService', () => {
  it('does not run a provider call without explicit consent', async () => {
    let called = false;
    const result = await validateZavorthProviderLive({
      projectRoot: __dirname,
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash',
      providerSecret: 'sk-test-secret-value-123456',
      explicitUserConsent: false,
    }, {
      createProvider: (() => {
        called = true;
        throw new Error('should not create provider');
      }) as never,
      clearProviderCache: jest.fn(),
      now: () => new Date('2026-05-20T12:00:00.000Z'),
    });

    expect(called).toBe(false);
    expect(result.status).toBe('not-requested');
    expect(result.safety.networkCallPerformed).toBe(false);
  });

  it('temporarily injects env for a ping and restores it without leaking secrets', async () => {
    const original = process.env.GEMINI_API_KEY;
    const originalGoogle = process.env.GOOGLE_API_KEY;
    process.env.GEMINI_API_KEY = 'original-key';
    delete process.env.GOOGLE_API_KEY;
    const secret = 'AIzaTestSecretValue123456789012345';

    try {
      const result = await validateZavorthProviderLive({
        projectRoot: __dirname,
        providerId: 'gemini',
        modelId: 'gemini-2.5-flash',
        providerSecret: secret,
        explicitUserConsent: true,
      }, {
        createProvider: (() => ({
          chat: async () => {
            expect(process.env.GEMINI_API_KEY).toBe(secret);
            expect(process.env.GOOGLE_API_KEY).toBe(secret);
            return { content: 'pong', toolCalls: [] };
          },
        })) as never,
        clearProviderCache: jest.fn(),
        now: () => new Date('2026-05-20T12:00:00.000Z'),
      });

      expect(result.status).toBe('passed');
      expect(result.proof.responsePreview).toBe('pong');
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(result.safety.rawSecretInOutput).toBe(false);
      expect(result.safety.rawSecretInProof).toBe(false);
      expect(process.env.GEMINI_API_KEY).toBe('original-key');
      expect(process.env.GOOGLE_API_KEY).toBeUndefined();
    } finally {
      if (original === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = original;
      }
      if (originalGoogle === undefined) {
        delete process.env.GOOGLE_API_KEY;
      } else {
        process.env.GOOGLE_API_KEY = originalGoogle;
      }
    }
  });

  it('sanitizes failed validation proofs before writing them', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-proof-'));
    const secret = 'sk-test-provider-secret-123456789';
    try {
      const result = await validateZavorthProviderLive({
        projectRoot: tempDir,
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        providerSecret: secret,
        explicitUserConsent: true,
      }, {
        createProvider: (() => ({
          chat: async () => {
            throw new Error(`invalid key ${secret}`);
          },
        })) as never,
        clearProviderCache: jest.fn(),
        now: () => new Date('2026-05-20T12:00:00.000Z'),
      });

      expect(result.status).toBe('failed');
      expect(JSON.stringify(result)).not.toContain(secret);
      const write = writeZavorthProviderLiveValidationProof(tempDir, result);
      expect(write.written).toBe(true);
      expect(write.path).toBe(path.join(tempDir, 'data', 'runtime', 'provider-live-validation-proof.json'));
      const proof = readFileSync(write.path!, 'utf8');
      expect(proof).not.toContain(secret);
      expect(proof).toContain('"rawSecretInProof": false');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
