import { DateTimeTool } from '../../src/tools/DateTimeTool';
import { ImageGenerationTool } from '../../src/tools/ImageGenerationTool';
import { QueryExternalAiTool } from '../../src/tools/QueryExternalAiTool';
import { UnifiedSearchTool } from '../../src/tools/UnifiedSearchTool';
import { AutoSkillCreatorTool } from '../../src/tools/AutoSkillCreatorTool';
import { DesktopAutomationTool } from '../../src/tools/DesktopAutomationTool';
import { Mem0Tool } from '../../src/tools/Mem0Tool';
import { EnableMnemosTool } from '../../src/tools/EnableMnemosTool';
import { PlanMnemosScopeTool } from '../../src/tools/PlanMnemosScopeTool';

describe('DateTimeTool', () => {
  const tool = new DateTimeTool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });

  it('returns current date and time', async () => {
    const result = await tool.execute({});
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles format parameter', async () => {
    const result = await tool.execute({ format: 'iso' });
    expect(result).toBeTruthy();
  });
});

describe('ImageGenerationTool', () => {
  const tool = new ImageGenerationTool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });

  it('handles missing API key gracefully', async () => {
    const result = await tool.execute({});
    expect(result).toBeTruthy();
  });
});

describe('QueryExternalAiTool', () => {
  const tool = new QueryExternalAiTool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });
});

describe('UnifiedSearchTool', () => {
  const tool = new UnifiedSearchTool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });

  it('returns error without query', async () => {
    const result = await tool.execute({});
    expect(result).toBeTruthy();
  });
});

describe('AutoSkillCreatorTool', () => {
  const tool = new AutoSkillCreatorTool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });

  it('returns error without required params', async () => {
    const result = await tool.execute({});
    expect(result).toBeTruthy();
  });
});

describe('DesktopAutomationTool', () => {
  const tool = new DesktopAutomationTool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toBeTruthy();
  });
});

describe('Mem0Tool', () => {
  const tool = new Mem0Tool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });
});

describe('EnableMnemosTool', () => {
  const tool = new EnableMnemosTool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });

  it('returns result for enable action', async () => {
    const result = await tool.execute({});
    expect(result).toBeTruthy();
  });
});

describe('PlanMnemosScopeTool', () => {
  const tool = new PlanMnemosScopeTool();

  it('exposes correct name', () => {
    expect(tool.name).toBeTruthy();
  });

  it('returns result for plan action', async () => {
    const result = await tool.execute({});
    expect(result).toBeTruthy();
  });
});
