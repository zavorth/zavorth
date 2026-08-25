import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { VideoHandler } from '../../src/services/media/VideoHandler';
import { VideoHandlerFetchSupport } from '../../src/services/media/video-handler/VideoHandlerFetchSupport';
import { VideoHandlerHelpers } from '../../src/services/media/video-handler/VideoHandlerHelpers';
import {
  MAX_REMOTE_DOWNLOAD_BYTES,
  MAX_TRANSCRIPT_EXCERPT_CHARS,
} from '../../src/services/media/video-handler/VideoHandlerTypes';

jest.mock('../../src/security/SafeFetchService.js', () => ({
  safeFetch: jest.fn().mockImplementation(async (url: string, init?: any) => {
    return globalThis.fetch(url, init);
  }),
}));

describe('VideoHandler hardening', () => {
  const originalTmpDir = config.tmpDir;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.tmpDir = originalTmpDir;
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('recognizes supported video documents by MIME type or extension without accepting arbitrary documents', () => {
    const handler = Object.create(VideoHandler.prototype) as VideoHandler;

    expect(handler.isVideoDocument('clip.MKV', 'application/octet-stream')).toBe(true);
    expect(handler.isVideoDocument('recording.bin', 'video/mp4')).toBe(true);
    expect(handler.isVideoDocument('notes.mp4.txt', 'text/plain')).toBe(false);
    expect(handler.isVideoDocument('archive.zip', 'application/zip')).toBe(false);
  });

  it('extracts direct and YouTube URLs while trimming chat punctuation', () => {
    expect(
      VideoHandlerHelpers.extractFirstSupportedVideoUrl(
        'Analise isso (https://cdn.example.com/video.webm).',
      ),
    ).toBe('https://cdn.example.com/video.webm');
    expect(
      VideoHandlerHelpers.extractFirstSupportedVideoUrl(
        'Resumo https://youtu.be/abc123, por favor',
      ),
    ).toBe('https://youtu.be/abc123');
    expect(VideoHandlerHelpers.extractFirstSupportedVideoUrl('https://example.com/file.txt')).toBeNull();
  });

  it('writes remote downloads only inside tmpDir even when the URL path contains traversal-like segments', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-video-hardening-'));
    tempDirs.push(root);
    config.tmpDir = root;
    const bytes = Buffer.from('fake video bytes');
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'video/mp4',
        'content-length': String(bytes.length),
      }),
      arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
    } as any);

    const downloaded = await VideoHandlerFetchSupport.downloadRemoteVideo(
      'https://cdn.example.com/%2e%2e/%2e%2e/evil.mp4?download_id=abc',
    );

    expect(path.resolve(downloaded.filePath).startsWith(path.resolve(root))).toBe(true);
    expect(path.basename(downloaded.filePath)).toMatch(/^remote_video_\d+\.mp4$/);
    expect(downloaded.fileName).toBe('evil.mp4');
    expect(downloaded.mimeType).toBe('video/mp4');
    expect(fs.readFileSync(downloaded.filePath, 'utf8')).toBe('fake video bytes');
  });

  it('rejects remote videos above the declared content-length limit before reading the body', async () => {
    const arrayBuffer = jest.fn();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'video/mp4',
        'content-length': String(MAX_REMOTE_DOWNLOAD_BYTES + 1),
      }),
      arrayBuffer,
    } as any);

    await expect(
      VideoHandlerFetchSupport.downloadRemoteVideo('https://cdn.example.com/large.mp4'),
    ).rejects.toThrow('exceeds the limit');
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('keeps transcript excerpts bounded and points to the full context', () => {
    const transcript = 'a'.repeat(MAX_TRANSCRIPT_EXCERPT_CHARS + 100);

    const excerpt = VideoHandlerHelpers.buildTranscriptExcerpt(transcript);

    expect(excerpt.length).toBeLessThan(transcript.length);
    expect(excerpt).toContain('Truncated excerpt');
    expect(excerpt).toContain('Read the full context file');
  });
});
