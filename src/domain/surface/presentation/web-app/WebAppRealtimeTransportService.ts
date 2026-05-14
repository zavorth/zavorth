import * as http from 'http';
import { WebRealtimeService, type WebRealtimeEvent } from '../../../../services/WebRealtimeService.js';

export class WebAppRealtimeTransportService {
  public openEventStream(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    realtime: WebRealtimeService,
    sessionId: string,
  ): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const writeEvent = (event: WebRealtimeEvent) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const unsubscribe = realtime.subscribe(sessionId, writeEvent);
    const heartbeat = setInterval(() => {
      res.write(`: keep-alive ${Date.now()}\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  }
}

