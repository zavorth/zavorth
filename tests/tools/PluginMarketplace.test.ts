import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthPluginMarketplaceService } from '../../src/services/plugins/ZavorthPluginMarketplaceService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-'));

describe('ZavorthPluginMarketplaceService', () => {
  let svc: ZavorthPluginMarketplaceService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new ZavorthPluginMarketplaceService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('searches plugins', () => { expect(svc.search('vision')).toContain('Vision'); });
  it('searches by category', () => { expect(svc.search('', 'ai-safety')).toContain('AI Safety'); });
  it('gets plugin info', () => { expect(svc.getPlugin('zavorth-llm-router')).toContain('LLM Router'); });
  it('returns error for non-existent plugin', () => { expect(svc.getPlugin('nonexistent')).toContain('Error'); });
  it('installs plugin', () => { expect(svc.installPlugin('zavorth-ai-safety')).toContain('already installed'); });
  it('uninstalls plugin', () => { expect(svc.uninstallPlugin('zavorth-ai-safety')).toContain('uninstalled'); });
  it('enables plugin', () => { expect(svc.enablePlugin('zavorth-ai-safety')).toContain('enabled'); });
  it('disables plugin', () => { expect(svc.disablePlugin('zavorth-ai-safety')).toContain('disabled'); });
  it('rates plugin', () => { expect(svc.ratePlugin('zavorth-ai-safety', 'user1', 5, 'Great!')).toContain('submitted'); });
  it('gets reviews', () => { svc.ratePlugin('zavorth-ai-safety', 'user1', 5, 'Great!'); expect(svc.getReviews('zavorth-ai-safety')).toContain('Great!'); });
  it('lists categories', () => { expect(svc.listCategories()).toContain('ai-safety'); });
  it('gets featured', () => { expect(svc.getFeatured()).toContain('Featured'); });
  it('gets trending', () => { expect(svc.getTrending()).toContain('Trending'); });
  it('gets stats', () => { expect(svc.getStats()).toContain('Total plugins'); });
});
