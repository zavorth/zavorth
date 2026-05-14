import * as http from 'http';

export async function startDashboardService(service: any): Promise<string> {
  if (service.isRunning) {
    return service.getUrl();
  }

  return new Promise((resolve, reject) => {
    service.server = http.createServer((req, res) => {
      Promise.resolve(service.routeRequest(req, res)).catch((error: any) => {
        service.logRepo.log(
          'error',
          'DashboardService',
          `Falha HTTP no Dashboard: ${error?.message || error}`,
        );
        service.responseWriter.writeJson(res, { error: 'Internal Server Error' }, 500);
      });
    });

    service.server.on('upgrade', (req: http.IncomingMessage, socket: any, head: Buffer) => {
      if (service.webApp.handleUpgrade(req, socket, head)) {
        return;
      }
      socket.destroy();
    });

    service.server.on('connection', (socket: any) => {
      service.openSockets.add(socket);
      socket.on('close', () => {
        service.openSockets.delete(socket);
      });
    });

    service.server.on('error', (err: any) => {
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

export async function stopDashboardService(service: any): Promise<void> {
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

