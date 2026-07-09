#!/usr/bin/env node

import { IntegrationHubService } from '../src/services/IntegrationHubService.js';

function getOptionValue(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  const direct = argv.find((entry) => entry.startsWith(prefix));
  if (direct) {
    return direct.slice(prefix.length);
  }

  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0) {
    return argv[index + 1] || null;
  }

  return null;
}

function getOptionValues(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (entry === name && argv[index + 1]) {
      values.push(argv[index + 1]);
      continue;
    }
    if (entry.startsWith(`${name}=`)) {
      values.push(entry.slice(name.length + 1));
    }
  }
  return values;
}

function parseAnswerEntries(entries: string[]): Record<string, string | string[] | boolean> {
  const answers: Record<string, string | string[] | boolean> = {};
  for (const entry of entries) {
    const splitIndex = entry.indexOf('=');
    if (splitIndex < 0) {
      continue;
    }
    const key = entry.slice(0, splitIndex).trim();
    const rawValue = entry.slice(splitIndex + 1).trim();
    if (!key) {
      continue;
    }

    if (/^(true|false)$/i.test(rawValue)) {
      answers[key] = rawValue.toLowerCase() === 'true';
      continue;
    }

    if (rawValue.includes(',')) {
      answers[key] = rawValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    answers[key] = rawValue;
  }

  return answers;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = (argv[0] || 'list').trim().toLowerCase();
  const json = argv.includes('--json');
  const hub = new IntegrationHubService();

  if (command === 'list') {
    const entries = hub.listCatalogEntries();
    if (json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    console.log(hub.renderCatalogReport());
    return;
  }

  if (command === 'show') {
    const id = getOptionValue(argv, '--id') || argv[1] || '';
    if (!id) {
      throw new Error('Informe o id da integracao: npm run integrations:show -- --id openrouter');
    }

    if (json) {
      const manifest = hub.listCatalogEntries().find((entry) => entry.manifest.id === id || entry.manifest.aliases.includes(id));
      console.log(JSON.stringify(manifest || null, null, 2));
      return;
    }

    console.log(hub.renderManifestReport(id));
    return;
  }

  if (command === 'connect' || command === 'draft') {
    const requestedId = getOptionValue(argv, '--id') || argv[1] || '';
    if (!requestedId) {
      throw new Error('Informe a integracao desejada: npm run integrations:draft -- --id zerocloud');
    }

    const answers = parseAnswerEntries(getOptionValues(argv, '--answer'));
    const enabledCapabilities = (getOptionValue(argv, '--capabilities') || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const draft = hub.buildDraft({
      requestedId,
      requestedBy: getOptionValue(argv, '--requested-by'),
      nickname: getOptionValue(argv, '--nickname'),
      selectedMode: getOptionValue(argv, '--mode'),
      enabledCapabilities: enabledCapabilities.length > 0 ? enabledCapabilities : null,
      answers,
      persist: !argv.includes('--no-persist'),
    });

    if (json) {
      console.log(JSON.stringify(draft, null, 2));
      return;
    }

    console.log(
      hub.renderConnectReport({
        requestedId,
        requestedBy: getOptionValue(argv, '--requested-by'),
        nickname: getOptionValue(argv, '--nickname'),
        selectedMode: getOptionValue(argv, '--mode'),
        enabledCapabilities: enabledCapabilities.length > 0 ? enabledCapabilities : null,
        answers,
        persist: !argv.includes('--no-persist'),
      }),
    );
    return;
  }

  if (command === 'doctor') {
    const id = getOptionValue(argv, '--id') || argv[1] || null;
    if (json) {
      console.log(JSON.stringify(id ? hub.getDoctorSnapshot(id) : hub.getDoctorSnapshots(), null, 2));
      return;
    }
    console.log(hub.renderDoctorReport(id));
    return;
  }

  throw new Error(`Comando desconhecido: ${command}`);
}

main().catch((error: unknown) => {
  console.error(`[integration-hub] erro: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
