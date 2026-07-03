import * as http from 'http';
import type { Socket } from 'net';
import type { ZavorthControlFacadeCompat } from './ZavorthControlServiceHelpers.js';

interface RuntimeStateWriter {
  write(data: { filePath: string; host: string; port: number; url: string; pid: number }): void;
  clear(filePath: string, pid: number): void;
}

interface LogRepository {
  log(level: string, context: string, message: string): void;
}

interface ResponseWriter {
  writeJson(res: http.ServerResponse, body: unknown, status: number): void;
}

interface WebAppService {
  handleUpgrade(req: http.IncomingMessage, socket: Socket, head: Buffer): boolean;
  start(): void;
  stop(): void;
}

export interface ZavorthControlServerService extends ZavorthControlFacadeCompat {
  isRunning: boolean;
  server: http.Server | null;
  stopping: Promise<void> | null;
  host: string;
  port: number;
  runtimeStateFile: string;
  runtimeState: RuntimeStateWriter;
  logRepo: LogRepository;
  responseWriter: ResponseWriter;
  webApp: WebAppService;
  openSockets: Set<Socket>;
  routeRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
}

export async function startZavorthControlService(service: ZavorthControlServerService): Promise<string> {
  if (service.isRunning) {
    return service.getUrl();
  }

  return new Promise((resolve, reject) => {
    service.server = http.createServer((req, res) => {
      Promise.resolve(service.routeRequest(req, res)).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        service.logRepo.log(
          'error',
          'ZavorthControlService',
          `HTTP failure in ZavorthControl: ${message}`,
        );
        service.responseWriter.writeJson(res, { error: 'Internal Server Error' }, 500);
      });
    });

    service.server.on('upgrade', (req: http.IncomingMessage, socket: Socket, head: Buffer) => {
      if (service.webApp.handleUpgrade(req, socket, head)) {
        return;
      }
      socket.destroy();
    });

    service.server.on('connection', (socket: Socket) => {
      service.openSockets.add(socket);
      socket.on('close', () => {
        service.openSockets.delete(socket);
      });
    });

    service.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        service.port += 1;
        service.server?.listen(service.port, service.host);
        return;
      }
      reject(err);
    });

    service.server.listen(service.port, service.host, () => {
      service.isRunning = true;
      service.runtimeState.write({
        filePath: service.runtimeStateFile,
        host: service.host,
        port: service.port,
        url: service.getUrl(),
        pid: process.pid,
      });
      service.webApp.start();
      resolve(service.getUrl());
    });
  });
}

export async function stopZavorthControlService(service: ZavorthControlServerService): Promise<void> {
  service.webApp.stop();
  if (service.stopping) {
    return service.stopping;
  }

  if (!service.server || !service.isRunning) {
    service.server = null;
    service.isRunning = false;
    service.runtimeState.clear(service.runtimeStateFile, process.pid);
    return;
  }

  const server = service.server;
  service.server = null;
  service.isRunning = false;
  service.stopping = new Promise<void>((resolve) => {
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    for (const socket of service.openSockets) {
      socket.destroy();
    }
    service.openSockets.clear();
    server.close(() => {
      server.unref?.();
      service.runtimeState.clear(service.runtimeStateFile, process.pid);
      service.stopping = null;
      resolve();
    });
    server.unref?.();
  });

  return service.stopping;
}
