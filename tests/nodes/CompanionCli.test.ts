import path from 'path';
import { parseCompanionArgs } from '../../src/companion.js';

describe('Companion CLI', () => {
  it('parses companion startup options with sensible defaults', () => {
    const options = parseCompanionArgs([
      '--passcode', 'desktop-a:PAIR123',
      '--base-url', 'http://127.0.0.1:33333/',
      '--node-id', 'Desktop A',
      '--workspace', 'C:/tmp/workspace',
      '--capabilities', 'screen.capture,clipboard.read',
      '--once',
    ]);

    expect(options).toEqual(expect.objectContaining({
      passcode: 'desktop-a:PAIR123',
      once: true,
      baseUrl: 'http://127.0.0.1:33333',
      nodeId: 'desktop-a',
      workspace: path.resolve('C:/tmp/workspace'),
      capabilities: ['screen.capture', 'clipboard.read'],
      surface: 'desktop-companion',
    }));
  });

  it('announces the official desktop capabilities by default', () => {
    const options = parseCompanionArgs([]);

    expect(options.capabilities).toEqual(
      expect.arrayContaining([
        'device.info',
        'files.watch',
        'browser.proxy',
        'clipboard.read',
        'clipboard.write',
        'notifications.send',
        'screen.capture',
      ]),
    );
  });
});
