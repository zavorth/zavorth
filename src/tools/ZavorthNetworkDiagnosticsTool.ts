import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';

export class ZavorthNetworkDiagnosticsTool extends BaseTool {
  public readonly name = 'zavorth_network_diagnostics';

  public readonly description =
    'Network diagnostics — traceroute, port scanning, DNS lookup, SSL/TLS certificate checks, network speed test, bandwidth monitoring, latency testing, and connection analysis.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'traceroute', 'port_scan', 'dns_lookup', 'ssl_check', 'speed_test', 'latency_test', 'bandwidth_monitor', 'mtr', 'dig', 'curl_debug', 'tcp_check', 'http_headers'.",
      },
      host: {
        type: 'string',
        description: 'Target host or IP address.',
      },
      port: {
        type: 'number',
        description: 'Target port number.',
      },
      ports: {
        type: 'string',
        description: "Port range for scanning (e.g., '80,443,8080' or '1-1024').",
      },
      domain: {
        type: 'string',
        description: 'Domain name for DNS/SSL operations.',
      },
      url: {
        type: 'string',
        description: 'Full URL for HTTP operations.',
      },
      record_type: {
        type: 'string',
        description: "DNS record type: 'A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'SRV'. Default: 'A'.",
      },
      timeout_ms: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 10000.',
      },
      count: {
        type: 'number',
        description: 'Number of packets/requests. Default: 4.',
      },
      max_hops: {
        type: 'number',
        description: 'Max hops for traceroute. Default: 30.',
      },
      duration_sec: {
        type: 'number',
        description: 'Duration for bandwidth monitoring. Default: 10.',
      },
      output_format: {
        type: 'string',
        description: "Output format: 'text', 'json'. Default: 'text'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'traceroute': return await this.traceroute(args);
      case 'port_scan': return await this.portScan(args);
      case 'dns_lookup': return await this.dnsLookup(args);
      case 'ssl_check': return await this.sslCheck(args);
      case 'speed_test': return await this.speedTest(args);
      case 'latency_test': return await this.latencyTest(args);
      case 'bandwidth_monitor': return await this.bandwidthMonitor(args);
      case 'mtr': return await this.mtr(args);
      case 'dig': return await this.dig(args);
      case 'curl_debug': return await this.curlDebug(args);
      case 'tcp_check': return await this.tcpCheck(args);
      case 'http_headers': return await this.httpHeaders(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runCmd(cmd: string, cmdArgs: string[], timeout = 30000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync(cmd, cmdArgs, {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async traceroute(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    const maxHops = Number(args.max_hops || 30);

    try {
      const { execFileSync } = await import('child_process');
      if (process.platform === 'win32') {
        const result = execFileSync('tracert', ['-d', '-h', String(maxHops), host], { timeout: 60000 }).toString();
        return `Traceroute to ${host}:\n${result.slice(0, 3000)}`;
      } else {
        const result = execFileSync('traceroute', ['-n', '-m', String(maxHops), host], { timeout: 60000 }).toString();
        return `Traceroute to ${host}:\n${result.slice(0, 3000)}`;
      }
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async portScan(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    const portsStr = String(args.ports || '21,22,25,53,80,110,143,443,993,995,3306,3389,5432,6379,8080,8443,27017');
    const ports = portsStr.includes('-')
      ? Array.from({ length: safeParseInt(portsStr.split('-')[1], 0) - safeParseInt(portsStr.split('-')[0], 0) + 1 }, (_, i) => safeParseInt(portsStr.split('-')[0], 0) + i)
      : portsStr.split(',').map(p => safeParseInt(p.trim(), 0));

    const timeout = Number(args.timeout_ms || 3000);
    const openPorts: number[] = [];
    const closedPorts: number[] = [];

    try {
      const { execFileSync } = await import('child_process');

      for (const port of ports.slice(0, 50)) {
        try {
          if (process.platform === 'win32') {
            execFileSync('powershell', ['-Command', `(New-Object System.Net.Sockets.TcpClient).ConnectAsync('${host}', ${port}).Wait(${timeout})`], { timeout: timeout + 1000 });
          } else {
            execFileSync('nc', ['-z', '-w', String(Math.ceil(timeout / 1000)), host, String(port)], { timeout: timeout + 1000 });
          }
          openPorts.push(port);
        } catch (error: any) {
          closedPorts.push(port);
        }
      }

      const serviceMap: Record<number, string> = {
        21: 'FTP', 22: 'SSH', 25: 'SMTP', 53: 'DNS', 80: 'HTTP',
        110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 993: 'IMAPS', 995: 'POP3S',
        3306: 'MySQL', 3389: 'RDP', 5432: 'PostgreSQL', 6379: 'Redis',
        8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 27017: 'MongoDB',
      };

      return [
        `Port scan for ${host}:`,
        '',
        `Open ports (${openPorts.length}):`,
        ...openPorts.map(p => `  ${p} ${serviceMap[p] || ''}`),
        '',
        `Closed ports (${closedPorts.length}):`,
        ...closedPorts.map(p => `  ${p} ${serviceMap[p] || ''}`),
      ].join('\n');
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] network request failed', error); return ''; }
  }

  private async dnsLookup(args: Record<string, unknown>): Promise<string> {
    const domain = String(args.domain || args.host || '');
    if (!domain) return 'Error: "domain" is required.';

    const recordType = String(args.record_type || 'A');

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('nslookup', ['-type=' + recordType, domain], { timeout: 10000 }).toString();
      return `DNS lookup (${recordType}) for ${domain}:\n${result}`;
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async sslCheck(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || args.domain || '');
    if (!host) return 'Error: "host" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const port = args.port ? String(args.port) : '443';
      const result = execFileSync('openssl', ['s_client', '-connect', `${host}:${port}`, '-servername', host], {
        timeout: 15000,
        input: '',
      }).toString();

      const subject = result.match(/subject=.*CN\s*=\s*([^\n]+)/)?.[1] || 'unknown';
      const issuer = result.match(/issuer=.*CN\s*=\s*([^\n]+)/)?.[1] || 'unknown';
      const notBefore = result.match(/Not Before\s*:\s*(.+)/)?.[1]?.trim() || 'unknown';
      const notAfter = result.match(/Not After\s*:\s*(.+)/)?.[1]?.trim() || 'unknown';
      const protocol = result.match(/Protocol\s*:\s*(\S+)/)?.[1] || 'unknown';
      const cipher = result.match(/Cipher\s*:\s*(\S+)/)?.[1] || 'unknown';
      const san = result.match(/DNS:([^\n,]+)/g)?.map(s => s.replace('DNS:', '').trim()) || [];

      const expiryDate = new Date(notAfter);
      const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return [
        `SSL/TLS Certificate for ${host}:${port}:`,
        `  Subject: ${subject}`,
        `  Issuer: ${issuer}`,
        `  Valid from: ${notBefore}`,
        `  Expires: ${notAfter} (${daysLeft} days)`,
        `  Protocol: ${protocol}`,
        `  Cipher: ${cipher}`,
        `  SANs: ${san.join(', ') || 'none detected'}`,
        daysLeft < 30 ? `  ⚠️ Certificate expires in ${daysLeft} days!` : '',
      ].filter(Boolean).join('\n');
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] validation failed', error); return ''; }
  }

  private async speedTest(args: Record<string, unknown>): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      try {
        const result = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{speed_download}', '--max-time', '10', 'https://speed.cloudflare.com/__down?bytes=10000000'], { timeout: 15000 }).toString();
        const speedMbps = (parseFloat(result.trim()) * 8 / 1000000).toFixed(2);
        return `Download speed: ${speedMbps} Mbps (Cloudflare test)`;
      } catch (error: any) {
    logger.warn('[Zavorth Network Diagnostics] network request failed', error);
    const result = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', 'Speed: %{speed_download} bytes/sec\nTime: %{time_total}s\nSize: %{size_download} bytes', '--max-time', '10', 'https://speed.hetzner.de/100MB.bin'], { timeout: 15000 }).toString();
        return `Speed test result:\n${result}`;
  }
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] network request failed', error); return ''; }
  }

  private async latencyTest(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    const count = Number(args.count || 10);

    try {
      const { execFileSync } = await import('child_process');
      const pingArgs = process.platform === 'win32'
        ? ['-n', String(count), host]
        : ['-c', String(count), host];

      const result = execFileSync('ping', pingArgs, { timeout: 30000 }).toString();

      const avgMatch = result.match(/Average = (\d+)ms/i) || result.match(/avg[\/=]\s*([\d.]+)/i);
      const avg = avgMatch ? avgMatch[1] : 'unknown';

      return `Latency test to ${host} (${count} packets):\n${result}\nAverage latency: ${avg}ms`;
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async bandwidthMonitor(args: Record<string, unknown>): Promise<string> {
    const duration = Number(args.duration_sec || 10);

    try {
      const { execFileSync } = await import('child_process');

      if (process.platform === 'win32') {
        const result = execFileSync('powershell', ['-Command', `Get-NetAdapterStatistics | Select-Object Name, ReceivedBytes, SentBytes | Format-Table -AutoSize`], { timeout: 10000 }).toString();
        return `Network adapter statistics:\n${result}`;
      } else {
        const result = execFileSync('ifstat', ['-b', '-n', '1', String(duration)], { timeout: (duration + 5) * 1000 }).toString();
        return `Bandwidth monitor (${duration}s):\n${result.slice(0, 2000)}`;
      }
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async mtr(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    if (!host) return 'Error: "host" is required.';

    const count = Number(args.count || 10);

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('mtr', ['--report', '--report-cycles', String(count), host], { timeout: 60000 }).toString();
      return `MTR report for ${host}:\n${result.slice(0, 3000)}`;
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async dig(args: Record<string, unknown>): Promise<string> {
    const domain = String(args.domain || args.host || '');
    if (!domain) return 'Error: "domain" is required.';

    const recordType = String(args.record_type || 'ANY');

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('dig', [domain, recordType, '+noall', '+answer', '+authority'], { timeout: 10000 }).toString();
      return `DIG ${recordType} ${domain}:\n${result}`;
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async curlDebug(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', ['-v', '-s', '-o', '/dev/null', '--max-time', '15', url], {
        timeout: 20000,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      return `CURL debug for ${url}:\n${result.slice(0, 5000)}`;
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async tcpCheck(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    const port = Number(args.port || 0);
    if (!host || !port) return 'Error: "host" and "port" are required.';

    const timeout = Number(args.timeout_ms || 5000);

    try {
      const { execFileSync } = await import('child_process');
      if (process.platform === 'win32') {
        const result = execFileSync('powershell', ['-Command', `$tcp = New-Object System.Net.Sockets.TcpClient; $result = $tcp.ConnectAsync('${host}', ${port}).Wait(${timeout}); if ($result) { "OPEN" } else { "CLOSED/TIMEOUT" }; $tcp.Close()`], { timeout: timeout + 2000 }).toString();
        return `TCP ${host}:${port} is ${result.trim()}`;
      } else {
        execFileSync('nc', ['-z', '-w', String(Math.ceil(timeout / 1000)), host, String(port)], { timeout: timeout + 1000 });
        return `TCP ${host}:${port} is OPEN`;
      }
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] process execution failed', error); return ''; }
  }

  private async httpHeaders(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required.`';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', ['-s', '-I', '-L', '--max-time', '15', url], { timeout: 20000 }).toString();
      return `HTTP headers for ${url}:\n${result}`;
    } catch (error: any) { logger.warn('[Zavorth Network Diagnostics] network request failed', error); return ''; }
  }
}
