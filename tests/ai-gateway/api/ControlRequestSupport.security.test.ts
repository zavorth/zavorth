import {
  controlMessage,
  readBoundedControlBody,
  readControlIdentifier,
  resolveControlLanguage,
} from '../../../src/ai-gateway/app/api/web/zavorthControl/controlRequestSupport';

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/web/zavorthControl/chat-v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

describe('Zavorth Control request boundary', () => {
  it('uses the preferred supported device language and falls back to English', () => {
    expect(resolveControlLanguage(request('{}', { 'accept-language': 'en;q=0.8, pt-BR;q=1' }))).toBe('pt-BR');
    expect(resolveControlLanguage(request('{}', { 'accept-language': 'pt-BR;q=0, en-US;q=1' }))).toBe('en');
    expect(resolveControlLanguage(request('{}', { 'accept-language': 'xx-ZZ' }))).toBe('en');
  });

  it('lets the explicit device locale override the language header', () => {
    const localized = request('{}', { 'x-locale': 'pt-BR', 'accept-language': 'en-US' });
    expect(resolveControlLanguage(localized)).toBe('pt-BR');
    expect(controlMessage(localized, 'missingMessage')).toContain('required');
  });

  it('accepts only bounded JSON objects', async () => {
    const valid = await readBoundedControlBody(request('{"message":"hello"}'));
    expect(valid.error).toBeNull();
    expect(valid.body).toEqual({ message: 'hello' });

    const arrayBody = await readBoundedControlBody(request('[]'));
    expect(arrayBody.body).toBeNull();
    expect(arrayBody.error?.status).toBe(400);
  });

  it('rejects oversized bodies using both declared and measured size', async () => {
    const declared = await readBoundedControlBody(request('{}', { 'content-length': String(64 * 1024 + 1) }));
    expect(declared.error?.status).toBe(413);

    const measured = await readBoundedControlBody(request(JSON.stringify({ value: 'x'.repeat(64 * 1024) })));
    expect(measured.error?.status).toBe(413);
  });

  it('accepts canonical identifiers and rejects control or path-like input', () => {
    expect(readControlIdentifier('approval:run-123')).toBe('approval:run-123');
    expect(readControlIdentifier('../secret')).toBeNull();
    expect(readControlIdentifier('bad\nidentifier')).toBeNull();
    expect(readControlIdentifier('x'.repeat(161))).toBeNull();
  });
});
