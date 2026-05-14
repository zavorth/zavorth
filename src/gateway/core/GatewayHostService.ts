import * as http from 'http';
import type { Socket } from 'net';
import { PublicApiRouter } from '../../api/public/PublicApiRouter.js';
import { GatewayRuntime } from './GatewayRuntime.js';

export type GatewayHostOptions = {
  host?: string;
  port?: number;
};

export class GatewayHostService {
  private server: http.Server | null = null;
  private readonly openSockets = new Set<Socket>();
  private listeningPort: number;
  private readonly host: string;

  constructor(
    private readonly runtime: GatewayRuntime,
    private readonly apiRouter: PublicApiRouter,
    options: GatewayHostOptions = {},
  ) {
    this.host = String(options.host || '127.0.0.1').trim() || '127.0.0.1';
    this.listeningPort = Number.isFinite(options.port) ? Number(options.port) : 3000;
  }

  public async start(): Promise<string> {
    if (this.server) {
      return this.getUrl();
    }

    await new Promise<void>((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        Promise.resolve(this.apiRouter.route(req, res)).catch((error) => {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : 'Internal gateway error',
              },
            }));
          }
        });
      });

      this.server.on('connection', (socket) => {
        this.openSockets.add(socket);
        socket.on('close', () => {
          this.openSockets.delete(socket);
        });
      });

      this.server.on('error', reject);

      this.server.listen(this.listeningPort, this.host, () => {
        if (this.host === '0.0.0.0' || this.host === '::') {
          console.warn('[GatewayHost] non-local bind enabled explicitly. Ensure auth, firewall, and network exposure are intended.');
        }
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.listeningPort = address.port;
        }
        resolve();
      });
    });

    return this.getUrl();
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = null;
    for (const socket of this.openSockets) {
      socket.destroy();
    }
    this.openSockets.clear();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  public getUrl(): string {
    const displayHost = this.host === '0.0.0.0' ? '127.0.0.1' : this.host;
    return `http://${displayHost}:${this.listeningPort}`;
  }
}
