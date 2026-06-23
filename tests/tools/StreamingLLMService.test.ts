import fs from 'fs';
import os from 'os';
import path from 'path';
import { StreamingLLMService } from '../../src/services/plugins/StreamingLLMService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'stream-'));

describe('StreamingLLMService', () => {
  let svc: StreamingLLMService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new StreamingLLMService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });

  it('lists sessions when empty', () => {
    const r = svc.listSessions();
    expect(r).toContain('No stream');
  });

  it('gets stats', () => {
    const r = svc.getStats();
    expect(r).toContain('Sessions: 0');
  });

  it('returns error for non-existent session', () => {
    const r = svc.getSession('nonexistent');
    expect(r).toContain('not found');
  });

  it('handles cancel for non-existent stream', () => {
    const r = svc.cancel('nonexistent');
    expect(r).toContain('cancelled');
  });

  it('streamChat returns error without API key', async () => {
    const r = await svc.streamChat('test-model', [{ role: 'user', content: 'hi' }]);
    expect(r).toContain('Error');
  });

  it('streamChat handles missing provider key', async () => {
    const r = await svc.streamChat('test-model', [{ role: 'user', content: 'hi' }], { provider: 'nonexistent' });
    expect(r).toContain('Error');
  });
});
