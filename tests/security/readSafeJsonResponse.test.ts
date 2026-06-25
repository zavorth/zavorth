import { readSafeJsonResponse } from '../../src/security/SafeFetchService';

describe('readSafeJsonResponse', () => {
  it('correctly parses valid JSON within size limits', async () => {
    const data = { ok: true, message: 'hello' };
    const response = new Response(JSON.stringify(data));
    const result = await readSafeJsonResponse(response, 'Test Service', 1000);
    expect(result).toEqual(data);
  });

  it('throws error when content-length exceeds limits', async () => {
    const response = new Response('{}', {
      headers: { 'Content-Length': '2000' }
    });
    await expect(readSafeJsonResponse(response, 'Test Service', 1000)).rejects.toThrow(
      /Egress response size limit exceeded/
    );
  });

  it('throws error when stream chunk accumulation exceeds limits', async () => {
    const encoder = new TextEncoder();
    const chunk = encoder.encode('a'.repeat(600));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk); // 1200 bytes total
        controller.close();
      }
    });

    const response = new Response(stream);
    await expect(readSafeJsonResponse(response, 'Test Service', 1000)).rejects.toThrow(
      /Egress response size limit exceeded/
    );
  });

  it('falls back to text parsing if response.body is not defined', async () => {
    const data = { value: 123 };
    const response = {
      text: async () => JSON.stringify(data),
      body: null,
      headers: new Headers()
    } as any;

    const result = await readSafeJsonResponse(response, 'Test Service', 1000);
    expect(result).toEqual(data);
  });
});
