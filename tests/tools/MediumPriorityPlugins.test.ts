import { SecurityGuidanceService } from '../../src/services/plugins/SecurityGuidanceService';
import { ProviderReplicateTool } from '../../src/services/plugins/ProviderReplicateTool';
import { ProviderHuggingFaceTool } from '../../src/services/plugins/ProviderHuggingFaceTool';
import { WebFirecrawlTool } from '../../src/services/plugins/WebFirecrawlTool';
import { ImageGenFalTool } from '../../src/services/plugins/ImageGenFalTool';
import { SearchSearXNGTool } from '../../src/services/plugins/SearchSearXNGTool';
import { VideoGenRunwayTool } from '../../src/services/plugins/VideoGenRunwayTool';
import { SpotifyPlayerTool } from '../../src/services/plugins/SpotifyPlayerTool';

describe('SecurityGuidanceService', () => {
  const tool = new SecurityGuidanceService();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_security_guidance');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });

  it('lists categories', async () => {
    const result = await tool.execute({ action: 'list_categories' });
    expect(result).toContain('injection');
    expect(result).toContain('auth');
    expect(result).toContain('xss');
  });

  it('queries by topic', async () => {
    const result = await tool.execute({ action: 'query', topic: 'injection' });
    expect(result).toContain('execSync');
    expect(result).toContain('execFileSync');
  });

  it('shows OWASP Top 10', async () => {
    const result = await tool.execute({ action: 'owasp_top10' });
    expect(result).toContain('OWASP');
    expect(result).toContain('A01:2021');
  });

  it('shows hardening guide', async () => {
    const result = await tool.execute({ action: 'hardening' });
    expect(result).toContain('Hardening');
    expect(result).toContain('execFileSync');
  });

  it('shows audit checklist', async () => {
    const result = await tool.execute({ action: 'audit_checklist' });
    expect(result).toContain('Checklist');
    expect(result).toContain('[ ]');
  });

  it('checks code for injection', async () => {
    const result = await tool.execute({
      action: 'check_code',
      code_snippet: "execSync(`curl ${userInput}`)",
    });
    expect(result).toContain('execSync');
    expect(result).toContain('interpolacao');
  });

  it('checks code for hardcoded secrets', async () => {
    const result = await tool.execute({
      action: 'check_code',
      code_snippet: 'const apiKey = "sk-1234567890abcdef"',
    });
    expect(result).toContain('Secret');
  });

  it('returns no issues for safe code', async () => {
    const result = await tool.execute({
      action: 'check_code',
      code_snippet: 'const x = 1 + 2;',
    });
    expect(result).toContain('Nenhum');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'dance' });
    expect(result).toContain('Erro');
  });
});

describe('ProviderReplicateTool', () => {
  const tool = new ProviderReplicateTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_replicate');
  });

  it('lists models', async () => {
    const result = await tool.execute({ action: 'list_models' });
    expect(result).toContain('Llama');
    expect(result).toContain('Stable Diffusion');
  });

  it('gets pricing', async () => {
    const result = await tool.execute({ action: 'get_pricing' });
    expect(result).toContain('Pricing');
    expect(result).toContain('per-second');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });
});

describe('ProviderHuggingFaceTool', () => {
  const tool = new ProviderHuggingFaceTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_huggingface');
  });

  it('lists models', async () => {
    const result = await tool.execute({ action: 'list_models' });
    expect(result).toContain('Llama');
    expect(result).toContain('stable-diffusion');
    expect(result).toContain('whisper');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });
});

describe('WebFirecrawlTool', () => {
  const tool = new WebFirecrawlTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_firecrawl');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });

  it('checks status', async () => {
    const result = await tool.execute({ action: 'check_status' });
    expect(result).toContain('Firecrawl');
  });
});

describe('ImageGenFalTool', () => {
  const tool = new ImageGenFalTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_fal');
  });

  it('lists models', async () => {
    const result = await tool.execute({ action: 'list_models' });
    expect(result).toContain('FLUX');
    expect(result).toContain('schnell');
  });

  it('checks status', async () => {
    const result = await tool.execute({ action: 'check_status' });
    expect(result).toContain('fal.ai');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });
});

describe('SearchSearXNGTool', () => {
  const tool = new SearchSearXNGTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_searxng');
  });

  it('lists instances', async () => {
    const result = await tool.execute({ action: 'list_instances' });
    expect(result).toContain('localhost');
    expect(result).toContain('Instancias');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });

  it('returns error for configure without url', async () => {
    const result = await tool.execute({ action: 'configure' });
    expect(result).toContain('Erro');
  });
});

describe('VideoGenRunwayTool', () => {
  const tool = new VideoGenRunwayTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_runway');
  });

  it('lists models', async () => {
    const result = await tool.execute({ action: 'list_models' });
    expect(result).toContain('Gen-3');
    expect(result).toContain('turbo');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });
});

describe('SpotifyPlayerTool', () => {
  const tool = new SpotifyPlayerTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_spotify');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });

  it('returns error without token', async () => {
    const result = await tool.execute({ action: 'now_playing' });
    expect(result).toContain('SPOTIFY_ACCESS_TOKEN');
  });
});
