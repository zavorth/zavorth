import { Readable } from 'stream';
import type { IncomingMessage } from 'http';
import {
  ZavorthControlHttpBodyError,
  ZavorthControlHttpSupportService,
} from '../../src/domain/surface/presentation/zavorthControl/ZavorthControlHttpSupportService';

function requestFrom(chunks: Buffer[], headers: Record<string, string> = {}): IncomingMessage {
  const stream = Readable.from(chunks) as IncomingMessage;
  Object.defineProperty(stream, 'headers', { value: headers, configurable: true });
  return stream;
}

describe('ZavorthControlHttpSupportService request boundary', () => {
  const service = new ZavorthControlHttpSupportService();

  it('rejects declared and streamed bodies over the byte limit', async () => {
    await expect(service.readRawBody(requestFrom([], { 'content-length': '4096' }), 1024))
      .rejects.toEqual(expect.objectContaining<Partial<ZavorthControlHttpBodyError>>({ statusCode: 413 }));
    await expect(service.readRawBody(requestFrom([Buffer.alloc(600), Buffer.alloc(600)]), 1024))
      .rejects.toEqual(expect.objectContaining<Partial<ZavorthControlHttpBodyError>>({ statusCode: 413 }));
  });

  it('accepts only bounded JSON objects with reasonable nesting', async () => {
    await expect(service.readJsonBody(requestFrom([Buffer.from('[1,2,3]')]))).rejects.toThrow('must be an object');
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 35; index += 1) nested = { child: nested };
    await expect(service.readJsonBody(requestFrom([Buffer.from(JSON.stringify(nested))])))
      .rejects.toThrow('too complex');
    await expect(service.readJsonBody(requestFrom([Buffer.from('{"ok":true}')]))).resolves.toEqual({ ok: true });
  });
});
