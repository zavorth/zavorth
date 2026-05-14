import { z } from 'zod';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * SystemMediaTool — Controla mídia e volume do Windows via nircmd.
 *
 * Suporta play/pause, next/previous, volume up/down/set/mute.
 * Usa nircmd.exe para confiabilidade (sem dependência de foco de janela).
 * Fallback para PowerShell SendKeys caso nircmd não esteja instalado.
 */
export class SystemMediaTool implements IZavorthTool {
    name = 'os_media_control';
    description = 'Controla a reprodução de mídia e volume do sistema (pausar, próxima faixa, volume, mute). Útil para comandos como "pause a música" ou "aumenta o volume".';
    category = 'OS' as const;
    dangerLevel = 'safe' as const;
    requiresPermission = false;

    schema = z.object({
        action: z.enum([
            'play_pause', 'next', 'previous', 'stop',
            'volume_up', 'volume_down', 'volume_set', 'mute'
        ]).describe('Ação de mídia a executar'),
        value: z.number().min(0).max(100).optional()
            .describe('Volume de 0 a 100 (usado apenas com volume_set)')
    });

    async execute(params: { action: string; value?: number }): Promise<ToolExecutionResult> {
        try {
            const hasNircmd = await this.checkNircmd();

            if (hasNircmd) {
                return await this.executeViaNircmd(params);
            }
            return await this.executeViaPowerShell(params);

        } catch (error: any) {
            return {
                success: false,
                error: `Falha no controle de mídia: ${error.message}`,
            };
        }
    }

    /**
     * Executa via nircmd.exe (método preferido — mais confiável).
     */
    private async executeViaNircmd(params: { action: string; value?: number }): Promise<ToolExecutionResult> {
        let command = '';
        let description = '';

        switch (params.action) {
            case 'play_pause':
                command = 'nircmd.exe sendkeypress 0xB3'; // VK_MEDIA_PLAY_PAUSE
                description = 'Play/Pause alternado.';
                break;
            case 'next':
                command = 'nircmd.exe sendkeypress 0xB0'; // VK_MEDIA_NEXT_TRACK
                description = 'Próxima faixa.';
                break;
            case 'previous':
                command = 'nircmd.exe sendkeypress 0xB1'; // VK_MEDIA_PREV_TRACK
                description = 'Faixa anterior.';
                break;
            case 'stop':
                command = 'nircmd.exe sendkeypress 0xB2'; // VK_MEDIA_STOP
                description = 'Mídia parada.';
                break;
            case 'volume_up':
                command = 'nircmd.exe changesysvolume 6553'; // ~10%
                description = 'Volume aumentado em ~10%.';
                break;
            case 'volume_down':
                command = 'nircmd.exe changesysvolume -6553'; // ~10%
                description = 'Volume reduzido em ~10%.';
                break;
            case 'volume_set':
                const nircmdVolume = Math.round((params.value || 50) / 100 * 65535);
                command = `nircmd.exe setsysvolume ${nircmdVolume}`;
                description = `Volume definido para ${params.value || 50}%.`;
                break;
            case 'mute':
                command = 'nircmd.exe mutesysvolume 2'; // 2 = toggle
                description = 'Mute alternado.';
                break;
            default:
                return { success: false, error: `Ação desconhecida: ${params.action}` };
        }

        await execAsync(command);
        return { success: true, message: description };
    }

    /**
     * Fallback: executa via PowerShell SendKeys (menos confiável mas não requer nircmd).
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
                description = 'Play/Pause alternado (via SendKeys).';
                break;
            case 'next':
                psScript = `
                    Add-Type -AssemblyName System.Windows.Forms
                    [System.Windows.Forms.SendKeys]::SendWait("{MEDIA_NEXT_TRACK}")
                `;
                description = 'Próxima faixa (via SendKeys).';
                break;
            case 'previous':
                psScript = `
                    Add-Type -AssemblyName System.Windows.Forms
                    [System.Windows.Forms.SendKeys]::SendWait("{MEDIA_PREV_TRACK}")
                `;
                description = 'Faixa anterior (via SendKeys).';
                break;
            case 'stop':
                psScript = `
                    Add-Type -AssemblyName System.Windows.Forms
                    [System.Windows.Forms.SendKeys]::SendWait("{MEDIA_STOP}")
                `;
                description = 'Mídia parada (via SendKeys).';
                break;
            case 'volume_up':
            case 'volume_down':
            case 'volume_set':
            case 'mute':
                // Volume via PowerShell nativo (COM Object)
                const volumeScript = params.action === 'mute'
                    ? `$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys([char]173)`
                    : params.action === 'volume_up'
                    ? `$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys([char]175)`
                    : params.action === 'volume_down'
                    ? `$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys([char]174)`
                    : `# volume_set não suportado sem nircmd. Instale nircmd.exe para controle preciso.`;
                psScript = volumeScript;
                description = params.action === 'volume_set'
                    ? 'Volume set requer nircmd.exe. Use volume_up/volume_down como alternativa.'
                    : `${params.action} executado via PowerShell.`;
                break;
            default:
                return { success: false, error: `Ação desconhecida: ${params.action}` };
        }

        await execAsync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
        return { success: true, message: description };
    }

    /**
     * Verifica se nircmd.exe está disponível no PATH.
     */
    private async checkNircmd(): Promise<boolean> {
        try {
            await execAsync('where nircmd.exe');
            return true;
        } catch {
            return false;
        }
    }
}
