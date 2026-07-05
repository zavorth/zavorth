describe('Network Security — Private IP Detection', () => {
  describe('IPv4 private ranges', () => {
    const privateRanges = [
      { range: '10.0.0.1', expected: true, label: 'Class A private' },
      { range: '10.255.255.255', expected: true, label: 'Class A private (end)' },
      { range: '172.16.0.1', expected: true, label: 'Class B private (start)' },
      { range: '172.31.255.255', expected: true, label: 'Class B private (end)' },
      { range: '192.168.0.1', expected: true, label: 'Class C private (start)' },
      { range: '192.168.255.255', expected: true, label: 'Class C private (end)' },
      { range: '127.0.0.1', expected: true, label: 'Loopback' },
      { range: '127.255.255.255', expected: true, label: 'Loopback (end)' },
      { range: '0.0.0.0', expected: true, label: 'Unspecified' },
      { range: '8.8.8.8', expected: false, label: 'Google DNS' },
      { range: '1.1.1.1', expected: false, label: 'Cloudflare DNS' },
      { range: '203.0.113.1', expected: false, label: 'Documentation range' },
    ];

    test.each(privateRanges)('$label ($range) should be ${expected ? "private" : "public"}', ({ range, expected }) => {
      const parts = range.split('.').map(Number);
      const isPrivate =
        parts[0] === 127 ||
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        parts[0] === 0;
      expect(isPrivate).toBe(expected);
    });
  });

  describe('URL security', () => {
    const testCases = [
      { url: 'http://localhost:3000', allowed: false, label: 'localhost' },
      { url: 'http://127.0.0.1:8080', allowed: false, label: 'loopback' },
      { url: 'http://192.168.1.1/api', allowed: false, label: 'private network' },
      { url: 'http://10.0.0.1/admin', allowed: false, label: 'private class A' },
      { url: 'https://api.openai.com/v1', allowed: true, label: 'OpenAI API' },
      { url: 'https://github.com', allowed: true, label: 'GitHub' },
    ];

    test.each(testCases)('$label ($url) should be ${allowed ? "allowed" : "blocked"}', ({ url, allowed }) => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        const isPrivate = /^127\./.test(host) ||
          /^10\./.test(host) ||
          /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
          /^192\.168\./.test(host) ||
          host === 'localhost' ||
          host === '0.0.0.0';
        expect(!isPrivate).toBe(allowed);
      } catch {
        expect(allowed).toBe(false);
      }
    });
  });
});
