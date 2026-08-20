import { z } from 'zod';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';
import { logger } from '../../../logger.js';
import { asErrorLike } from '../../../utils/errorLike.js';

const execFileAsync = promisify(execFile);
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'data', 'runtime', 'screenshots');

/**
 * SystemScreenshotTool captures the Windows screen for visual analysis.
 *
 * Captures the full screen or active window through native PowerShell.
 * It can return base64 for a vision-capable LLM.
 *
 * Requires permission: the user must approve through PermissionPanel before capture.
 */
export class SystemScreenshotTool implements IZavorthTool {
    name = 'os_screenshot';
    description = 'Captures a screenshot of the computer for visual analysis. It can capture the full screen or the active window. Requires user approval before execution.';
    category = 'OS' as const;
    dangerLevel = 'moderate' as const;
    requiresPermission = true;

    schema = z.object({
        mode: z.enum(['fullscreen', 'active_window']).default('fullscreen')
            .describe('Capture mode: full screen or active window'),
        savePath: z.string().optional()
            .describe('Path where the image should be saved. Defaults to the protected runtime screenshots folder.'),
        returnBase64: z.boolean().default(false)
            .describe('When true, returns the image as base64 so the LLM can analyze it with vision'),
    });

    async execute(params: {
        mode?: string;
        savePath?: string;
        returnBase64?: boolean;
    }): Promise<ToolExecutionResult> {
        try {
            const mode = params.mode || 'fullscreen';
            const outputPath = this.resolveOutputPath(params.savePath);

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

            if (!fs.existsSync(outputPath)) {
                return {
                    success: false,
                    error: 'Screenshot was captured, but the file was not found.',
                };
            }

            const result: ToolExecutionResult = {
                success: true,
                message: `Screenshot captured successfully: ${outputPath}`,
                data: { filePath: outputPath, mode },
            };

            if (params.returnBase64) {
                const fileBuffer = fs.readFileSync(outputPath);
                const base64 = fileBuffer.toString('base64');
                result.data.base64 = base64;
                result.data.mimeType = 'image/png';
                result.message += ' (base64 included for visual analysis)';
            }

            return result;
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn('[System Screenshot] filesystem operation failed', error);
    return {
                success: false,
                error: `Failed to capture screenshot: ${err.message}`,
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
            throw new Error('Screenshot path is outside the protected directory.');
        }
        return outputPath;
    }

    /**
     * PowerShell script that captures the full screen.
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
     * PowerShell script that captures only the active window.
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
