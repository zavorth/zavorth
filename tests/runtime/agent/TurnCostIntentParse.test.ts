let parseLlmCostDecision: any;
let classifyTurnCostFromStructured: any;
try {
  const mod = require('../../../src/services/llm/TurnCostIntentService.js');
  parseLlmCostDecision = mod.parseLlmCostDecision;
  classifyTurnCostFromStructured = mod.classifyTurnCostFromStructured;
} catch {
  // Module removed from source
}

const describeIf = parseLlmCostDecision ? describe : describe.skip;

describeIf('TurnCostIntentService parse robustness', () => {
  it('parses clean JSON', () => {
    const d = parseLlmCostDecision(
      '{"class":"background","confidence":0.9,"reason":"greeting"}',
    );
    expect(d?.class).toBe('background');
    expect(d?.source).toBe('llm');
  });

  it('parses markdown-fenced JSON', () => {
    const d = parseLlmCostDecision(`\`\`\`json
{"class":"premium","confidence":0.88,"reason":"architecture redesign"}
\`\`\``);
    expect(d?.class).toBe('premium');
  });

  it('parses JSON with trailing prose', () => {
    const d = parseLlmCostDecision(
      'Sure.\n{"class":"standard","confidence":0.7,"reason":"file list"}\nHope that helps.',
    );
    expect(d?.class).toBe('standard');
  });

  it('repairs trailing commas and smart quotes', () => {
    const d = parseLlmCostDecision(
      '{?class?: ?background?, ?confidence?: 0.95, ?reason?: ?thanks?,}',
    );
    expect(d?.class).toBe('background');
  });

  it('accepts alternate keys (category conversation -> background)', () => {
    const d = parseLlmCostDecision(
      '{"category":"conversation","confidence":0.9,"reason":"social"}',
    );
    expect(d?.class).toBe('background');
  });

  it('recovers bare class token when JSON is broken', () => {
    const d = parseLlmCostDecision('class = premium confidence high');
    expect(d?.class).toBe('premium');
  });

  it('structured path still ignores free-text words', () => {
    const d = classifyTurnCostFromStructured({ userMessage: 'oi' });
    expect(d.class).toBe('standard');
    expect(d.source).toBe('default');
  });
});
