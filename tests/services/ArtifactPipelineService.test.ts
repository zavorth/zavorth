import fs from 'fs';
import os from 'os';
import path from 'path';
import { ArtifactPipelineService } from '../../src/services/ArtifactPipelineService';

describe('ArtifactPipelineService', () => {
  it('normalizes local and remote artifacts into a stable manifest', () => {
    const service = new ArtifactPipelineService();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-artifacts-'));
    const htmlPath = path.join(tempDir, 'index.html');
    fs.writeFileSync(htmlPath, '<html></html>', 'utf8');

    try {
      const artifacts = service.normalizeArtifacts([
        {
          type: 'file',
          path: htmlPath,
          summary: 'HTML exportado',
        },
        {
          type: 'link',
          name: 'preview',
          url: 'https://example.com/preview',
        },
      ], 'stitch');

      expect(artifacts).toHaveLength(2);
      expect(artifacts[0]).toEqual(expect.objectContaining({
        name: 'index.html',
        deliveryChannel: 'document',
        kind: 'html_export',
        exists: true,
      }));
      expect(artifacts[1]).toEqual(expect.objectContaining({
        deliveryChannel: 'link',
        url: 'https://example.com/preview',
      }));

      const manifest = service.buildManifest(artifacts, {
        traceId: 'trace-artifacts',
        runId: 'run-artifacts',
        sessionId: 'session-artifacts',
        taskId: 'task-artifacts',
        surface: 'telegram',
        source: 'artifact-test',
      });

      expect(manifest).toEqual(expect.objectContaining({
        total: 2,
        photos: 0,
        documents: 1,
        links: 1,
        missing_local_files: 0,
        primary_artifact_name: 'index.html',
        package_mode: 'bundle',
        local_paths: [htmlPath],
        remote_urls: ['https://example.com/preview'],
        by_kind: expect.objectContaining({
          html_export: 1,
          link: 1,
        }),
        by_delivery_channel: {
          photo: 0,
          document: 1,
          link: 1,
          none: 0,
        },
      }));
      expect(manifest.lifecycle).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'artifact',
          status: 'linked',
          traceId: 'trace-artifacts',
          runId: 'run-artifacts',
          sessionId: 'session-artifacts',
          surface: 'telegram',
          source: 'artifact-test',
          parentId: 'task-artifacts',
        }),
        expect.objectContaining({
          kind: 'artifact',
          status: 'linked',
          metadata: expect.objectContaining({
            url: 'https://example.com/preview',
          }),
        }),
      ]));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
