import { IntentSafetyClassifier } from '../../../src/runtime/uni/IntentSafetyClassifier.js';

describe('IntentSafetyClassifier Portuguese false-positive hardening', () => {
  const classifier = new IntentSafetyClassifier();

  it('does not treat a unit test example request as shell execution', () => {
    const result = classifier.classify({
      surface: 'cli',
      text: 'Escreva uma funcao simples em TypeScript para calcular o fatorial e faca um teste unitario basico de exemplo comentando o codigo.',
    });

    expect(result.signals.shell).toBe(false);
    expect(result.intent).not.toBe('command_execution');
    expect(result.risk).not.toBe('danger');
    expect(result.capabilityRequired).not.toContain('shell.exec');
  });

  it('ignores TESTES DEV in workspace paths while preserving inspection intent', () => {
    const result = classifier.classify({
      surface: 'cli',
      text: 'Analise os arquivos localizados na pasta C:/workspace/zavorth-core e me diga como funciona o modulo de logs.',
      contextHints: {
        workspacePath: 'C:/workspace/zavorth-core',
      },
    });

    expect(result.signals.shell).toBe(false);
    expect(result.intent).toBe('inspection');
    expect(result.risk).toBe('safe');
  });

  it('allows theoretical email discussion without external side-effect gating', () => {
    const result = classifier.classify({
      surface: 'web',
      text: 'Como o protocolo SMTP envia um email? Explique a teoria.',
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
      text: 'Envie um email para a equipe com o relatorio.',
    });

    expect(shell.signals.shell).toBe(true);
    expect(shell.intent).toBe('command_execution');
    expect(shell.risk).toBe('danger');
    expect(external.signals.externalSideEffect).toBe(true);
    expect(external.intent).toBe('external_side_effect');
    expect(external.risk).toBe('danger');
  });
});
