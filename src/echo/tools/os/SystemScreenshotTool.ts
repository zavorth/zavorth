import { z } from 'zod';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'data', 'runtime', 'screenshots');

/**
 * SystemScreenshotTool — Captura a tela do Windows para análise visual (Vision).
 *
 * Tira print da tela completa ou janela ativa usando PowerShell nativo
 * (sem dependências externas). Pode retornar base64 para o LLM com Vision
 * analisar o conteúdo visual.
 *
 * REQUER PERMISSÃO: o usuário deve aprovar via PermissionPanel antes da captura.
 */
export class SystemScreenshotTool implements IZavorthTool {
    name = 'os_screenshot';
    description = 'Tira um print da tela do computador para análise visual. Pode capturar a tela completa ou a janela ativa. Requer aprovação do usuário antes de executar.';
    category = 'OS' as const;
    dangerLevel = 'moderate' as const;
    requiresPermission = true;

    schema = z.object({
        mode: z.enum(['fullscreen', 'active_window']).default('fullscreen')
            .describe('Modo de captura: tela completa ou janela ativa'),
        savePath: z.string().optional()
            .describe('Caminho para salvar a imagem (padrão: pasta temp do sistema)'),
        returnBase64: z.boolean().default(false)
            .describe('Se true, retorna a imagem em base64 para o LLM analisar via Vision'),
    });

    async execute(params: {
        mode?: string;
        savePath?: string;
        returnBase64?: boolean;
    }): Promise<ToolExecutionResult> {
        try {
            const mode = params.mode || 'fullscreen';
            const outputPath = this.resolveOutputPath(params.savePath);

            // PowerShell script para captura de tela (sem deps externas)
            const psScript = mode === 'active_window'
                ? this.buildActiveWindowScript(outputPath)
                : this.buildFullscreenScript(outputPath);

            await execFileAsync('powershell', [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                psScript,
            ], {
                windowsHide: true,
                timeout: 15000,
                maxBuffer: 1024 * 1024,
            });

            // Verifica se o arquivo foi criado
            if (!fs.existsSync(outputPath)) {
                return {
                    success: false,
                    error: 'Screenshot capturado mas o arquivo não foi encontrado.',
                };
            }

            const result: ToolExecutionResult = {
                success: true,
                message: `Screenshot capturado com sucesso: ${outputPath}`,
                data: { filePath: outputPath, mode },
            };

            // Se solicitado, retorna base64 para Vision
            if (params.returnBase64) {
                const fileBuffer = fs.readFileSync(outputPath);
                const base64 = fileBuffer.toString('base64');
                result.data.base64 = base64;
                result.data.mimeType = 'image/png';
                result.message += ' (base64 incluído para análise visual)';
            }

            return result;

        } catch (error: any) {
            return {
                success: false,
                error: `Falha ao capturar screenshot: ${error.message}`,
            };
        }
    }

    private resolveOutputPath(savePath?: string): string {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        const requested = String(savePath || '').trim();
        const fileName = requested
            ? path.basename(requested)
            : `zavorth_screenshot_${Date.now()}_${crypto.randomUUID()}.png`;
        const normalized = fileName.toLowerCase().endsWith('.png') ? fileName : `${fileName}.png`;
        const outputPath = path.resolve(SCREENSHOT_DIR, normalized);
        if (!outputPath.startsWith(`${SCREENSHOT_DIR}${path.sep}`)) {
            throw new Error('Caminho de screenshot fora do diretorio protegido.');
        }
        return outputPath;
    }

    /**
     * Script PowerShell para capturar a tela completa.
     */
    private buildFullscreenScript(outputPath: string): string {
        return `
            Add-Type -AssemblyName System.Windows.Forms;
            Add-Type -AssemblyName System.Drawing;
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen;
            $bounds = $screen.Bounds;
            $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height);
            $g = [System.Drawing.Graphics]::FromImage($bmp);
            $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
            $bmp.Save('${outputPath.replace(/\\/g, '\\\\')}');
            $g.Dispose();
            $bmp.Dispose();
        `.replace(/\n/g, ' ');
    }

    /**
     * Script PowerShell para capturar apenas a janela ativa.
     */
    private buildActiveWindowScript(outputPath: string): string {
        return `
            Add-Type -AssemblyName System.Windows.Forms;
            Add-Type -AssemblyName System.Drawing;
            Add-Type @'
                using System;
                using System.Runtime.InteropServices;
                public class Win32 {
                    [DllImport("user32.dll")]
                    public static extern IntPtr GetForegroundWindow();
                    [DllImport("user32.dll")]
                    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
                    [StructLayout(LayoutKind.Sequential)]
                    public struct RECT { public int Left, Top, Right, Bottom; }
                }
'@;
            $hwnd = [Win32]::GetForegroundWindow();
            $rect = New-Object Win32+RECT;
            [Win32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null;
            $w = $rect.Right - $rect.Left;
            $h = $rect.Bottom - $rect.Top;
            $bmp = New-Object System.Drawing.Bitmap($w, $h);
            $g = [System.Drawing.Graphics]::FromImage($bmp);
            $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)));
            $bmp.Save('${outputPath.replace(/\\/g, '\\\\')}');
            $g.Dispose();
            $bmp.Dispose();
        `.replace(/\n/g, ' ');
    }
}
