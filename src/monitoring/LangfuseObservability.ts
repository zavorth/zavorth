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
 * Singleton observability builder.
 * Allows OpenTelemetry when Langfuse API credentials exist,
 * and fails gracefully while keeping console output clean.
 */
export class LangfuseObservability {
  private static handler: CallbackHandlerLike | null = null;

  public static getHandler(): CallbackHandlerLike | null {
    if (this.handler) return this.handler;

    // If Langfuse keys do not exist because the host uses self-hosted Docker
    // or has opted out of cost tracking, keep the app running.
    const pk = process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY;
    const sk = process.env.LANGFUSE_SECRET_KEY;
    const burl = process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com';

    if (!pk || !sk) {
      console.warn(
        '[Observability] Langfuse is inactive. Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY. Cost tracking is paused.',
      );
      return null;
    }

    try {
      const { CallbackHandler } = localRequire('langfuse-langchain') as LangfuseLangchainModule;
      this.handler = new CallbackHandler({
        publicKey: pk,
        secretKey: sk,
        baseUrl: burl,
      });
      console.log(
        '[Observability] Langfuse OpenTelemetry is active and recording generator/critic conversations with cost tracking enabled.',
      );
      return this.handler;
    } catch (err: any) {
      console.warn(`[Observability] Failed to instantiate Langfuse: ${err.message}`);
      return null;
    }
  }
}
