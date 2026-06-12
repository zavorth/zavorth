#!/usr/bin/env node
import { McpManagementService } from '../src/mcp/McpManagementService.js';
import { McpToolPolicyFileService } from '../src/services/McpToolPolicyFileService.js';

const args = process.argv.slice(2);
const commandName = args[0] || 'list';

main().catch((error) => {
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  } else {
    console.error(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
});

async function main(): Promise<void> {
  const managementService = new McpManagementService();
  const policyFileService = new McpToolPolicyFileService();

  if (commandName === 'list') {
    const servers = managementService.list();
    const doc = policyFileService.readPolicy();
    const policy = policyFileService.getMcpToolPolicy(process.env);
    const activeTools = Object.keys(doc.tools || {});

    const toolsList = Object.entries(doc.tools || {}).map(([id, entry]) => {
      const globalDecision = policy.decide(id, activeTools);
      const effectiveAllowed = entry.status === 'approved' && globalDecision.allowed;
      return {
        id,
        status: entry.status,
        inAllowlist: (doc.allowlist || []).includes(id),
        effectiveAllowed,
        fingerprint: entry.fingerprint,
        description: entry.description || entry.lastSeenDescription || '',
        pendingReason: entry.pendingReason,
        reason: globalDecision.reason,
      };
    });

    if (args.includes('--json')) {
      console.log(JSON.stringify({
        ok: true,
        servers: servers.map((s) => ({
          id: s.id,
          enabled: s.enabled !== false,
          command: s.command,
          args: s.args || [],
          env: s.env || {},
          capability: s.capability,
        })),
        tools: toolsList,
      }, null, 2));
    } else {
      console.log('=== MCP SERVERS ===');
      if (servers.length === 0) {
        console.log('(Nenhum servidor MCP registrado)');
      } else {
        for (const s of servers) {
          console.log(`- ${s.id} [${s.enabled !== false ? 'ENABLED' : 'DISABLED'}]: ${s.command} ${(s.args || []).join(' ')}`);
        }
      }
      console.log('\n=== MCP TOOLS POLICY ===');
      if (toolsList.length === 0) {
        console.log('(Nenhuma ferramenta registrada na politica)');
      } else {
        for (const t of toolsList) {
          const statusLabel = t.effectiveAllowed ? 'ALLOWED' : `BLOCKED (${t.status})`;
          console.log(`- ${t.id} [${statusLabel}]`);
          console.log(`  Fingerprint: ${t.fingerprint}`);
          if (t.pendingReason) console.log(`  Pending Reason: ${t.pendingReason}`);
          if (t.description) console.log(`  Description: ${t.description}`);
          if (t.reason) console.log(`  Policy Detail: ${t.reason}`);
        }
      }
    }
    return;
  }

  if (commandName === 'add') {
    const id = args[1];
    if (!id) {
      throw new Error('Uso: zavorth-mcp-install add <id> --command <command> [--args <args>] [--env <KEY=VALUE>]');
    }
    
    // ID validation
    if (!/^[A-Za-z0-9._-]+$/.test(id)) {
      throw new Error(`ID de servidor invalido "${id}". Deve corresponder ao padrao ^[A-Za-z0-9._-]+$ e nao conter ":"`);
    }

    const command = readFlag('--command');
    if (!command) {
      throw new Error('O parametro --command e obrigatorio para adicionar um servidor.');
    }

    const rawArgs = readFlag('--args');
    const mcpArgs = rawArgs ? rawArgs.split(',').map((a) => a.trim()) : [];

    const rawEnv = readFlag('--env');
    const env: Record<string, string> = {};
    if (rawEnv) {
      const persistEnv = args.includes('--persist-env-values');
      if (!persistEnv) {
        throw new Error(
          'WARNING: Gravar segredos diretamente no manifesto nao e recomendado. Use --allowed-env para herdar variaveis do host, ou passe a flag --persist-env-values para autorizar a gravacao direta.'
        );
      }
      rawEnv.split(',').forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          const k = pair.slice(0, idx).trim();
          const v = pair.slice(idx + 1).trim();
          if (k) env[k] = v;
        }
      });
    }

    const rawAllowedEnv = readFlag('--allowed-env');
    const allowedEnv = rawAllowedEnv ? rawAllowedEnv.split(',').map((a) => a.trim()) : [];

    const capability = readFlag('--capability');

    const result = managementService.install({
      id,
      command,
      args: mcpArgs,
      env,
      capability: capability || undefined,
      enabled: true,
    });

    // If allowedEnv was specified, we need to mutate the created entry since McpManagementService install signature is basic.
    if (allowedEnv.length > 0) {
      const manifest = (managementService as any).readManifest();
      const idx = manifest.findIndex((entry: any) => String(entry.id).toLowerCase() === id.toLowerCase());
      if (idx >= 0) {
        manifest[idx].allowedEnv = allowedEnv;
        (managementService as any).writeManifest(manifest);
      }
    }

    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.message);
    }
    return;
  }

  if (commandName === 'remove') {
    const id = args[1];
    if (!id) {
      throw new Error('Uso: zavorth-mcp-install remove <id>');
    }
    const result = managementService.remove(id);
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.message);
    }
    return;
  }

  if (commandName === 'enable' || commandName === 'disable') {
    const id = args[1];
    if (!id) {
      throw new Error(`Uso: zavorth-mcp-install ${commandName} <id>`);
    }
    const result = managementService.setEnabled(id, commandName === 'enable');
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.message);
    }
    return;
  }

  if (commandName === 'approve') {
    const toolId = args[1];
    if (!toolId) {
      throw new Error('Uso: zavorth-mcp-install approve <serverId:toolName> [--fingerprint <fp>] [--description <desc>] [--force-fingerprint]');
    }

    const fingerprint = readFlag('--fingerprint') || undefined;
    const description = readFlag('--description') || undefined;
    const forceFingerprint = args.includes('--force-fingerprint');

    const doc = policyFileService.readPolicy();
    policyFileService.approveTool(doc, toolId, fingerprint, description, forceFingerprint);
    policyFileService.savePolicy(doc);

    if (args.includes('--json')) {
      console.log(JSON.stringify({ ok: true, toolId, action: 'approved' }, null, 2));
    } else {
      console.log(`Ferramenta "${toolId}" aprovada com sucesso e adicionada a allowlist.`);
    }
    return;
  }

  if (commandName === 'block') {
    const toolId = args[1];
    if (!toolId) {
      throw new Error('Uso: zavorth-mcp-install block <serverId:toolName>');
    }

    const doc = policyFileService.readPolicy();
    policyFileService.blockTool(doc, toolId);
    policyFileService.savePolicy(doc);

    if (args.includes('--json')) {
      console.log(JSON.stringify({ ok: true, toolId, action: 'blocked' }, null, 2));
    } else {
      console.log(`Ferramenta "${toolId}" bloqueada com sucesso e removida da allowlist.`);
    }
    return;
  }

  if (commandName === 'forget') {
    const toolId = args[1];
    if (!toolId) {
      throw new Error('Uso: zavorth-mcp-install forget <serverId:toolName>');
    }

    const doc = policyFileService.readPolicy();
    policyFileService.forgetTool(doc, toolId);
    policyFileService.savePolicy(doc);

    if (args.includes('--json')) {
      console.log(JSON.stringify({ ok: true, toolId, action: 'forgotten' }, null, 2));
    } else {
      console.log(`Ferramenta "${toolId}" esquecida e removida da allowlist.`);
    }
    return;
  }

  throw new Error(`Comando desconhecido: "${commandName}"`);
}

function readFlag(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1).trim() || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() || null : null;
}
