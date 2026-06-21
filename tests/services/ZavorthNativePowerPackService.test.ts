import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthNativePowerPackService } from '../../src/services/ZavorthNativePowerPackService';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-native-power-pack-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '# Atlas\n\nZavorth native wiki entry about tools.');
  fs.writeFileSync(path.join(root, 'notes.md'), 'Local document body for extraction.');
  fs.writeFileSync(path.join(root, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return root;
}

describe('ZavorthNativePowerPackService', () => {
  const roots: string[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports Google Workspace readiness without serializing raw secrets', () => {
    const service = new ZavorthNativePowerPackService({
      env: {
        ZAVORTH_GOOGLE_ACCESS_TOKEN: 'secret-token',
        ZAVORTH_GOOGLE_OAUTH_CLIENT_ID: 'client-id',
      },
    });

    const status = service.googleWorkspaceStatus();

    expect(status.summary.configuredCredentials).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(status)).not.toContain('secret-token');
    expect(status.actions).toEqual(expect.arrayContaining(['gmail.search', 'google.drive.search', 'google.calendar.list']));
  });

  it('extracts documents and searches local wiki sources inside the workspace', () => {
    const root = makeRoot();
    roots.push(root);
    const service = new ZavorthNativePowerPackService({ projectRoot: root });

    const document = service.extractDocument({ filePath: 'notes.md' });
    const wiki = service.searchWiki({ query: 'native wiki' });

    expect(document.ok).toBe(true);
    expect(document.textPreview).toContain('Local document body');
    expect(wiki.ok).toBe(true);
    expect(wiki.hits[0]?.file).toBe('docs/guide.md');
  });

  it('creates governed local media and canvas artifacts without network or secret leakage', () => {
    const root = makeRoot();
    roots.push(root);
    const service = new ZavorthNativePowerPackService({ projectRoot: root, now: () => new Date('2026-01-02T03:04:05.000Z') });

    const image = service.generateImageArtifact({ prompt: 'Zavorth power pack', style: 'diagram' });
    const speech = service.synthesizeSpeechArtifact({ text: 'hello there', voice: 'calm' });
    const canvas = service.renderCanvas({ title: 'Status', content: 'All native packs exposed.' });

    expect(image.ok).toBe(true);
    expect(image.artifactPath).toMatch(/\.svg$/);
    expect(fs.existsSync(path.join(root, image.artifactPath))).toBe(true);
    expect(speech.ok).toBe(true);
    expect(speech.artifactPath).toMatch(/\.json$/);
    expect(canvas.ok).toBe(true);
    expect(canvas.artifactPath).toMatch(/\.html$/);
    expect(JSON.stringify({ image, speech, canvas })).not.toMatch(/token|secret|password/i);
  });

  it('returns local image metadata for vision analyze without embedding raw image bytes', () => {
    const root = makeRoot();
    roots.push(root);
    const service = new ZavorthNativePowerPackService({ projectRoot: root });

    const result = service.analyzeImage({ filePath: 'image.png' });

    expect(result.ok).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.bytes).toBe(4);
    expect(JSON.stringify(result)).not.toContain('iVBOR');
  });
});
