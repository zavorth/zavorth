import * as fs from 'fs';
import * as path from 'path';
import type { ZavorthCliFlags, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';

type RegistryCommandParams = {
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

const PROVIDER_TEMPLATE = `import type { ProviderPlugin } from './ProviderPluginManifest.js';

const {{NAME}}Plugin: ProviderPlugin = {
  manifest: {
    name: '{{NAME}}',
    aliases: [{{ALIASES}}],
    description: '{{DESCRIPTION}}',
    authType: 'api_key',
    envVars: ['{{ENV_PREFIX}}_API_KEY'],
    baseUrl: '{{BASE_URL}}',
    defaultModel: '{{DEFAULT_MODEL}}',
  },
  create: (target) => {
    // TODO: Implement your provider here
    // Return an object that implements ILlmProvider
    throw new Error('Provider "{{NAME}}" not yet implemented');
  },
};

export default {{NAME}}Plugin;
`;

const SKILL_TEMPLATE = `---
name: {{NAME}}
description: {{DESCRIPTION}}
---

# {{NAME}}

## Instructions

Write your skill instructions here.
`;

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toEnvPrefix(str: string): string {
  return str.replace(/[^A-Z0-9]+/gi, '_').toUpperCase();
}

function generateProvider(args: string, writer: CliWriter): CliExecutionResult {
  const tokens = args.trim().split(/\s+/);
  const name = tokens[0];

  if (!name) {
    writer.error('Usage: scaffold provider <name> [--base-url=URL] [--model=MODEL]');
    return { ok: false, handled: true, output: [], error: 'Missing provider name' };
  }

  const baseUrl = extractFlag(args, 'base-url') || 'https://api.example.com/v1';
  const model = extractFlag(args, 'model') || 'default-model';
  const description = extractFlag(args, 'description') || toPascalCase(name);
  const aliases = name.includes('-') ? `'${name.replace(/-/g, '_')}'` : '';

  const pluginsDir = path.join(__dirname, '..', 'providers', 'plugins');
  const filePath = path.join(pluginsDir, `${name}.plugin.ts`);

  if (fs.existsSync(filePath)) {
    writer.error(`Provider plugin already exists: ${filePath}`);
    return { ok: false, handled: true, output: [], error: 'Provider already exists' };
  }

  const content = PROVIDER_TEMPLATE
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{ALIASES\}\}/g, aliases)
    .replace(/\{\{DESCRIPTION\}\}/g, description)
    .replace(/\{\{ENV_PREFIX\}\}/g, toEnvPrefix(name))
    .replace(/\{\{BASE_URL\}\}/g, baseUrl)
    .replace(/\{\{DEFAULT_MODEL\}\}/g, model);

  fs.writeFileSync(filePath, content, 'utf-8');

  const body = [
    `Provider plugin created: ${filePath}`,
    '',
    'Next steps:',
    `1. Edit ${filePath} and implement the create() function`,
    `2. Set ${toEnvPrefix(name)}_API_KEY in your .env file`,
    '3. Restart Zavorth - the plugin will be auto-discovered',
  ].join('\n');

  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function generateSkill(args: string, writer: CliWriter): CliExecutionResult {
  const tokens = args.trim().split(/\s+/);
  const name = tokens[0];

  if (!name) {
    writer.error('Usage: scaffold skill <name> [--description=TEXT]');
    return { ok: false, handled: true, output: [], error: 'Missing skill name' };
  }

  const description = extractFlag(args, 'description') || `${toPascalCase(name)} skill`;
  const skillDir = path.join(__dirname, '..', '..', 'skill-library', name);

  if (fs.existsSync(skillDir)) {
    writer.error(`Skill already exists: ${skillDir}`);
    return { ok: false, handled: true, output: [], error: 'Skill already exists' };
  }

  fs.mkdirSync(skillDir, { recursive: true });

  const content = SKILL_TEMPLATE
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{DESCRIPTION\}\}/g, description);

  const filePath = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(filePath, content, 'utf-8');

  const body = [
    `Skill created: ${filePath}`,
    '',
    'Next steps:',
    `1. Edit ${filePath} and write your skill instructions`,
    '2. The skill will be auto-discovered on next session',
  ].join('\n');

  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function extractFlag(args: string, name: string): string | null {
  const match = args.match(new RegExp(`--${name}=(\\S+)`));
  return match ? match[1] : null;
}

export async function handleZavorthCliRegistryScaffoldCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { commandName, args, writer } = params;

  if (commandName !== 'scaffold' && commandName !== 'create' && commandName !== 'generate') {
    return null;
  }

  const tokens = args.trim().split(/\s+/);
  const subcommand = tokens[0]?.toLowerCase() || '';
  const remainingArgs = tokens.slice(1).join(' ');

  switch (subcommand) {
    case 'provider':
      return generateProvider(remainingArgs, writer);
    case 'skill':
      return generateSkill(remainingArgs, writer);
    default:
      writer.line([
        'Scaffold commands:',
        '',
        '  scaffold provider <name>  Create a new provider plugin',
        '  scaffold skill <name>     Create a new skill',
        '',
        'Options:',
        '  --base-url=URL           Provider base URL (for providers)',
        '  --model=MODEL            Default model name (for providers)',
        '  --description=TEXT       Description',
      ].join('\n'));
      return { ok: true, handled: true, output: [], error: null };
  }
}
