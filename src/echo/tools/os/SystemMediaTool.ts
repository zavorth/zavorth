import { z } from 'zod';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../../logger.js';

const execAsync = promisify(exec);

/**
 * SystemMediaTool controls Windows media playback and volume through nircmd.
 *
 * Supports play/pause, next/previous, volume up/down/set, and mute.
 * Uses nircmd.exe for reliability, with a PowerShell SendKeys fallback.
 */
export class SystemMediaTool implements IZavorthTool {
    name = 'os_media_control';
    description = 'Controls system media playback and volume: pause, next track, previous track, stop, volume, and mute. Useful for requests like pausing music or increasing volume.';
    category = 'OS' as const;
    dangerLevel = 'safe' as const;
    requiresPermission = false;

    schema = z.object({
        action: z.enum([
            'play_pause', 'next', 'previous', 'stop',
            'volume_up', 'volume_down', 'volume_set', 'mute'
        ]).describe('Media action to execute'),
        value: z.number().min(0).max(100).optional()
            .describe('Volume from 0 to 100. Used only with volume_set.')
    });

    async execute(params: { action: string; value?: number }): Promise<ToolExecutionResult> {
        try {
            const hasNircmd = await this.checkNircmd();

            if (hasNircmd) {
                return await this.executeViaNircmd(params);
            }
            return await this.executeViaPowerShell(params);

        } catch (error) {
    logger.warn('[System Media] process execution failed', error);
    return {
                success: false,
                error: `Failed to control media: ${error.message}`,
            };
  }
    }

    /**
     * Executes through nircmd.exe, the preferred and more reliable method.
     */
    private async executeViaNircmd(params: { action: string; value?: number }): Promise<ToolExecutionResult> {
        let command = '';
        let description = '';

        switch (params.action) {
            case 'play_pause':
                command = 'nircmd.exe sendkeypress 0xB3';
                description = 'Play/pause toggled.';
                break;
            case 'next':
                command = 'nircmd.exe sendkeypress 0xB0';
                description = 'Skipped to next track.';
                break;
            case 'previous':
                command = 'nircmd.exe sendkeypress 0xB1';
                description = 'Returned to previous track.';
                break;
            case 'stop':
                command = 'nircmd.exe sendkeypress 0xB2';
                description = 'Media stopped.';
                break;
            case 'volume_up':
                command = 'nircmd.exe changesysvolume 6553';
                description = 'Volume increased by about 10%.';
                break;
            case 'volume_down':
                command = 'nircmd.exe changesysvolume -6553';
                description = 'Volume reduced by about 10%.';
                break;
            case 'volume_set':
                const nircmdVolume = Math.round((params.value || 50) / 100 * 65535);
                command = `nircmd.exe setsysvolume ${nircmdVolume}`;
                description = `Volume set to ${params.value || 50}%.`;
                break;
            case 'mute':
                command = 'nircmd.exe mutesysvolume 2';
                description = 'Mute toggled.';
                break;
            default:
                return { success: false, error: `Unknown action: ${params.action}` };
        }

        await execAsync(command);
        return { success: true, message: description };
    }

    /**
     * Fallback through PowerShell SendKeys. Less reliable, but does not require nircmd.
     */
    private async executeViaPowerShell(params: { action: string; value?: number }): Promise<ToolExecutionResult> {
        let psScript = '';
        let description = '';

        switch (params.action) {
            case 'play_pause':
                psScript = `
                    Add-Type -AssemblyName System.Windows.Forms
                    [System.Windows.Forms.SendKeys]::SendWait("{MEDIA_PLAY_PAUSE}")
                `;
                description = 'Play/pause toggled through SendKeys.';
                break;
            case 'next':
                psScript = `
                    Add-Type -AssemblyName System.Windows.Forms
                    [System.Windows.Forms.SendKeys]::SendWait("{MEDIA_NEXT_TRACK}")
                `;
                description = 'Skipped to next track through SendKeys.';
                break;
            case 'previous':
                psScript = `
                    Add-Type -AssemblyName System.Windows.Forms
                    [System.Windows.Forms.SendKeys]::SendWait("{MEDIA_PREV_TRACK}")
                `;
                description = 'Returned to previous track through SendKeys.';
                break;
            case 'stop':
                psScript = `
                    Add-Type -AssemblyName System.Windows.Forms
                    [System.Windows.Forms.SendKeys]::SendWait("{MEDIA_STOP}")
                `;
                description = 'Media stopped through SendKeys.';
                break;
            case 'volume_up':
            case 'volume_down':
            case 'volume_set':
            case 'mute':
                const volumeScript = params.action === 'mute'
                    ? `$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys([char]173)`
                    : params.action === 'volume_up'
                    ? `$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys([char]175)`
                    : params.action === 'volume_down'
                    ? `$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys([char]174)`
                    : `# volume_set is not supported without nircmd. Install nircmd.exe for precise volume control.`;
                psScript = volumeScript;
                description = params.action === 'volume_set'
                    ? 'volume_set requires nircmd.exe. Use volume_up or volume_down as an alternative.'
                    : `${params.action} executed through PowerShell.`;
                break;
            default:
                return { success: false, error: `Unknown action: ${params.action}` };
        }

        await execAsync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
        return { success: true, message: description };
    }

    /**
     * Checks whether nircmd.exe is available in PATH.
     */
    private async checkNircmd(): Promise<boolean> {
        try {
            await execAsync('where nircmd.exe');
            return true;
        } catch (error) { logger.warn('[System Media] process execution failed', error); return false; }
    }
}
