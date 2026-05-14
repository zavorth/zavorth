import http from 'http';
import type { ProbeServer } from './smokeTypes.js';

export async function createLocalSmokeProbeServer(webPort: number): Promise<ProbeServer> {
  return await new Promise<ProbeServer>((resolve, reject) => {
    const server = http.createServer((_, response) => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(
        '<!doctype html><html><head><title>Zavorth Overlord Smoke</title></head>'
        + '<body><h1 id="smoke">Zavorth Overlord Smoke</h1>'
        + `<p data-port="${webPort}">System Overlord local probe.</p></body></html>`,
      );
    });

    server.once('error', (error) => {
      reject(error);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Nao consegui resolver a porta do probe server do smoke.'));
        return;
      }

      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: async () => {
          await new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error);
                return;
              }
              resolveClose();
            });
          });
        },
      });
    });
  });
}
