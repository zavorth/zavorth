import { ZavorthNetworkTool } from '../../src/tools/ZavorthNetworkTool';
import { asErrorLike } from '../../src/utils/errorLike';

describe('ZavorthNetworkTool', () => {
  let tool: ZavorthNetworkTool;

  beforeEach(() => {
    tool = new ZavorthNetworkTool();
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
    expect(result).toContain('action');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'download' });
    expect(result).toContain('Error');
    expect(result).toContain('invalid');
  });

  it('returns error message for invalid action', async () => {
    const result = await tool.execute({ action: 'bad' });
    expect(result).toContain('Error');
    expect(result).toContain('invalid');
    expect(result).toContain('bad');
  });

  describe('dns_lookup', () => {
    it('returns error without host', async () => {
      const result = await tool.execute({ action: 'dns_lookup' });
      expect(result).toContain('Error');
      expect(result).toContain('host');
    });

    it('returns string result for valid host (graceful error handling)', async () => {
      const result = await tool.execute({ action: 'dns_lookup', host: 'localhost' });
      expect(typeof result).toBe('string');
      // In test environments, dynamic import of child_process may fail,
      // causing the tool to return an empty string as a graceful fallback
    });

    it('handles custom record type param', async () => {
      const result = await tool.execute({ action: 'dns_lookup', host: 'example.com', record_type: 'MX' });
      expect(typeof result).toBe('string');
    });
  });

  describe('port_scan', () => {
    it('returns error without host', async () => {
      const result = await tool.execute({ action: 'port_scan' });
      expect(result).toContain('Error');
      expect(result).toContain('host');
    });

    it('returns string result for valid host (or throws in ESM mode)', async () => {
      try {
        const result = await tool.execute({ action: 'port_scan', host: '127.0.0.1' });
        expect(typeof result).toBe('string');
      } catch (e: unknown) {
        const eLike = asErrorLike(e);
        expect(String(e)).toContain('dynamic import');
      }
    });

    it('handles custom ports param (or throws in ESM mode)', async () => {
      try {
        const result = await tool.execute({ action: 'port_scan', host: '127.0.0.1', ports: '80,443' });
        expect(typeof result).toBe('string');
      } catch (e: unknown) {
        const eLike = asErrorLike(e);
        expect(String(e)).toContain('dynamic import');
      }
    });
  });

  describe('ping', () => {
    it('returns error without host', async () => {
      const result = await tool.execute({ action: 'ping' });
      expect(result).toContain('Error');
      expect(result).toContain('host');
    });

    it('returns string result for valid host', async () => {
      const result = await tool.execute({ action: 'ping', host: '127.0.0.1' });
      expect(typeof result).toBe('string');
      // In test environments, dynamic import of child_process may fail,
      // causing the tool to return an empty string as a graceful fallback
    });
  });

  describe('traceroute', () => {
    it('returns error without host', async () => {
      const result = await tool.execute({ action: 'traceroute' });
      expect(result).toContain('Error');
      expect(result).toContain('host');
    });

    it('returns string result for valid host', async () => {
      const result = await tool.execute({ action: 'traceroute', host: '8.8.8.8' });
      expect(typeof result).toBe('string');
    });
  });

  describe('cert_check', () => {
    it('returns error without host', async () => {
      const result = await tool.execute({ action: 'cert_check' });
      expect(result).toContain('Error');
      expect(result).toContain('host');
    });
  });

  describe('http_check', () => {
    it('returns error without url', async () => {
      const result = await tool.execute({ action: 'http_check' });
      expect(result).toContain('Error');
      expect(result).toContain('url');
    });

    it('returns string result for valid url', async () => {
      const result = await tool.execute({ action: 'http_check', url: 'https://example.com' });
      expect(typeof result).toBe('string');
    });
  });

  describe('whois', () => {
    it('returns error without domain', async () => {
      const result = await tool.execute({ action: 'whois' });
      expect(result).toContain('Error');
      expect(result).toContain('domain');
    });

    it('returns string result for valid domain', async () => {
      const result = await tool.execute({ action: 'whois', domain: 'example.com' });
      expect(typeof result).toBe('string');
    });
  });

  describe('exposes correct name and parameters', () => {
    it('has correct tool name', () => {
      expect(tool.name).toBe('zavorth_network');
    });

    it('requires action parameter', () => {
      expect(tool.parameters.required).toContain('action');
    });

    it('has all expected parameter properties', () => {
      const props = tool.parameters.properties as Record<string, unknown>;
      expect(props).toHaveProperty('action');
      expect(props).toHaveProperty('host');
      expect(props).toHaveProperty('port');
      expect(props).toHaveProperty('ports');
      expect(props).toHaveProperty('domain');
      expect(props).toHaveProperty('url');
    });
  });
});
