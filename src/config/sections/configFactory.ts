import dotenv from 'dotenv';
import path from 'path';

import {
  findProjectRoot,
  readZavorthEnv,
  resolveDefaultZavorthProductMode,
  resolveDefaultZavorthProfile,
} from '../configHelpers';
import { buildChannelConfig, buildDiscordBridgeConfig } from './channelConfig';
import { buildExecutionHostConfig } from './executionHostConfig';
import { buildProviderConfig } from './providerConfig';
import { buildRuntimePathConfig } from './runtimePathConfig';
import { buildSurfaceConfig } from './surfaceConfig';
import { buildWebRuntimeConfig } from './webRuntimeConfig';

export function buildZavorthConfig() {
  const projectRoot = findProjectRoot();
  const publicTunnelStateFileFallback = path.resolve(
    projectRoot,
    'data',
    'runtime',
    'zavorth-public-tunnel.json',
  );

  // Keep dotenv loading centralized so src/config/index.ts stays a thin aggregator.
  if (process.env.NODE_ENV !== 'test') {
    dotenv.config({ path: path.join(projectRoot, '.env') });
  }

  const defaultProfile = resolveDefaultZavorthProfile(
    readZavorthEnv('ZAVORTH_PROFILE', 'core'),
  );
  const defaultProductMode = resolveDefaultZavorthProductMode(
    process.env.ZAVORTH_PRODUCT_MODE || '',
    defaultProfile,
  );

  return {
    projectRoot,
    ...buildSurfaceConfig(projectRoot, publicTunnelStateFileFallback),
    ...buildChannelConfig(projectRoot),
    ...buildWebRuntimeConfig(projectRoot),
    ...buildDiscordBridgeConfig(projectRoot),
    ...buildProviderConfig(projectRoot),
    ...buildExecutionHostConfig(projectRoot, defaultProfile, defaultProductMode),
    ...buildRuntimePathConfig(projectRoot, publicTunnelStateFileFallback),
  };
}

export type ZavorthConfig = ReturnType<typeof buildZavorthConfig>;
