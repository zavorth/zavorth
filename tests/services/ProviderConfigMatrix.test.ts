import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { Database } from '../../src/storage/Database';

jest.mock('../../src/storage/Database');

describe('ProviderConfigService - Combinatorial Base URL Validation Matrix Tests', () => {
  let service: ProviderConfigService;

  beforeEach(() => {
    service = ProviderConfigService.getInstance();
  });

  const schemes = ['http://', 'https://', 'file://', 'ftp://', 'invalid-scheme'];
  const hostnames = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    '127.0.0.9',
    '192.168.1.5',
    '192.168.0.1',
    '10.0.0.12',
    'api.openai.com',
    'custom.domain.org'
  ];
  const localFlags = [true, false];
  const credentialFlags = [true, false];
  const queries = ['', '?model=gpt-4', '?token=xyz', '?key=123', '?auth=admin', '?api_key=999'];
  const trailingSlashes = [true, false];

  for (const scheme of schemes) {
    for (const hostname of hostnames) {
      for (const isLocal of localFlags) {
        for (const hasCredentials of credentialFlags) {
          for (const query of queries) {
            for (const trailingSlash of trailingSlashes) {
              
              const authPart = hasCredentials ? 'user:pass@' : '';
              const pathPart = '/v1' + (trailingSlash ? '/' : '');
              const url = `${scheme}${authPart}${hostname}${pathPart}${query}`;

              it(`should validate URL: scheme=${scheme}, host=${hostname}, isLocal=${isLocal}, auth=${hasCredentials}, query=${query}, slash=${trailingSlash}`, () => {
                let shouldThrow = false;

                // Check if JS URL parser would reject it
                let isUrlParsable = true;
                try {
                  new URL(url);
                } catch {
                  isUrlParsable = false;
                }

                if (!isUrlParsable) {
                  shouldThrow = true;
                } else {
                  const parsed = new URL(url);
                  if (parsed.protocol === 'file:') {
                    shouldThrow = true;
                  } else if (parsed.username || parsed.password || hasCredentials) {
                    shouldThrow = true;
                  } else if (
                    query.toLowerCase().includes('token=') ||
                    query.toLowerCase().includes('key=') ||
                    query.toLowerCase().includes('auth=') ||
                    query.toLowerCase().includes('api_key=')
                  ) {
                    shouldThrow = true;
                  } else if (isLocal) {
                    if (scheme !== 'http://' && scheme !== 'https://') {
                      shouldThrow = true;
                    } else {
                      const allowedLocals = ['localhost', '127.0.0.1', '[::1]'];
                      if (!allowedLocals.includes(hostname)) {
                        shouldThrow = true;
                      }
                    }
                  } else {
                    // remote provider
                    if (scheme !== 'https://') {
                      shouldThrow = true;
                    } else {
                      const isPrivateOrLocal =
                        hostname === 'localhost' ||
                        hostname === '127.0.0.1' ||
                        hostname === '[::1]' ||
                        hostname.startsWith('192.168.') ||
                        hostname.startsWith('10.');
                      if (isPrivateOrLocal) {
                        shouldThrow = true;
                      }
                    }
                  }
                }

                if (shouldThrow) {
                  expect(() => service.validateBaseUrl(url, isLocal)).toThrow();
                } else {
                  const result = service.validateBaseUrl(url, isLocal);
                  // Result should be normalized (no trailing slash)
                  const expectedUrlStr = new URL(url).toString();
                  const expectedNormalized = expectedUrlStr.endsWith('/') ? expectedUrlStr.slice(0, -1) : expectedUrlStr;
                  expect(result).toBe(expectedNormalized);
                }
              });
            }
          }
        }
      }
    }
  }
});
