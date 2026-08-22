import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';

export class ZavorthNetworkTool extends BaseTool {
  public readonly name = 'zavorth_network';

  public readonly description =
    'Network diagnostics — DNS lookup, port scanning, certificate checking, ping, traceroute, WHOIS.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'dns_lookup', 'port_scan', 'cert_check', 'ping', 'traceroute', 'whois', 'http_check'.",
      },
      host: {
        type: 'string',
        description: 'Target host or IP.',
      },
      port: {
        type: 'number',
        description: 'Target port (for port_scan, cert_check).',
      },
      ports: {
        type: 'string',
        description: "Port range for scan (e.g., '80,443,8080' or '1-1024').",
      },
      domain: {
        type: 'string',
        description: 'Domain for WHOIS lookup.',
      },
      url: {
        type: 'string',
        description: 'URL for HTTP health check.',
      },
      timeout_ms: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 10000.',
      },
      record_type: {
        type: 'string',
        description: "DNS record type: 'A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS'. Default: 'A'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'dns_lookup': return await this.dnsLookup(args);
      case 'port_scan': return await this.portScan(args);
      case 'cert_check': return await this.certCheck(args);
      case 'ping': return await this.ping(args);
      case 'traceroute': return await this.traceroute(args);
      case 'whois': return await this.whois(args);
      case 'http_check': return await this.httpCheck(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async dnsLookup(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    const recordType = String(args.record_type || 'A');

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('nslookup', ['-type=' + recordType, host], { timeout: 10000 }).toString();
      return `DNS lookup (${recordType}) for ${host}:\n${result}`;
    } catch (error: unknown) {logger.warn('[Zavorth Network] process execution failed', error); return `Error: DNS lookup failed for ${host}: ${String(error)}`; }
  }

  private async portScan(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    const portsStr = String(args.ports || '80,443,22,8080,3000,5432,6379,27017');
    const ports = portsStr.includes('-')
      ? Array.from({ length: safeParseInt(portsStr.split('-')[1], 0) - safeParseInt(portsStr.split('-')[0], 0) + 1 }, (_, i) => safeParseInt(portsStr.split('-')[0], 0) + i)
      : portsStr.split(',').map((p) => safeParseInt(p.trim(), 0));

    const { execFileSync } = await import('child_process');
    const openPorts: number[] = [];
    const closedPorts: number[] = [];

    for (const port of ports.slice(0, 20)) {
      try {
        execFileSync('powershell', ['-Command', `Test-NetConnection -ComputerName ${host} -Port ${port} -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded`], { timeout: 5000 });
        openPorts.push(port);
      } catch (error: unknown) {closedPorts.push(port);
      }
    }

    return [
      `Port scan for ${host}:`,
      `  Open: ${openPorts.join(', ') || 'none'}`,
      `  Closed: ${closedPorts.join(', ') || 'none'}`,
    ].join('\n');
  }

  private async certCheck(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('openssl', ['s_client', '-connect', `${host}:443`, '-servername', host], {
        timeout: 10000,
        input: '',
      }).toString();

      const certMatch = result.match(/subject=.*CN\s*=\s*([^\n]+)/);
      const issuerMatch = result.match(/issuer=.*CN\s*=\s*([^\n]+)/);
      const expiryMatch = result.match(/Not After\s*:\s*(.+)/);

      return [
        `Certificate for ${host}:`,
        `  Subject: ${certMatch ? certMatch[1] : 'unknown'}`,
        `  Issuer: ${issuerMatch ? issuerMatch[1] : 'unknown'}`,
        `  Expires: ${expiryMatch ? expiryMatch[1].trim() : 'unknown'}`,
      ].join('\n');
    } catch (error: unknown) {logger.warn('[Zavorth Network] operation failed', error); return `Error: certificate check failed for ${host}: ${String(error)}`; }
  }

  private async ping(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const pingCmd = process.platform === 'win32' ? 'ping' : 'ping';
      const pingArgs = process.platform === 'win32' ? ['-n', '4', host] : ['-c', '4', host];
      const result = execFileSync(pingCmd, pingArgs, { timeout: 15000 }).toString();
      return `Ping ${host}:\n${result}`;
    } catch (error: unknown) {logger.warn('[Zavorth Network] process execution failed', error); return `Error: ping failed for ${host}: ${String(error)}`; }
  }

  private async traceroute(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const cmd = process.platform === 'win32' ? 'tracert' : 'traceroute';
      const result = execFileSync(cmd, ['-d', host], { timeout: 30000 }).toString();
      return `Traceroute ${host}:\n${result.slice(0, 2000)}`;
    } catch (error: unknown) {logger.warn('[Zavorth Network] process execution failed', error); return `Error: traceroute failed for ${host}: ${String(error)}`; }
  }

  private async whois(args: Record<string, unknown>): Promise<string> {
    const domain = String(args.domain || args.host || '');
    if (!domain) return 'Error: "domain" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('whois', [domain], { timeout: 15000 }).toString();
      return `WHOIS ${domain}:\n${result.slice(0, 2000)}`;
    } catch (error: unknown) {logger.warn('[Zavorth Network] process execution failed', error); return `Error: whois failed for ${domain}: ${String(error)}`; }
  }

  private async httpCheck(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', [
        '-s', '-o', '/dev/null',
        '-w', 'HTTP %{http_code}\nTime: %{time_total}s\nSize: %{size_download} bytes\nRedirects: %{num_redirects}',
        '--max-time', '10',
        url,
      ], { timeout: 15000 }).toString();

      return `HTTP check ${url}:\n${result}`;
    } catch (error: unknown) {logger.warn('[Zavorth Network] network request failed', error); return `Error: HTTP check failed for ${url}: ${String(error)}`; }
  }
}
