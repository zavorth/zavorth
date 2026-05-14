import { spawn } from 'child_process';
import * as os from 'os';
import { z } from 'zod';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool';
import {
    isBlockedSystemExecutable,
    isWhitelistedSystemExecutable,
} from '../../security/WhitelistConfig';

const UNSAFE_ARGUMENT_PATTERN = /[\0\r\n"`|<>^]/;

export class SystemOpenAppTool implements IZavorthTool {
    name = 'os_open_app';
    description = 'Abre um aplicativo local permitido. Pode receber argumentos simples como uma URL ou termo de busca.';
    category = 'OS' as const;
    dangerLevel = 'moderate' as const;
    requiresPermission = true;

    schema = z.object({
        appName: z.string().min(1).max(80).describe('Nome do executavel ou app permitido (ex: brave, spotify).'),
        args: z.array(z.string().max(500)).max(8).optional().describe('Argumentos opcionais seguros, como URL ou termo de busca.'),
    });

    async execute(params: { appName: string; args?: string[] }): Promise<ToolExecutionResult> {
        const safeAppName = params.appName.trim();

        if (!safeAppName || UNSAFE_ARGUMENT_PATTERN.test(safeAppName)) {
            return {
                success: false,
                error: 'Nome de aplicativo contem caracteres nao permitidos.',
            };
        }
        if (isBlockedSystemExecutable(safeAppName) || !isWhitelistedSystemExecutable(safeAppName)) {
            return {
                success: false,
                error: `Aplicativo '${safeAppName}' bloqueado pela politica de seguranca.`,
            };
        }

        try {
            const safeArgs = this.sanitizeArgs(params.args || []);
            const platform = os.platform();
            if (platform === 'win32') {
                this.launchDetached(safeAppName, safeArgs);
            } else if (platform === 'darwin') {
                this.launchDetached('open', ['-a', safeAppName, ...safeArgs]);
            } else {
                this.launchDetached(safeAppName, safeArgs);
            }

            return {
                success: true,
                message: `Aplicativo ${safeAppName} aberto com sucesso.`,
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Falha ao abrir ${safeAppName}: ${error.message}`,
            };
        }
    }

    private sanitizeArgs(args: string[]): string[] {
        return args.map((arg) => {
            const trimmed = String(arg || '').trim();
            if (!trimmed) {
                return '';
            }
            if (UNSAFE_ARGUMENT_PATTERN.test(trimmed)) {
                throw new Error(`Argumento bloqueado por seguranca: ${trimmed}`);
            }
            return trimmed;
        }).filter(Boolean);
    }

    private launchDetached(command: string, args: string[]): void {
        const child = spawn(command, args, {
            detached: true,
            shell: false,
            stdio: 'ignore',
            windowsHide: true,
        });
        child.unref();
    }
}
