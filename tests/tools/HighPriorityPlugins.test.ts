import { ProviderNovitaTool } from '../../src/services/plugins/ProviderNovitaTool';
import { SearchExaService } from '../../src/services/plugins/SearchExaService';
import { BrowserPlaywrightService } from '../../src/services/plugins/BrowserPlaywrightService';

describe('ProviderNovitaTool', () => {
  const tool = new ProviderNovitaTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_novita');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('lists models', async () => {
    const result = await tool.execute({ action: 'list_models' });
    expect(result).toContain('llama');
    expect(result).toContain('mistral');
  });

  it('gets pricing', async () => {
    const result = await tool.execute({ action: 'get_pricing' });
    expect(result).toContain('Pricing');
    expect(result).toContain('cheaper');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'dance' });
    expect(result).toContain('Error');
  });
});

describe('SearchExaService', () => {
  it('returns error without API key', async () => {
    const service = new SearchExaService();
    const result = await service.search({ query: 'test' });
    expect(result).toContain('EXA_API_KEY');
  });
});

describe('BrowserPlaywrightService', () => {
  it('gets stats', () => {
    const service = new BrowserPlaywrightService();
    const result = service.getStats();
    expect(result).toContain('Playwright');
  });
});
