import { IntentSafetyClassifier } from '../../../src/runtime/uni/IntentSafetyClassifier.js';

describe('IntentSafetyClassifier Portuguese false-positive hardening', () => {
  const classifier = new IntentSafetyClassifier();

  it('does not treat a unit test example request as shell execution', () => {
    const result = classifier.classify({
      surface: 'cli',
      text: 'Escreva uma funcao simples em TypeScript para calcular o fatorial e faca um teste unitario basico de exemplo comentando o code.',
    });

    expect(result.signals.shell).toBe(false);
    expect(result.intent).not.toBe('command_execution');
    expect(result.risk).not.toBe('danger');
    expect(result.capabilityRequired).not.toContain('shell.exec');
  });

  it('ignores TESTES DEV in workspace paths while preserving inspection intent', () => {
    const result = classifier.classify({
      surface: 'cli',
      text: 'Analyze the files located in C:/workspace/zavorth-core and explain how the logs module works.',
      contextHints: {
        workspacePath: 'C:/workspace/zavorth-core',
      },
      requestedTools: ['workspace.read'],
    });

    expect(result.signals.shell).toBe(false);
    expect(result.intent).toBe('inspection');
    expect(result.risk).toBe('safe');
  });

  it('allows theoretical email discussion without external side-effect gating', () => {
    const result = classifier.classify({
      surface: 'web',
      text: 'Como o protocolo SMTP envia um email- Explique a teoria.',
    });

    expect(result.signals.externalSideEffect).toBe(false);
    expect(result.intent).toBe('conversation');
    expect(result.risk).toBe('safe');
  });

  it('still classifies explicit shell and external-send requests as dangerous', () => {
    const shell = classifier.classify({
      surface: 'cli',
      text: 'Rode npm test agora.',
    });
    const external = classifier.classify({
      surface: 'web',
      text: 'Send an email to the team with the report.',
    });

    expect(shell.signals.shell).toBe(true);
    expect(shell.intent).toBe('command_execution');
    expect(shell.risk).toBe('danger');
    expect(external.signals.externalSideEffect).toBe(true);
    expect(external.intent).toBe('external_side_effect');
    expect(external.risk).toBe('danger');
  });
});
