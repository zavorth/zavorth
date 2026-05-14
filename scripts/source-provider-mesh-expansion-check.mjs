#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'source-provider-mesh-phase-3-files',
    label: 'Phase 3 files exist',
    target: 'contract, adapters, credential routes, expansion service, command, tests and package scripts are present',
    files: [
      'src/contracts/SourceProviderMeshExpansionContract.ts',
      'src/adapters/providers/AnthropicDirectProviderAdapter.ts',
      'src/adapters/providers/AnthropicVertexProviderAdapter.ts',
      'src/adapters/providers/BedrockClaudeProviderAdapter.ts',
      'src/adapters/providers/GoogleGenAiProviderAdapter.ts',
      'src/services/SourceProviderCredentialRouteService.ts',
      'src/services/SourceProviderMeshExpansionService.ts',
      'scripts/source-provider-mesh-expansion.ts',
      'tests/services/SourceProviderMeshExpansionService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'source-provider-mesh-contract',
    label: 'Contract captures Provider Mesh expansion vocabulary',
    target: 'contract includes provider runtime contract, package evidence, credential routes and Phase 3 snapshot',
    files: ['src/contracts/SourceProviderMeshExpansionContract.ts'],
    needles: [
      'ZAVORTH_SOURCE_PROVIDER_MESH_EXPANSION_CONTRACT_VERSION',
      'ProviderRuntimeContract',
      'SOURCE_PROVIDER_MESH_PACKAGES',
      '@anthropic-ai/sdk',
      '@anthropic-ai/vertex-sdk',
      '@aws-sdk/client-bedrock-runtime',
      '@google/genai',
      'noAnthropicApiImpersonation',
    ],
  }),
  ruleContainsAll({
    id: 'source-provider-mesh-adapters',
    label: 'Adapters provide explicit provider routes',
    target: 'direct Anthropic, Vertex, Bedrock and Google GenAI adapters implement ILlmProvider',
    files: [
      'src/adapters/providers/AnthropicDirectProviderAdapter.ts',
      'src/adapters/providers/AnthropicVertexProviderAdapter.ts',
      'src/adapters/providers/BedrockClaudeProviderAdapter.ts',
      'src/adapters/providers/GoogleGenAiProviderAdapter.ts',
    ],
    needles: [
      'implements ILlmProvider',
      'isConfigured()',
      'requires',
      'chat(',
    ],
  }),
  ruleContainsAll({
    id: 'source-provider-mesh-service',
    label: 'Expansion service scans and certifies routes',
    target: 'service scans Source/Zavorth package evidence, credential routes, ProviderFactory routes and local model policy',
    files: ['src/services/SourceProviderMeshExpansionService.ts'],
    needles: [
      'buildSnapshot',
      'buildPackageEvidence',
      'ProviderFactory.resolveRuntimeTarget',
      'anthropic-direct',
      'anthropic-vertex',
      'bedrock-claude',
      'google-genai',
      'Use Provider Mesh via Ollama',
      'Phase 4 - Channel Mesh Expansion Pack',
    ],
  }),
  ruleContainsAcross({
    id: 'provider-factory-exposes-phase-3-routes',
    label: 'ProviderFactory exposes Phase 3 routes',
    target: 'ProviderFactory and LlmRuntimeService know explicit Anthropic, Vertex, Bedrock, Google GenAI and local routes',
    files: [
      'src/providers/ProviderFactory.ts',
      'src/services/llm/LlmRuntimeService.ts',
      'tests/services/SourceProviderMeshExpansionService.test.ts',
    ],
    needles: [
      'AnthropicDirectProviderAdapter',
      'AnthropicVertexProviderAdapter',
      'BedrockClaudeProviderAdapter',
      'GoogleGenAiProviderAdapter',
      'anthropic-direct',
      'anthropic-vertex',
      'bedrock-claude',
      'google-genai',
      'lmstudio',
      'vllm',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-source-provider-mesh-gate',
    label: 'package exposes Phase 3 gates and dependencies',
    target: 'operators can inspect, inspect JSON, run check/QA and dependencies are direct',
    files: ['package.json'],
    needles: [
      'source-provider-mesh-expansion',
      'source-provider-mesh-expansion:json',
      'source-provider-mesh-expansion:check',
      'qa:source-provider-mesh-expansion',
      '@anthropic-ai/sdk',
      '@anthropic-ai/vertex-sdk',
      '@aws-sdk/client-bedrock-runtime',
      '@google/genai',
      'proxy-agent',
      'https-proxy-agent',
      'undici',
    ],
  }),
  runRuntimeRule(),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[source-provider-mesh-expansion] checking Phase 3');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[source-provider-mesh-expansion] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runRuntimeRule() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/source-provider-mesh-expansion.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'source-provider-mesh-runtime-receipt',
      label: 'Runtime Provider Mesh receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Phase 3 command emits a passing provider mesh snapshot against the current Source checkout',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    return {
      id: 'source-provider-mesh-runtime-receipt',
      label: 'Runtime Provider Mesh receipt passes',
      status: receipt.status === 'passed' ? 'passed' : 'failed',
      observed: `status=${receipt.status}, adaptersReady=${receipt.summary?.adaptersReady}, providerFactoryRoutes=${receipt.summary?.providerFactoryRoutes}`,
      target: 'Phase 3 command emits a passing provider mesh snapshot against the current Source checkout',
      details: [
        `packagesPresentInSource=${receipt.summary?.packagesPresentInSource}`,
        `packagesImplementedInZavorth=${receipt.summary?.packagesImplementedInZavorth}`,
        `enabledByDefault=${receipt.summary?.enabledByDefault}`,
        `liveIoPerformed=${receipt.summary?.liveIoPerformed}`,
        `next=${receipt.commands?.nextPhase}`,
      ],
    };
  } catch (error) {
    return {
      id: 'source-provider-mesh-runtime-receipt',
      label: 'Runtime Provider Mesh receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Phase 3 command emits a passing provider mesh snapshot against the current Source checkout',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function ruleContainsAcross(input) {
  const contentsByFile = input.files.map((file) => ({
    file,
    contents: read(file),
  }));
  const missingFiles = contentsByFile
    .filter((entry) => entry.contents === null)
    .map((entry) => `missing ${entry.file}`);
  const missingNeedles = input.needles
    .filter((needle) => !contentsByFile.some((entry) => entry.contents?.includes(needle)))
    .map((needle) => `missing ${needle}`);
  const missing = [...missingFiles, ...missingNeedles];
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present across files',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}

function compactDetails(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r?\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
