import { UrlSafetyService } from '../../src/security/UrlSafetyService.js';

describe('UrlSafetyService Combinatorial Matrix Tests', () => {
  const schemes = ['http://', 'https://', 'ftp://', 'file://'];
  const auths = ['', 'admin:supersecret@'];
  
  const hosts = [
    { ip: '1.1.1.1', type: 'public', expectedSafe: true },
    { ip: '8.8.8.8', type: 'public', expectedSafe: true },
    { ip: '10.0.0.1', type: 'private', expectedSafe: false },
    { ip: '172.16.5.5', type: 'private', expectedSafe: false },
    { ip: '192.168.1.100', type: 'private', expectedSafe: false },
    { ip: '100.64.0.1', type: 'private', expectedSafe: false }, // CGNAT
    { ip: '169.254.169.254', type: 'metadata', expectedSafe: false },
    { ip: '169.254.170.2', type: 'metadata', expectedSafe: false },
    { ip: '224.0.0.5', type: 'private', expectedSafe: false }, // Multicast (RFC1918 adjacent)
    { ip: '127.0.0.1', type: 'loopback', expectedSafe: true }, // Localhost is allowed by design
    { ip: '[::1]', type: 'loopback', expectedSafe: true },
    { ip: '[fe80::1]', type: 'link-local', expectedSafe: false },
    { ip: '[::ffff:169.254.169.254]', type: 'metadata', expectedSafe: false }
  ];

  const ports = ['', ':80', ':443', ':8080'];
  const paths = ['', '/v1/meta', '?foo=bar#baz'];

  const blockPrivateFlags = [true, false];
  const blockMetadataFlags = [true, false];
  const blockLinkLocalFlags = [true, false];

  let testCount = 0;

  blockPrivateFlags.forEach((blockPrivate) => {
    blockMetadataFlags.forEach((blockMetadata) => {
      blockLinkLocalFlags.forEach((blockLinkLocal) => {
        describe(`Config [Priv:${blockPrivate} Meta:${blockMetadata} LinkLocal:${blockLinkLocal}]`, () => {
          const service = new UrlSafetyService({
            blockPrivateRanges: blockPrivate,
            blockCloudMetadata: blockMetadata,
            blockLinkLocal: blockLinkLocal
          });

          hosts.forEach((host) => {
            schemes.forEach((scheme) => {
              auths.forEach((auth) => {
                ports.forEach((port) => {
                  paths.forEach((path) => {
                    const url = `${scheme}${auth}${host.ip}${port}${path}`;
                    testCount++;

                    it(`validates URL: ${url}`, async () => {
                      const result = await service.checkUrl(url);

                      // If scheme is not http/https, it should strictly block immediately
                      if (scheme !== 'http://' && scheme !== 'https://') {
                        expect(result.safe).toBe(false);
                        expect(['Unsupported protocol', 'Invalid URL'].some(s => result.reason?.includes(s))).toBe(true);
                        return;
                      }

                      // Evaluate dynamic safety based on config
                      let isSafe = host.expectedSafe;

                      // Config overwrites
                      if (host.type === 'private' && !blockPrivate) {
                        isSafe = true;
                      }
                      if (host.type === 'metadata') {
                        if (!blockMetadata) {
                          isSafe = true;
                        }
                        // Metadata IPs (169.254.*) fall under IPv4 link-local range.
                        // If blockPrivate and blockLinkLocal are true, it will be blocked by that rule anyway.
                        if (!blockMetadata && blockPrivate && blockLinkLocal && host.ip.includes('169.254')) {
                          isSafe = false;
                        }
                      }
                      if (host.type === 'link-local' && !blockLinkLocal) {
                        isSafe = true;
                      }

                      // We expect the result to match the calculated safety
                      expect(result.safe).toBe(isSafe);

                      if (!isSafe) {
                        expect(result.reason).toBeTruthy();
                        if (host.type === 'metadata' && blockMetadata) {
                          expect(result.reason).toContain('Cloud metadata');
                        }
                      }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  it('sanity checks total permutations for UrlSafetyMatrix', () => {
    // 2 * 2 * 2 * 13 * 4 * 2 * 4 * 3 = 9984 tests!
    expect(testCount).toBe(9984);
  });
});
