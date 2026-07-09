import { CanonicalPublicApiService } from '../api/public/CanonicalPublicApiService.js';
import { PublicApiRouter } from '../api/public/PublicApiRouter.js';
import { configureCanonicalPublicApi } from '../api/public/endpoints.js';
import { CliChannelAdapter } from './channels/adapters/CliChannelAdapter.js';
import { TelegramChannelAdapter } from './channels/adapters/TelegramChannelAdapter.js';
import { WebChannelAdapter } from './channels/adapters/WebChannelAdapter.js';
import { GatewayHostService, type GatewayHostOptions } from './core/GatewayHostService.js';
import { GatewayRuntime } from './core/GatewayRuntime.js';
import { asErrorLike } from '../utils/errorLike';
import { logger } from '../logger.js';

type GatewayCoreBundle = {
  runtime: GatewayRuntime;
  apiRouter: PublicApiRouter;
  webAdapter: WebChannelAdapter;
};

async function buildGatewayCore(env: NodeJS.ProcessEnv): Promise<GatewayCoreBundle> {
  const runtime = new GatewayRuntime();
  const apiRouter = new PublicApiRouter();
  configureCanonicalPublicApi(apiRouter, new CanonicalPublicApiService({
    getRuntime: () => ({ webUserId: 'gateway-core' } as any),
    getGateway: () => null,
    getSessionPlane: () => null,
    getNodeMesh: () => null,
    getPlatformRegistry: () => null,
    getRemoteTransports: () => null,
    getOperationsHealth: () => null,
    getLearningPlane: () => null,
    getLayeredMemory: () => null,
  }));
  const webAdapter = new WebChannelAdapter(runtime.events, apiRouter);

  await runtime.registerChannel(new CliChannelAdapter(runtime.events));
  await runtime.registerChannel(webAdapter);
  await runtime.registerChannel(new TelegramChannelAdapter(runtime.events, env.TELEGRAM_BOT_TOKEN || ''));

  return {
    runtime,
    apiRouter,
    webAdapter,
  };
}

export async function bootstrapGateway(env: NodeJS.ProcessEnv): Promise<GatewayRuntime> {
  logger.info('[Bootstrap] Starting Gateway Core...');
  const { runtime } = await buildGatewayCore(env);
  await runtime.start();
  logger.info('[Bootstrap] Gateway Running. Ready for events.');

  try {
    const { getChannelPairingService } = await import('../services/ZavorthChannelPairingService.js');
    const pairingService = getChannelPairingService();
    const code = pairingService.generateCode();
    logger.info(`\n==================================================`);
    logger.info(`🔑 Zavorth Channel Pairing Code: ${code}`);
    logger.info(`Use this code to pair Telegram/WhatsApp/Discord.`);
    logger.info(`==================================================\n`);
  } catch (error: unknown) {
    const err = asErrorLike(error);

    logger.error('[Bootstrap] Failed to generate pairing code:', err);
  }

  return runtime;
}

export async function startGatewayHost(
  env: NodeJS.ProcessEnv,
  options: GatewayHostOptions = {},
): Promise<{ runtime: GatewayRuntime; host: GatewayHostService; url: string }> {
  logger.info('[Bootstrap] Starting Gateway Host...');
  const { runtime, apiRouter } = await buildGatewayCore(env);
  await runtime.start();
  const host = new GatewayHostService(runtime, apiRouter, {
    host: options.host || String(env.ZAVORTH_GATEWAY_HOST || '127.0.0.1'),
    port: Number.isFinite(options.port)
      ? options.port
      : Number(env.ZAVORTH_GATEWAY_PORT || env.PORT || 3000),
  });
  const url = await host.start();
  logger.info(`[Bootstrap] Gateway Host listening on ${url}`);

  try {
    const { getChannelPairingService } = await import('../services/ZavorthChannelPairingService.js');
    const pairingService = getChannelPairingService();
    const code = pairingService.generateCode();
    logger.info(`\n==================================================`);
    logger.info(`🔑 Zavorth Channel Pairing Code: ${code}`);
    logger.info(`Use this code to pair Telegram/WhatsApp/Discord.`);
    logger.info(`==================================================\n`);
  } catch (error: unknown) {
    const err = asErrorLike(error);

    logger.error('[Bootstrap] Failed to generate pairing code:', err);
  }

  return { runtime, host, url };
}

async function runAsMain(): Promise<void> {
  const { host, runtime, url } = await startGatewayHost(process.env);
  const shutdown = async () => {
    await host.stop();
    await runtime.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  logger.info(`[Gateway] Running at ${url}`);
}

if (require.main === module) {
  void runAsMain().catch((error) => {
    logger.error('[Gateway] Failed to start host:', error);
    process.exit(1);
  });
}

export { GatewayRuntime } from './core/GatewayRuntime.js';
export { GatewayEventBus } from './events/GatewayEventBus.js';
export type { GatewayEvent } from './events/GatewayEventBus.js';
export { GatewayLifecycle } from './core/GatewayLifecycle.js';
export type { GatewayState } from './core/GatewayLifecycle.js';
export type { GatewayChannelAdapter } from './channels/GatewayChannelAdapter.js';
export { AcpGenericChannelAdapter } from './channels/adapters/AcpGenericChannelAdapter.js';
export { GatewaySessionRouter } from './session-routing/GatewaySessionRouter.js';
export type { GatewayClientSession } from './session-routing/GatewaySessionRouter.js';
