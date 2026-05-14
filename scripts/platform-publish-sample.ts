#!/usr/bin/env node

import path from 'path';
import { config } from '../src/config/index.js';
import {
  ZavorthPackagePublisher,
  type PublishResult,
} from '../src/platform/publish/ZavorthPackagePublisher.js';

type PublishSampleOptions = {
  packagePath?: string | null;
  outputDir?: string | null;
};

function readFlag(argv: string[], names: string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    for (const name of names) {
      if (token === name) {
        return String(argv[index + 1] || '').trim() || null;
      }
      if (token.startsWith(`${name}=`)) {
        return String(token.slice(name.length + 1) || '').trim() || null;
      }
    }
  }
  return null;
}

export async function publishSamplePackage(options: PublishSampleOptions = {}): Promise<PublishResult> {
  const projectRoot = config.projectRoot || process.cwd();
  const packagePath = path.resolve(
    projectRoot,
    options.packagePath || path.join('examples', 'extensions', 'hello-ecosystem'),
  );
  const publisher = new ZavorthPackagePublisher({
    registryEndpoint: '',
    outputDir: options.outputDir
      ? path.resolve(projectRoot, options.outputDir)
      : undefined,
  });

  return publisher.publishDetailed({
    packagePath,
    authToken: '',
    signLocal: true,
  });
}

function renderResult(result: PublishResult): string {
  return [
    '[platform-publish-sample] publish preparado concluido',
    `[platform-publish-sample] release: ${result.releaseId}`,
    `[platform-publish-sample] pacote: ${result.packageId}@${result.version}`,
    `[platform-publish-sample] arquivos: ${result.fileCount}`,
    `[platform-publish-sample] assinatura: ${result.signature}`,
    `[platform-publish-sample] saida: ${result.outputFile}`,
  ].join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const packagePath = readFlag(argv, ['--package', '--package-path']);
  const outputDir = readFlag(argv, ['--output', '--output-dir']);
  const result = await publishSamplePackage({ packagePath, outputDir });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${renderResult(result)}\n`);
}

if (path.basename(String(process.argv[1] || '')) === 'platform-publish-sample.ts') {
  main().catch((error) => {
    console.error(
      '[platform-publish-sample] falhou:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
