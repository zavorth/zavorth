type BuildReadyGuideInput = {
  accessUrl: string;
  mode: 'public' | 'lan';
  expiresAt: string | null;
  requiresPassword: boolean;
  secret: string | null;
  limitations: string[];
};

type BuildBlockedGuideInput = {
  recommendations: string[];
  limitations: string[];
  manualSteps?: string[];
};

export type ZavorthBridgeMobileGuide = {
  headline: string;
  summary: string;
  steps: string[];
  notes: string[];
};

export class ZavorthBridgeMobileGuideService {
  public buildReadyGuide(input: BuildReadyGuideInput): ZavorthBridgeMobileGuide {
    const accessKind = input.mode === 'public' ? 'link publico' : 'link da rede local';
    const steps = [
      input.mode === 'public'
        ? `Abra ${input.accessUrl} no navegador do celular.`
        : `Conecte o celular na mesma rede do host e abra ${input.accessUrl}.`,
      input.requiresPassword
        ? `Use a senha atual do remoto: ${input.secret || 'senha configurada no host'}.`
        : 'Entre direto; o remoto atual nao exige senha extra.',
      'Mantenha a sessao do Windows desbloqueada enquanto estiver usando o ZavorthBridge remotamente.',
      'Quando terminar, peca ao Zavorth para encerrar o acesso com /agmobile stop.',
    ];
    const notes = [
      input.expiresAt ? `O acesso atual expira em ${input.expiresAt}.` : 'Este acesso segue ativo ate voce encerrar manualmente.',
      ...input.limitations,
    ];
    return {
      headline: `ZavorthBridge pronto para celular via ${accessKind}.`,
      summary: input.mode === 'public'
        ? 'O remoto do ZavorthBridge esta com rota publica ativa.'
        : 'O remoto do ZavorthBridge esta pronto, mas limitado a dispositivos na mesma rede.',
      steps,
      notes,
    };
  }

  public buildBlockedGuide(input: BuildBlockedGuideInput): ZavorthBridgeMobileGuide {
    const steps = [
      ...(input.manualSteps || []),
      ...input.recommendations,
    ].filter(Boolean);
    return {
      headline: 'ZavorthBridge ainda nao ficou pronto para uso no celular.',
      summary: steps[0] || 'Ainda existem pendencias antes de liberar o acesso movel.',
      steps: steps.length > 0 ? steps : ['Revise o doctor do remoto do ZavorthBridge antes de tentar novamente.'],
      notes: input.limitations,
    };
  }
}
