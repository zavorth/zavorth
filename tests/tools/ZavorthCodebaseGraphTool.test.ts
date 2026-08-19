import { ZavorthCodebaseGraphTool } from '../../src/tools/ZavorthCodebaseGraphTool';
import { ZavorthCodebaseGraphService } from '../../src/services/graph/ZavorthCodebaseGraphService';

describe('ZavorthCodebaseGraphTool', () => {
  let tool: ZavorthCodebaseGraphTool;
  let service: ZavorthCodebaseGraphService;

  beforeEach(() => {
    service = new ZavorthCodebaseGraphService();
    tool = new ZavorthCodebaseGraphTool(service);
  });

  it('should index file symbols and list them via tool execution', async () => {
    const code = `
export interface UserSession { id: string; }
export function loginUser(token: string): boolean { return true; }
`;

    const indexRes = await tool.execute({
      action: 'index_file',
      filePath: 'src/auth/session.ts',
      sourceCode: code,
    });

    const parsedIndex = JSON.parse(indexRes);
    expect(parsedIndex.success).toBe(true);
    expect(parsedIndex.indexedSymbolsCount).toBe(2);

    const listRes = await tool.execute({ action: 'list_symbols' });
    const parsedList = JSON.parse(listRes);
    expect(parsedList.success).toBe(true);
    expect(parsedList.totalSymbols).toBe(2);
  });

  it('should perform impact analysis on indexed symbols via tool execution', async () => {
    service.indexSourceFile('src/db.ts', 'export function queryDb(): string { return "ok"; }');
    service.indexSourceFile('src/api.ts', 'export function handleReq(): void { queryDb(); }');
    service.registerCallEdge('src/api.ts#handleReq', 'src/db.ts#queryDb', 'CALLS');

    const impactRes = await tool.execute({
      action: 'impact_analysis',
      filePath: 'src/db.ts',
      symbolName: 'queryDb',
    });

    const parsed = JSON.parse(impactRes);
    expect(parsed.success).toBe(true);
    expect(parsed.impact.dependentFiles).toContain('src/api.ts');
  });
});
