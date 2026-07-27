import {
  doesZavorthBridgeUiResponseMatchPrompt,
  isZavorthBridgeUiResponseReadyForDelivery,
  looksLikeZavorthBridgeHomeScreen,
  normalizeZavorthBridgeUiText,
  sanitizeZavorthBridgeUiResponse,
} from '../../src/services/ZavorthBridgeUiResponseHeuristics.js';

describe('ZavorthBridgeUiResponseHeuristics', () => {
  it('removes obvious ZavorthBridge chrome and control lines from the captured response', () => {
    const cleaned = sanitizeZavorthBridgeUiResponse(
      [
        'Switch to Agent Manager',
        '+',
        'Ctrl',
        'E',
        'Code with Agent',
        'Thought for 1s',
        'Copy',
        '[ZAVORTH_DIRECT_PROMPT]',
        'User request: responda teste',
        'Resumo final do dia.',
      ].join('\n'),
      'responda teste',
    );

    expect(cleaned).toBe('Resumo final do dia.');
  });

  it('detects the ZavorthBridge home screen by text or diagnostics', () => {
    expect(looksLikeZavorthBridgeHomeScreen('Switch to Agent Manager\nCode with Agent')).toBe(true);
    expect(
      looksLikeZavorthBridgeHomeScreen({
        responseText: 'qualquer coisa',
        uiDiagnostics: { homeScreenAfter: true },
      }),
    ).toBe(true);
  });

  it('rejects home screen and in-progress narration as final replies', () => {
    expect(
      isZavorthBridgeUiResponseReadyForDelivery(
        {
          status: 'ready',
          hasPermissionPrompt: false,
          responseText: 'Switch to Agent Manager\nCode with Agent',
          uiDiagnostics: { homeScreenAfter: true },
        },
        'Switch to Agent Manager\nCode with Agent',
      ),
    ).toBe(false);

    expect(
      isZavorthBridgeUiResponseReadyForDelivery(
        {
          status: 'ready',
          hasPermissionPrompt: false,
          responseText:
            "Initiating task execution. I've received the directive. The task is now actively being addressed.",
          uiDiagnostics: {},
        },
        "Initiating task execution. I've received the directive. The task is now actively being addressed.",
      ),
    ).toBe(false);
  });

  it('accepts a clean final reply', () => {
    expect(
      isZavorthBridgeUiResponseReadyForDelivery(
        {
          status: 'ready',
          hasPermissionPrompt: false,
          responseText: 'As principais noticias de tecnologia hoje foram A, B e C.',
          uiDiagnostics: { homeScreenAfter: false },
        },
        'As principais noticias de tecnologia hoje foram A, B e C.',
      ),
    ).toBe(true);

    expect(normalizeZavorthBridgeUiText('  Resumo   final  ')).toBe('summary final');
  });

  it('treats home screen with a usable input bar as a valid direct-chat surface', () => {
    const cleaned = sanitizeZavorthBridgeUiResponse(
      [
        '(Ctrl+K M) to get started. Start typing to dismiss or',
        'Responda apenas com ZAVORTH HOME SCREEN TEST OK.',
        'ZAVORTH HOME SCREEN TEST OK',
        'Copy',
      ].join('\n'),
      'Responda apenas com ZAVORTH HOME SCREEN TEST OK.',
    );

    expect(cleaned).toBe('ZAVORTH HOME SCREEN TEST OK');
    expect(
      isZavorthBridgeUiResponseReadyForDelivery(
        {
          status: 'ready',
          hasPermissionPrompt: false,
          hasInputBar: true,
          responseText: cleaned,
          uiDiagnostics: { homeScreenAfter: true },
        },
        cleaned,
      ),
    ).toBe(true);
  });

  it('keeps only the useful trailing answer block when the AG prefixes the reply with startup chatter', () => {
    const cleaned = sanitizeZavorthBridgeUiResponse(
      [
        'Initiating Response Protocol',
        "I've initiated the response protocol, as requested.",
        'The AGENTS startup procedure is underway: I\'ve started by reviewing',
        'Analyzed',
        'documents to understand the context and relevant information. Currently, I am about to read',
        '#L1-37',
        'to gather a complete understanding before formulating the requested output.',
        'memory/YYYY',
        '#L1-18',
        '#L1-9',
        '#L1-10',
        'ZAVORTH AG AFTER RESET OK',
        'Copy',
      ].join('\n'),
      'Responda apenas com ZAVORTH AG AFTER RESET OK.',
    );

    expect(cleaned).toBe('ZAVORTH AG AFTER RESET OK');
    expect(
      isZavorthBridgeUiResponseReadyForDelivery(
        {
          status: 'ready',
          hasPermissionPrompt: false,
          hasInputBar: true,
          responseText: cleaned,
          uiDiagnostics: { homeScreenAfter: false },
        },
        cleaned,
      ),
    ).toBe(true);
  });

  it('rejects host supervisor chatter captured from a contaminated AG session', () => {
    const cleaned = sanitizeZavorthBridgeUiResponse(
      [
        'Zavorth foi derrubado e reiniciado com sucesso.',
        'Resumo da Operaction:',
        '1. Derrubada: finalizei 5 processos.',
        '2. Reinicializaction: executei o Supervisor.',
        'Gateway do Telegram iniciado com sucesso.',
        'As principais noticias de tecnologia hoje foram A, B e C.',
      ].join('\n'),
      'pesquise as principais noticias',
    );

    expect(cleaned).toBe('As principais noticias de tecnologia hoje foram A, B e C.');
  });

  it('requires the visible response to match strong anchors from the current prompt when they exist', () => {
    expect(
      doesZavorthBridgeUiResponseMatchPrompt(
        'ZAVORTH_AG_E2E_RESPONSE_OK_1774466238602\nworkspace=zavorth',
        'Responda apenas com "ZAVORTH_AG_E2E_RESPONSE_OK_1774466238602" e depois "workspace=zavorth".',
      ),
    ).toBe(true);

    expect(
      doesZavorthBridgeUiResponseMatchPrompt(
        'ZAVORTH_AG_E2E_RESPONSE_OK_1774466238602\nworkspace=zavorth',
        'Crie o file "tmp/ag-e2e-create-1774466674556.md" e responda apenas com "CRIADO tmp/ag-e2e-create-1774466674556.md".',
      ),
    ).toBe(false);
  });

  it('honors explicit "responda apenas com" directives even when the AG wraps the token in narration', () => {
    const cleaned = sanitizeZavorthBridgeUiResponse(
      [
        'The user has sent a Zavorth task that',
        'ZAVORTH_AG_LIVE_OK_1774468929259',
        'asks me to respond with specific string.',
        'I should continue my work after that.',
      ].join('\n'),
      'Responda apenas com "ZAVORTH_AG_LIVE_OK_1774468929259".',
    );

    expect(cleaned).toBe('ZAVORTH_AG_LIVE_OK_1774468929259');
  });

  it('extracts an unquoted explicit token from AG ack chatter and model-picker chrome', () => {
    const cleaned = sanitizeZavorthBridgeUiResponse(
      [
        'Acknowledge Simple Request',
        'ZAVORTH_AG_SMOKE_RESPONSE_1774473236823',
        "I've got it. The task is straightforward: generate the string",
        'Model',
        '.env',
        'GEMINI_API_KEY',
        'New',
        'Conversation mode',
        '. This is a quick and easy directive within the Zavorth project.',
        "executor_recommendation: 'gemini_cli'",
        'Agent can plan before executing tasks. Use for deep research, complex tasks, or collaborative work',
        'Fast',
        'Agent will execute tasks directly. Use for simple tasks that can be completed faster',
        'JULES_API_KEY',
        "executor_recommendation: 'jules'",
      ].join('\n'),
      'No projeto Zavorth, responda apenas com ZAVORTH_AG_SMOKE_RESPONSE_1774473236823',
    );

    expect(cleaned).toBe('ZAVORTH_AG_SMOKE_RESPONSE_1774473236823');
  });

  it('reconstructs multi-line explicit outputs when the AG mentions both requested literals in noisy prose', () => {
    const cleaned = sanitizeZavorthBridgeUiResponse(
      [
        'Vou responder com ZAVORTH_AG_E2E_RESPONSE_OK_1774466238602 e,',
        'na sequencia, incluir workspace=zavorth como a segunda linthere is solicitada.',
      ].join('\n'),
      'Responda apenas com "ZAVORTH_AG_E2E_RESPONSE_OK_1774466238602" e em uma segunda linthere is escreva "workspace=zavorth".',
    );

    expect(cleaned).toBe('ZAVORTH_AG_E2E_RESPONSE_OK_1774466238602\nworkspace=zavorth');
  });
});
