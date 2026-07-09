#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { McpManagementService } from '../src/mcp/McpManagementService.js';
import { McpDiscoverySandbox, SafeMcpInstaller } from '../src/mcp/SafeMcpInstaller.js';
import { McpToolPolicyFileService } from '../src/services/McpToolPolicyFileService.js';
import { SecurityAuditLogger } from '../src/services/SecurityAuditLogger.js';
import { LogRepository } from '../src/storage/LogRepository.js';

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

  let auditLoggerInstance: SecurityAuditLogger | null = null;
  async function getAuditLogger(): Promise<SecurityAuditLogger> {
    if (!auditLoggerInstance) {
      const logRepo = new LogRepository();
      await logRepo.init().catch(() => {});
      auditLoggerInstance = new SecurityAuditLogger(logRepo);
    }
    return auditLoggerInstance;
  }

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

  if (commandName === 'install') {
    const id = args[1];
    if (!id) {
      throw new Error('Usage: zavorth-mcp-install install <id> --command <command> --confirm-install [--confirm-risk]');
    }

    const command = readFlag('--command');
    if (!command) {
      throw new Error('The --command parameter is required to install an MCP server.');
    }

    if (!/^[A-Za-z0-9._-]+$/.test(id)) {
      throw new Error(`Invalid MCP server id "${id}". It must match ^[A-Za-z0-9._-]+$ and must not contain ":".`);
    }

    const rawArgs = readFlag('--args');
    const mcpArgs = rawArgs ? rawArgs.split(',').map((a) => a.trim()).filter(Boolean) : [];
    const rawAllowedEnv = readFlag('--allowed-env');
    const allowedEnv = rawAllowedEnv ? rawAllowedEnv.split(',').map((a) => a.trim()).filter(Boolean) : [];
    const rawEnv = readFlag('--env');
    const env: Record<string, string> = {};
    if (rawEnv) {
      rawEnv.split(',').forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          const key = pair.slice(0, idx).trim();
          if (key && allowedEnv.includes(key)) {
            env[key] = pair.slice(idx + 1).trim();
          }
        }
      });
    }

    const discoveryFixture = readFlag('--discovery-fixture');
    const sandbox = new McpDiscoverySandbox({
      runner: async () => {
        if (!discoveryFixture) {
          return {
            ok: false,
            tools: [],
            stdout: '',
            stderr: '',
            error: 'No safe discovery fixture or runner was provided.',
          };
        }
        const parsed = JSON.parse(fs.readFileSync(path.resolve(discoveryFixture), 'utf8'));
        return {
          ok: parsed.ok !== false,
          tools: Array.isArray(parsed.tools) ? parsed.tools : [],
          stdout: String(parsed.stdout || ''),
          stderr: String(parsed.stderr || ''),
          error: parsed.error ? String(parsed.error) : undefined,
        };
      },
    });

    const manifestPath = path.resolve(process.env.ZAVORTH_MCP_SERVERS_MANIFEST_PATH || config.mcpServersManifestPath);
    const installer = new SafeMcpInstaller({
      manifestStore: {
        list: () => {
          try {
            const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        save: (manifest) => {
          fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
          fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        },
      },
      policyStore: {
        read: () => policyFileService.readPolicy(),
        save: (policy) => {
          policyFileService.savePolicy(policy);
        },
      },
      discovery: sandbox,
      auditSink: {
        write: async () => {
          (await getAuditLogger()).logCliAdminEvent({
            event: 'mcp_server_added',
            actor: 'local-cli',
            source: 'zavorth-mcp-install',
            serverId: id,
          });
        },
      },
    });

    const result = await installer.install({
      id,
      command,
      args: mcpArgs,
      env,
      allowedEnv,
      capability: readFlag('--capability') || undefined,
      confirmInstall: args.includes('--confirm-install'),
      confirmRisk: args.includes('--confirm-risk'),
      timeoutMs: Number(readFlag('--timeout-ms') || 5000),
    });

    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.ok) {
      console.log(result.summary);
    } else {
      console.error(result.errors.join('\n'));
      process.exitCode = 1;
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
    const discoveryFixture = readFlag('--discovery-fixture');
    const sandbox = new McpDiscoverySandbox({
      runner: async () => {
        if (!discoveryFixture) {
          // Default add path registers the server without live discovery when no fixture is provided.
          return {
            ok: true,
            tools: [],
            stdout: '',
            stderr: '',
          };
        }
        const parsed = JSON.parse(fs.readFileSync(path.resolve(discoveryFixture), 'utf8'));
        return {
          ok: parsed.ok !== false,
          tools: Array.isArray(parsed.tools) ? parsed.tools : [],
          stdout: String(parsed.stdout || ''),
          stderr: String(parsed.stderr || ''),
          error: parsed.error ? String(parsed.error) : undefined,
        };
      },
    });
    const manifestPath = path.resolve(process.env.ZAVORTH_MCP_SERVERS_MANIFEST_PATH || config.mcpServersManifestPath);
    const installer = new SafeMcpInstaller({
      manifestStore: {
        list: () => {
          try {
            const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        save: (manifest) => {
          fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
          fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        },
      },
      policyStore: {
        read: () => policyFileService.readPolicy(),
        save: (policy) => {
          policyFileService.savePolicy(policy);
        },
      },
      discovery: sandbox,
      auditSink: {
        write: async () => {
          (await getAuditLogger()).logCliAdminEvent({
            event: 'mcp_server_added',
            actor: 'local-cli',
            source: 'zavorth-mcp-install',
            serverId: id,
          });
        },
      },
    });

    const result = await installer.install({
      id,
      command,
      args: mcpArgs,
      env,
      allowedEnv,
      capability: capability || undefined,
      // Legacy `add` keeps opt-in consent; tests and automation pass --confirm-install.
      confirmInstall: args.includes('--confirm-install') || args.includes('--yes') || args.includes('-y'),
      confirmRisk: args.includes('--confirm-risk'),
      timeoutMs: Number(readFlag('--timeout-ms') || 5000),
    });

    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.ok) {
      console.log(result.summary || `MCP server ${id} adicionado ao manifesto com sucesso.`);
    } else {
      console.error(result.errors.join('\n'));
      process.exitCode = 1;
    }
    return;
  }

  if (commandName === 'remove') {
    const id = args[1];
    if (!id) {
      throw new Error('Uso: zavorth-mcp-install remove <id>');
    }
    const result = managementService.remove(id);
    
    (await getAuditLogger()).logCliAdminEvent({
      event: 'mcp_server_removed',
      actor: 'local-cli',
      source: 'zavorth-mcp-install',
      serverId: id,
    });

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

    (await getAuditLogger()).logCliAdminEvent({
      event: commandName === 'enable' ? 'mcp_server_enabled' : 'mcp_server_disabled',
      actor: 'local-cli',
      source: 'zavorth-mcp-install',
      serverId: id,
    });

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
    const previousStatus = doc.tools?.[toolId]?.status || 'unknown';
    policyFileService.approveTool(doc, toolId, fingerprint, description, forceFingerprint);
    policyFileService.savePolicy(doc);

    (await getAuditLogger()).logCliAdminEvent({
      event: 'mcp_tool_approved',
      actor: 'local-cli',
      source: 'zavorth-mcp-install',
      toolId,
      previousStatus,
      newStatus: 'approved',
      fingerprint: fingerprint || doc.tools?.[toolId]?.fingerprint,
      allowlistChanged: true,
    });

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
    const previousStatus = doc.tools?.[toolId]?.status || 'unknown';
    policyFileService.blockTool(doc, toolId);
    policyFileService.savePolicy(doc);

    (await getAuditLogger()).logCliAdminEvent({
      event: 'mcp_tool_blocked_by_admin',
      actor: 'local-cli',
      source: 'zavorth-mcp-install',
      toolId,
      previousStatus,
      newStatus: 'blocked',
      allowlistChanged: true,
    });

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
    const previousStatus = doc.tools?.[toolId]?.status || 'unknown';
    policyFileService.forgetTool(doc, toolId);
    policyFileService.savePolicy(doc);

    (await getAuditLogger()).logCliAdminEvent({
      event: 'mcp_tool_forgotten',
      actor: 'local-cli',
      source: 'zavorth-mcp-install',
      toolId,
      previousStatus,
      allowlistChanged: true,
    });

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
