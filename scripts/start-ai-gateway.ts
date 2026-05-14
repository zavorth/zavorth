#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { AIGatewayProxyService } from '../src/services/AIGatewayProxyService.js';

function ensureGatewayOverlay(): void {
  const normalizedToken = String(config.cloudflareAiGatewayToken || '').trim();
  if (!normalizedToken) {
    return;
  }

  const overlayPath = path.resolve(config.AIGatewayOverlayFile);
  let current: { headers?: Record<string, string> } = {};
  try {
    if (fs.existsSync(overlayPath)) {
      current = JSON.parse(fs.readFileSync(overlayPath, 'utf8')) as { headers?: Record<string, string> };
    }
  } catch {
    current = {};
  }

  const next = {
    ...current,
    headers: {
      ...(current.headers || {}),
      'cf-aig-authorization': normalizedToken.startsWith('Bearer ') ? normalizedToken : `Bearer ${normalizedToken}`,
    },
  };

  fs.mkdirSync(path.dirname(overlayPath), { recursive: true });
  fs.writeFileSync(overlayPath, JSON.stringify(next, null, 2), 'utf8');
}

async function main(): Promise<void> {
  ensureGatewayOverlay();
  const gateway = new AIGatewayProxyService();
  const status = await gateway.start();
  console.log(`[start-ai-gateway] enabled=${status.enabled} ready=${status.ready} base=${status.baseUrl}`);

  const shutdown = async () => {
    await gateway.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
}

main().catch((error) => {
  console.error(`[start-ai-gateway] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
