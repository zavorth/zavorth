import { formatOfficialInstallReport } from '../../scripts/lib/runtime-official-install.js';

describe('runtime-official-install presentation', () => {
  it('renders the official go flow without leaking legacy trust commands', () => {
    const report: any = {
      generatedAt: '2026-04-23T00:00:00.000Z',
      summary: 'O caminho oficial ainda precisa preparar o runtime antes de abrir a melhor superficie.',
      tokenSource: 'file',
      journey: {
        summary: 'Zavorth ainda nao esta pronto para uso consistente: O host supervisor nao esta ativo.',
      },
      manifest: {
        commands: {
          go: 'zavorth go',
          trust: '/hostauth trust',
        },
      },
      readiness: {},
      local: {
        ready: false,
        appUrl: 'http://127.0.0.1:33333/dashboard',
        trust: {
          attempted: false,
          applied: false,
          statusCode: null,
          error: null,
        },
      },
      remote: {
        configured: false,
        appUrl: null,
        appProbe: null,
        authProbe: null,
        issues: ['ZAVORTH_PUBLIC_BASE_URL ainda nao foi configurada.'],
        ready: false,
      },
      nextSteps: [
        'Autorize este host com /hostauth trust ou rode zavorth go para aplicar o trust local pelo caminho oficial.',
      ],
    };

    const output = formatOfficialInstallReport(report, {
      eyebrow: 'Zavorth go',
      title: 'Zavorth ainda precisa de um ajuste',
      dryRun: true,
      currentCommand: 'zavorth go',
    });

    expect(output).toContain('Zavorth ainda precisa de um ajuste');
    expect(output).toContain('Faca agora');
    expect(output).toContain('Saia do dry-run quando quiser que o Zavorth tente aplicar');
    expect(output).toContain('Use zavorth doctor se quiser ver exatamente o que ainda esta bloqueando');
    expect(output).toContain('antes de abrir a melhor entrada');
    expect(output).not.toContain('/hostauth trust');
    expect(output).not.toContain('Rode zavorth go');
    expect(output).not.toContain('Siga pelo atalho oficial com zavorth go');
    expect(output).not.toContain('melhor superficie');
  });
});
