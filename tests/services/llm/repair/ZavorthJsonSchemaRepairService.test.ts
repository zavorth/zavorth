import { ZavorthJsonSchemaRepairService } from '../../../../src/services/llm/repair/ZavorthJsonSchemaRepairService';

describe('ZavorthJsonSchemaRepairService', () => {
  let service: ZavorthJsonSchemaRepairService;

  beforeEach(() => {
    service = new ZavorthJsonSchemaRepairService();
  });

  it('should parse valid JSON objects directly without modification', () => {
    const validJson = '{"action":"create_task","priority":"HIGH"}';
    const res = service.parseSafe<{ action: string; priority: string }>(validJson);

    expect(res.success).toBe(true);
    expect(res.repaired).toBe(false);
    expect(res.data?.action).toBe('create_task');
    expect(res.data?.priority).toBe('HIGH');
  });

  it('should repair trailing commas and unclosed braces deterministically', () => {
    const malformedJson = '{"action":"move_task","taskId":"task-1",}';
    const res = service.parseSafe<{ action: string; taskId: string }>(malformedJson);

    expect(res.success).toBe(true);
    expect(res.repaired).toBe(true);
    expect(res.data?.action).toBe('move_task');
    expect(res.data?.taskId).toBe('task-1');

    const unclosedJson = '{"action":"impact_analysis","filePath":"src/auth.ts"';
    const res2 = service.parseSafe<{ action: string; filePath: string }>(unclosedJson);
    expect(res2.success).toBe(true);
    expect(res2.data?.filePath).toBe('src/auth.ts');
  });

  it('should extract and repair embedded JSON objects from free-form reasoning text', () => {
    const mixedText = `
I have concluded my analysis. Let's invoke the tool:
\`\`\`json
{
  "action": "check",
  "filePath": "src/index.ts",
}
\`\`\`
Hope this helps!
`;

    const res = service.parseSafe<{ action: string; filePath: string }>(mixedText);
    expect(res.success).toBe(true);
    expect(res.data?.action).toBe('check');
    expect(res.data?.filePath).toBe('src/index.ts');
  });

  it('should gracefully return fallback when text contains no JSON', () => {
    const noJson = 'Just regular conversation with no structured tools.';
    const res = service.parseSafe(noJson, { defaultAction: 'none' });

    expect(res.success).toBe(false);
    expect(res.data).toEqual({ defaultAction: 'none' });
  });
});
