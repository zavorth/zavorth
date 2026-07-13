import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthSessionTranscriptExportService } from '../../../src/services/ZavorthSessionTranscriptExportService.js';

describe('ZavorthSessionTranscriptExportService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-session-export-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const messages = [
    { role: 'user' as const, content: 'hello with sk-testsecret1234567890', createdAt: '2026-07-12T00:00:00.000Z', surface: 'web' },
    { role: 'assistant' as const, content: 'hi there', createdAt: '2026-07-12T00:00:01.000Z', surface: 'web' },
  ];

  it('exports markdown preview with redact default on', () => {
    const service = new ZavorthSessionTranscriptExportService({ projectRoot: root });
    const snap = service.export({
      messages,
      format: 'markdown',
      title: 'Demo',
    });

    expect(snap.status).toBe('preview');
    expect(snap.format).toBe('markdown');
    expect(snap.messageCount).toBe(2);
    expect(snap.body).toContain('# Demo');
    expect(snap.body).toContain('assistant');
    expect(snap.body).not.toContain('sk-testsecret1234567890');
    expect(snap.safety.secretsRedacted).toBe(true);
  });

  it('exports html with sidebar structure', () => {
    const service = new ZavorthSessionTranscriptExportService({ projectRoot: root });
    const snap = service.export({
      messages,
      format: 'html',
      title: 'HTML Demo',
      redact: false,
    });

    expect(snap.body).toContain('<!doctype html>');
    expect(snap.body).toContain('<aside>');
    expect(snap.body).toContain('msg-user');
    expect(snap.body).toContain('hello with sk-testsecret1234567890');
  });

  it('exports prompt-only roles', () => {
    const service = new ZavorthSessionTranscriptExportService({ projectRoot: root });
    const snap = service.export({ messages, format: 'prompt' });
    expect(snap.body).toMatch(/^USER:/m);
    expect(snap.body).toMatch(/^ASSISTANT:/m);
  });

  it('requires approval id to write export path', () => {
    const service = new ZavorthSessionTranscriptExportService({ projectRoot: root });
    const blocked = service.export({
      messages,
      format: 'markdown',
      exportPath: path.join(root, 'out.md'),
    });
    expect(blocked.status).toBe('approval-required');
    expect(fs.existsSync(path.join(root, 'out.md'))).toBe(false);

    const written = service.export({
      messages,
      format: 'markdown',
      exportPath: path.join(root, 'out.md'),
      approvalId: 'appr-1',
    });
    expect(written.status).toBe('exported');
    expect(fs.existsSync(path.join(root, 'out.md'))).toBe(true);
  });
});
