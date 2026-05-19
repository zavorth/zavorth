import { createRequire } from 'module';

const localRequire = createRequire(__filename);

type CallbackHandlerLike = {
  [key: string]: unknown;
};

type LangfuseLangchainModule = {
  CallbackHandler: new (input: {
    publicKey: string;
    secretKey: string;
    baseUrl: string;
  }) => CallbackHandlerLike;
};

/**
 * Singleton Observability Builder (Etapa 4).
 * Permite usar OpenTelemetry (se houver credenciais da API do Langfuse) 
 * ou falhar graciosamente mantendo os consoles limpos.
 */
export class LangfuseObservability {
  private static handler: CallbackHandlerLike | null = null;
  
  public static getHandler(): CallbackHandlerLike | null {
    if (this.handler) return this.handler;

    // Se as chaves do Langfuse não existirem (porque o host usa docker self-hosted 
    // ou opt-out de rastreamento de custos), evitamos quebrar a app.
    const pk = process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY;
    const sk = process.env.LANGFUSE_SECRET_KEY;
    const burl = process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com';

    if (!pk || !sk) {
      console.warn('⚠️ [Observabilidade] Langfuse (Caixa Preta) inativo. Falta variáveis de ambiente (LANGFUSE_PUBLIC_KEY e SECRET_KEY). Rastreamento de custo ($$) em pausa.');
      return null;
    }

    try {
      const { CallbackHandler } = localRequire('langfuse-langchain') as LangfuseLangchainModule;
      this.handler = new CallbackHandler({
        publicKey: pk,
        secretKey: sk,
        baseUrl: burl
      });
      console.log('👁️ [Observabilidade] Langfuse OpenTelemetry está vivo e gravando toda conversa do Gerador e Crítico (Custos $ Ativos).');
      return this.handler;
    } catch (err: any) {
      console.warn(`[Observabilidade] Erro ao instanciar Langfuse: ${err.message}`);
      return null;
    }
  }
}
