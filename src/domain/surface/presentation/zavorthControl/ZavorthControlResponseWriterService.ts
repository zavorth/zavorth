import * as http from 'http';

export class ZavorthControlResponseWriterService {
  public writeHtml(
    res: http.ServerResponse,
    body: string,
    statusCode: number = 200,
  ): void {
    res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  }

  public writeText(
    res: http.ServerResponse,
    body: string,
    statusCode: number = 200,
  ): void {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
  }

  public writeJson(
    res: http.ServerResponse,
    body: unknown,
    statusCode: number = 200,
  ): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }

  public writeRedirect(
    res: http.ServerResponse,
    location: string,
    statusCode: number = 302,
  ): void {
    res.writeHead(statusCode, { Location: location });
    res.end();
  }
}

