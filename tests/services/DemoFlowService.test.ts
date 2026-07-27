import { DemoFlowService } from '../../src/services/DemoFlowService';

describe('DemoFlowService', () => {
  it('formats an overview with the recommended sequence', () => {
    const service = new DemoFlowService();
    const text = service.formatOverview();

    expect(text).toContain('Roteiro de demo do Zavorth');
    expect(text).toContain('Modo demo: inactive.');
    expect(text).toContain('/demo research');
    expect(text).toContain('/demo files');
    expect(text).toContain('/demo workflow');
    expect(text).toContain('/demo stitch');
  });

  it('formats an individual scenario', () => {
    const service = new DemoFlowService();
    const text = service.formatScenario('workflow');

    expect(text).toContain('Cena de demo: Workflow composto');
    expect(text).toContain('/workflow research');
    expect(text).toContain('O que mostrar:');
    expect(text).toContain('Frase de apoio:');
    expect(text).toContain('Sinal de sucesso:');
  });

  it('returns null for unknown scenarios', () => {
    const service = new DemoFlowService();
    expect(service.formatScenario('desconhecido')).toBeNull();
  });

  it('formats a pitch and checklist for demos', () => {
    const service = new DemoFlowService();

    expect(service.formatPitch()).toContain('Pitch curto do Zavorth');
    expect(service.formatChecklist()).toContain('/demo on');
    expect(service.formatChecklist()).toContain('/demo start');
  });

  it('formats short and guided demo outputs', () => {
    const service = new DemoFlowService();

    expect(service.formatShortPresentation()).toContain('Apresentaction curta do Zavorth');
    expect(service.formatGuidedStart()).toContain('Guided sequence started.');
    expect(service.formatGuidedCompletion()).toContain('Suggested closure:');
    expect(service.formatGuidedStep(0)).toContain('Step 1/4: Pesquisa web');
    expect(service.formatGuidedStep(1)).toContain('Se aparecer permission:');
    expect(service.formatGuidedStep(99)).toBeNull();
  });
});
