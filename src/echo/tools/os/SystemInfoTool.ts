import { z } from 'zod';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { logger } from '../../../logger.js';
import { asErrorLike } from '../../../utils/errorLike.js';

const execAsync = promisify(exec);

/**
 * SystemInfoTool returns real-time system metrics.
 *
 * Answers questions such as whether the PC is slow or how much battery remains.
 * Combines Node.js `os` data with PowerShell for advanced Windows metrics.
 */
export class SystemInfoTool implements IZavorthTool {
    name = 'os_system_info';
    description = 'Checks system information such as CPU usage, RAM usage, disk space, battery, uptime, and heaviest processes.';
    category = 'OS' as const;
    dangerLevel = 'safe' as const;
    requiresPermission = false;

    schema = z.object({
        metrics: z.array(
            z.enum(['cpu', 'memory', 'disk', 'battery', 'processes', 'uptime'])
        ).default(['cpu', 'memory'])
            .describe('Metrics to return, for example ["cpu", "memory", "battery"].')
    });

    async execute(params: { metrics: string[] }): Promise<ToolExecutionResult> {
        try {
            const data: Record<string, any> = {};

            for (const metric of params.metrics) {
                switch (metric) {
                    case 'cpu':
                        data.cpu = await this.getCpuInfo();
                        break;
                    case 'memory':
                        data.memory = this.getMemoryInfo();
                        break;
                    case 'disk':
                        data.disk = await this.getDiskInfo();
                        break;
                    case 'battery':
                        data.battery = await this.getBatteryInfo();
                        break;
                    case 'processes':
                        data.processes = await this.getTopProcesses();
                        break;
                    case 'uptime':
                        data.uptime = this.getUptimeInfo();
                        break;
                }
            }

            const summary = this.buildHumanSummary(data);

            return {
                success: true,
                message: summary,
                data,
            };
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn('[System Info] creation failed', error);
    return {
                success: false,
                error: `Failed to get system information: ${err.message}`,
            };
  }
    }

    /**
     * CPU usage through an os.cpus() snapshot.
     */
    private async getCpuInfo(): Promise<Record<string, any>> {
        const cpus = os.cpus();
        const model = cpus[0]?.model || 'Unknown';
        const cores = cpus.length;

        const usage = cpus.map(cpu => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return ((total - idle) / total) * 100;
        });
        const avgUsage = Math.round(usage.reduce((a, b) => a + b, 0) / usage.length);

        return {
            model: model.trim(),
            cores,
            usage_percent: avgUsage,
        };
    }

    /**
     * RAM information through the Node.js os module.
     */
    private getMemoryInfo(): Record<string, any> {
        const totalBytes = os.totalmem();
        const freeBytes = os.freemem();
        const usedBytes = totalBytes - freeBytes;
        const usedPercent = Math.round((usedBytes / totalBytes) * 100);

        return {
            total_gb: (totalBytes / 1073741824).toFixed(1),
            used_gb: (usedBytes / 1073741824).toFixed(1),
            free_gb: (freeBytes / 1073741824).toFixed(1),
            usage_percent: usedPercent,
        };
    }

    /**
     * Windows disk information through PowerShell Get-PSDrive.
     */
    private async getDiskInfo(): Promise<Record<string, any>[]> {
        try {
            const { stdout } = await execAsync(
                `powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Used_GB';E={[math]::Round($_.Used/1GB,1)}}, @{N='Free_GB';E={[math]::Round($_.Free/1GB,1)}} | ConvertTo-Json"`
            );
            const drives = JSON.parse(stdout.trim());
            return Array.isArray(drives) ? drives : [drives];
        } catch (error: unknown) {logger.warn('[System Info] JSON parse failed', error);
    return [{ error: 'Could not get disk information.' }];
  }
    }

    /**
     * Windows battery information through WMI.
     */
    private async getBatteryInfo(): Promise<Record<string, any>> {
        try {
            const { stdout } = await execAsync(
                `powershell -NoProfile -Command "Get-WmiObject Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json"`
            );
            const parsed = JSON.parse(stdout.trim());
            const charge = parsed.EstimatedChargeRemaining || 0;
            const statusMap: Record<number, string> = {
                1: 'discharging',
                2: 'charging',
                3: 'fully charged',
            };
            return {
                charge_percent: charge,
                status: statusMap[parsed.BatteryStatus] || 'unknown',
            };
        } catch (error: unknown) {logger.warn('[System Info] parsing failed', error);
    return { charge_percent: null, status: 'no battery detected' };
  }
    }

    /**
     * Top 5 processes by CPU usage on Windows.
     */
    private async getTopProcesses(): Promise<Record<string, any>[]> {
        try {
            const { stdout } = await execAsync(
                `powershell -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, @{N='CPU_Seconds';E={[math]::Round($_.CPU,1)}}, @{N='RAM_MB';E={[math]::Round($_.WorkingSet64/1MB,0)}} | ConvertTo-Json"`
            );
            const procs = JSON.parse(stdout.trim());
            return Array.isArray(procs) ? procs : [procs];
        } catch (error: unknown) {logger.warn('[System Info] JSON parse failed', error);
    return [{ error: 'Could not list processes.' }];
  }
    }

    /**
     * System uptime.
     */
    private getUptimeInfo(): Record<string, any> {
        const uptimeSeconds = os.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        return {
            total_seconds: uptimeSeconds,
            formatted: `${hours}h ${minutes}min`,
        };
    }

    /**
     * Builds a concise sentence that the LLM can say to the user.
     */
    private buildHumanSummary(data: Record<string, any>): string {
        const parts: string[] = [];

        if (data.cpu) {
            parts.push(`CPU at ${data.cpu.usage_percent}% (${data.cpu.model}, ${data.cpu.cores} cores)`);
        }
        if (data.memory) {
            parts.push(`RAM: ${data.memory.used_gb}GB of ${data.memory.total_gb}GB used (${data.memory.usage_percent}%)`);
        }
        if (data.battery) {
            if (data.battery.charge_percent !== null) {
                parts.push(`Battery: ${data.battery.charge_percent}% (${data.battery.status})`);
            } else {
                parts.push(`Battery: ${data.battery.status}`);
            }
        }
        if (data.uptime) {
            parts.push(`System uptime: ${data.uptime.formatted}`);
        }
        if (data.disk && Array.isArray(data.disk)) {
            for (const d of data.disk) {
                if (d.Name && d.Free_GB) {
                    parts.push(`Disk ${d.Name}: ${d.Free_GB}GB free`);
                }
            }
        }
        if (data.processes && Array.isArray(data.processes)) {
            const top = data.processes.slice(0, 3).map((p: any) => `${p.Name} (${p.RAM_MB}MB)`).join(', ');
            parts.push(`Heaviest processes: ${top}`);
        }

        return parts.join('. ') + '.';
    }
}
