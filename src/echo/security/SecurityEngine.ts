import { z } from 'zod';
import { IZavorthTool } from '../types/IZavorthTool';
import {
  ALLOWED_HA_ENTITY_PREFIXES,
  ALLOWED_MQTT_BROKERS,
  DESTRUCTIVE_REGEX,
  isBlockedSystemExecutable,
  isBlockedFilePath,
  isLocalNetworkHostname,
  isWhitelistedSystemExecutable,
  resolveBrowserTargetPolicy,
} from './WhitelistConfig';

const UNSAFE_OS_ARGUMENT_PATTERN = /[\r\n"`|<>^]/;

/**
 * Three-layer security gate for Echo tool execution.
 */
export class SecurityEngine {
  public static sanitizeIntent(prompt: string): void {
    for (const regex of DESTRUCTIVE_REGEX) {
      if (regex.test(prompt)) {
        throw new Error('SanitizationBlock: Intencao bloqueada por conter padroes destrutivos.');
      }
    }
  }

  public static validateToolSchema(tool: IZavorthTool, params: any): any {
    try {
      return tool.schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((entry) => `${entry.path.join('.')}: ${entry.message}`)
          .join(', ');
        throw new Error(`SchemaValidationBlock: parametros invalidos. Detalhes: ${issues}`);
      }
      throw new Error('SchemaValidationBlock: erro desconhecido de validacao.');
    }
  }

  public static validateExecutionSandbox(tool: IZavorthTool, params: any): void {
    switch (tool.category) {
      case 'OS':
        this.validateOsSandbox(tool.name, params);
        break;
      case 'IOT':
        this.validateIotSandbox(tool.name, params);
        break;
      case 'WEB':
        this.validateWebSandbox(tool.name, params);
        break;
      case 'INTERNAL':
        break;
    }
  }

  public static validateFileAccess(filePath: string): void {
    if (isBlockedFilePath(filePath)) {
      throw new Error(`SandboxBlock: acesso ao caminho '${filePath}' bloqueado por politica de seguranca.`);
    }
  }

  public static authorizeExecution(prompt: string, tool: IZavorthTool, params: any): any {
    this.sanitizeIntent(prompt);
    const safeParams = this.validateToolSchema(tool, params);
    this.validateExecutionSandbox(tool, safeParams);
    return safeParams;
  }

  private static validateOsSandbox(toolName: string, params: any): void {
    if (toolName !== 'os_open_app') {
      return;
    }

    const app = String(params.appName || '').toLowerCase().trim();
    if (!app || UNSAFE_OS_ARGUMENT_PATTERN.test(app)) {
      throw new Error(`SandboxBlock: aplicativo '${app}' contem caracteres inseguros.`);
    }

    if (isBlockedSystemExecutable(app)) {
      throw new Error(`SandboxBlock: aplicativo '${app}' bloqueado por politica de seguranca.`);
    }

    if (!isWhitelistedSystemExecutable(app)) {
      throw new Error(`SandboxBlock: o aplicativo '${app}' nao esta na whitelist de execucao segura.`);
    }

    const args = Array.isArray(params.args) ? params.args : [];
    for (const arg of args) {
      if (UNSAFE_OS_ARGUMENT_PATTERN.test(String(arg || ''))) {
        throw new Error(`SandboxBlock: argumento inseguro para '${app}'.`);
      }
    }
  }

  private static validateIotSandbox(toolName: string, params: any): void {
    if (toolName === 'iot_home_assistant') {
      this.validateEntityId(params.entity_id);
    }

    if (toolName === 'iot_mqtt_publish') {
      this.validateMqttBroker(params.broker);
    }
  }

  private static validateWebSandbox(toolName: string, params: any): void {
    if (toolName !== 'playwright_browser') {
      return;
    }

    const action = String(params.action || '').trim().toLowerCase();
    if (action !== 'navigate') {
      return;
    }

    const target = resolveBrowserTargetPolicy(params.url);
    if (target.filePath) {
      this.validateFileAccess(target.filePath);
    }
    if (target.scope === 'policy-allowlist' && !target.matchedAllowlist) {
      throw new Error('SandboxBlock: host Playwright sem allowlist valida.');
    }
  }

  private static validateEntityId(entityId: string): void {
    if (!entityId) {
      throw new Error('SandboxBlock: entity_id e obrigatorio para Home Assistant.');
    }

    const normalized = entityId.toLowerCase().trim();
    const isAllowed = ALLOWED_HA_ENTITY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
    if (!isAllowed) {
      throw new Error(
        `SandboxBlock: entity_id '${entityId}' nao possui prefixo permitido. `
        + `Prefixos validos: ${ALLOWED_HA_ENTITY_PREFIXES.join(', ')}`,
      );
    }
  }

  private static validateMqttBroker(broker: string | undefined): void {
    if (!broker) {
      return;
    }

    let hostname = '';
    try {
      hostname = new URL(broker).hostname;
    } catch {
      throw new Error(
        `SandboxBlock: broker MQTT '${broker}' possui URL invalida.`,
      );
    }

    if (isLocalNetworkHostname(hostname)) {
      return;
    }

    const normalized = hostname.toLowerCase();
    const isAllowedByLegacyPrefix = ALLOWED_MQTT_BROKERS.some((allowed) => normalized.startsWith(allowed));
    if (isAllowedByLegacyPrefix) {
      return;
    }

    throw new Error(
      `SandboxBlock: broker MQTT '${broker}' nao e local. `
      + 'Apenas localhost e redes privadas sao permitidos.',
    );
  }
}
