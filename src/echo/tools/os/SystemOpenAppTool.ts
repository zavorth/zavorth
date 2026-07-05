import { spawn } from 'child_process';
import * as os from 'os';
import { z } from 'zod';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool';
import { logger } from '../../../logger.js';
import {
isBlockedSystemExecutable,
    isWhitelistedSystemExecutable,
} from '../../security/WhitelistConfig';

const UNSAFE_ARGUMENT_PATTERN = /[\0\r\n"`|<>^]/;

export class SystemOpenAppTool implements IZavorthTool {
    name = 'os_open_app';
    description = 'Opens an allowed local application. Can receive simple arguments such as a URL or search term.';
    category = 'OS' as const;
    dangerLevel = 'moderate' as const;
    requiresPermission = true;

    schema = z.object({
        appName: z.string().min(1).max(80).describe('Allowed executable or app name, for example brave or spotify.'),
        args: z.array(z.string().max(500)).max(8).optional().describe('Optional safe arguments, such as a URL or search term.'),
    });

    async execute(params: { appName: string; args?: string[] }): Promise<ToolExecutionResult> {
        const safeAppName = params.appName.trim();

        if (!safeAppName || UNSAFE_ARGUMENT_PATTERN.test(safeAppName)) {
            return {
                success: false,
                error: 'Application name contains disallowed characters.',
            };
        }
        if (isBlockedSystemExecutable(safeAppName) || !isWhitelistedSystemExecutable(safeAppName)) {
            return {
                success: false,
                error: `Application '${safeAppName}' blocked by security policy.`,
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
                message: `Application ${safeAppName} opened successfully.`,
            };
        } catch (error) {
    logger.warn('[System Open App] operation failed', error);
    return {
                success: false,
                error: `Failed to open ${safeAppName}: ${error.message}`,
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
                throw new Error(`Argument blocked by security: ${trimmed}`);
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
