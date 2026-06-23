import { ZavorthVisionService } from '../../src/services/plugins/ZavorthVisionService';
import { ZavorthAudioAnalyzerService } from '../../src/services/plugins/ZavorthAudioAnalyzerService';
import { ZavorthVideoAnalyzerService } from '../../src/services/plugins/ZavorthVideoAnalyzerService';

describe('ZavorthVisionService', () => {
  const svc = new ZavorthVisionService();
  it('has correct name', () => { expect(svc.name).toBe('zavorth_vision'); });
  it('returns error without action', async () => { expect(await svc.execute({})).toContain('Error'); });
  it('returns error without image', async () => { expect(await svc.execute({ action: 'analyze' })).toContain('Error'); });
  it('returns error for invalid action', async () => { expect(await svc.execute({ action: 'invalid' })).toContain('invalid'); });
  it('returns error for non-existent file', async () => {
    const r = await svc.execute({ action: 'analyze', image_path: '/nonexistent' });
    expect(r).toContain('Error');
  });
});

describe('ZavorthAudioAnalyzerService', () => {
  const svc = new ZavorthAudioAnalyzerService();
  it('has correct name', () => { expect(svc.name).toBe('zavorth_audio_analyzer'); });
  it('returns error without action', async () => { expect(await svc.execute({})).toContain('Error'); });
  it('returns error without audio', async () => { expect(await svc.execute({ action: 'analyze' })).toContain('Error'); });
  it('lists capabilities', async () => { expect(await svc.execute({ action: 'list_capabilities' })).toContain('analyze'); });
  it('returns error for invalid action', async () => { expect(await svc.execute({ action: 'invalid' })).toContain('invalid'); });
  it('returns error for non-existent file', async () => { expect(await svc.execute({ action: 'analyze', audio_path: '/nonexistent' })).toContain('Error'); });
  it('get metadata returns error for missing file', async () => { expect(await svc.execute({ action: 'get_metadata', audio_path: '/nonexistent' })).toContain('Error'); });
});

describe('ZavorthVideoAnalyzerService', () => {
  const svc = new ZavorthVideoAnalyzerService();
  it('has correct name', () => { expect(svc.name).toBe('zavorth_video_analyzer'); });
  it('returns error without action', async () => { expect(await svc.execute({})).toContain('Error'); });
  it('returns error without video', async () => { expect(await svc.execute({ action: 'analyze' })).toContain('Error'); });
  it('lists capabilities', async () => { expect(await svc.execute({ action: 'list_capabilities' })).toContain('analyze'); });
  it('returns error for invalid action', async () => { expect(await svc.execute({ action: 'invalid' })).toContain('invalid'); });
  it('returns error for non-existent file', async () => { expect(await svc.execute({ action: 'analyze', video_path: '/nonexistent' })).toContain('Error'); });
  it('get metadata returns error for missing file', async () => { expect(await svc.execute({ action: 'get_metadata', video_path: '/nonexistent' })).toContain('Error'); });
});
