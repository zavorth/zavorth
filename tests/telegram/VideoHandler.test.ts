import { VideoHandler } from '../../src/telegram/VideoHandler';

describe('VideoHandler', () => {
  it('parses JSON payloads with XSSI prefixes safely', () => {
    const handler = Object.create(VideoHandler.prototype) as any;

    const parsed = handler.parseJsonPayload(`)]}'\n{"ok":true,"items":[1,2,3]}`, 'test');

    expect(parsed).toEqual({ ok: true, items: [1, 2, 3] });
  });

  it('extracts the YouTube player response from embedded HTML', () => {
    const handler = Object.create(VideoHandler.prototype) as any;
    const html = `
      <html>
        <script>
          var ytInitialPlayerResponse = {"videoDetails":{"title":"Demo { }","lengthSeconds":"42"}};
        </script>
      </html>
    `;

    const parsed = handler.extractYouTubePlayerResponse(html);

    expect(parsed.videoDetails.title).toBe('Demo { }');
    expect(parsed.videoDetails.lengthSeconds).toBe('42');
  });
});
