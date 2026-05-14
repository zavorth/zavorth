import { z } from 'zod';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * SystemInfoTool — Retorna métricas do sistema em tempo real.
 *
 * Responde perguntas como "Zavorth, meu PC está lento?" ou
 * "Quanta bateria eu tenho?". Combina dados do Node.js `os` module
 * com PowerShell para métricas avançadas (bateria, processos pesados).
 */
export class SystemInfoTool implements IZavorthTool {
    name = 'os_system_info';
    description = 'Verifica informações do sistema como uso de CPU, memória RAM, espaço em disco, bateria e processos mais pesados. Responde perguntas como "meu PC está lento?" ou "quanta bateria tenho?".';
    category = 'OS' as const;
    dangerLevel = 'safe' as const;
    requiresPermission = false;

    schema = z.object({
        metrics: z.array(
            z.enum(['cpu', 'memory', 'disk', 'battery', 'processes', 'uptime'])
        ).default(['cpu', 'memory'])
            .describe('Quais métricas retornar. Ex: ["cpu", "memory", "battery"]')
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

            // Gerar resumo legível para o LLM verbalizar
            const summary = this.buildHumanSummary(data);

            return {
                success: true,
                message: summary,
                data,
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Falha ao obter informações do sistema: ${error.message}`,
            };
        }
    }

    /**
     * Uso de CPU via snapshot de os.cpus() (média entre 2 leituras).
     */
    private async getCpuInfo(): Promise<Record<string, any>> {
        const cpus = os.cpus();
        const model = cpus[0]?.model || 'Desconhecido';
        const cores = cpus.length;

        // Calcular uso médio entre idle e total
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
     * Info de memória RAM via os module.
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
     * Info de disco (Windows) via PowerShell Get-PSDrive.
     */
    private async getDiskInfo(): Promise<Record<string, any>[]> {
        try {
            const { stdout } = await execAsync(
                `powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Used_GB';E={[math]::Round($_.Used/1GB,1)}}, @{N='Free_GB';E={[math]::Round($_.Free/1GB,1)}} | ConvertTo-Json"`
            );
            const drives = JSON.parse(stdout.trim());
            return Array.isArray(drives) ? drives : [drives];
        } catch {
            return [{ error: 'Não foi possível obter informação de disco.' }];
        }
    }

    /**
     * Info de bateria (Windows) via WMI.
     */
    private async getBatteryInfo(): Promise<Record<string, any>> {
        try {
            const { stdout } = await execAsync(
                `powershell -NoProfile -Command "Get-WmiObject Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json"`
            );
            const parsed = JSON.parse(stdout.trim());
            const charge = parsed.EstimatedChargeRemaining || 0;
            // BatteryStatus: 1=Discharging 2=AC/Charging 3=FullyCharged
            const statusMap: Record<number, string> = {
                1: 'descarregando',
                2: 'carregando',
                3: 'totalmente carregada',
            };
            return {
                charge_percent: charge,
                status: statusMap[parsed.BatteryStatus] || 'desconhecido',
            };
        } catch {
            return { charge_percent: null, status: 'sem bateria (desktop)' };
        }
    }

    /**
     * Top 5 processos por uso de CPU (Windows).
     */
    private async getTopProcesses(): Promise<Record<string, any>[]> {
        try {
            const { stdout } = await execAsync(
                `powershell -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, @{N='CPU_Seconds';E={[math]::Round($_.CPU,1)}}, @{N='RAM_MB';E={[math]::Round($_.WorkingSet64/1MB,0)}} | ConvertTo-Json"`
            );
            const procs = JSON.parse(stdout.trim());
            return Array.isArray(procs) ? procs : [procs];
        } catch {
            return [{ error: 'Não foi possível listar processos.' }];
        }
    }

    /**
     * Uptime do sistema.
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
     * Gera uma frase resumida que o LLM pode falar para o usuário.
     */
    private buildHumanSummary(data: Record<string, any>): string {
        const parts: string[] = [];

        if (data.cpu) {
            parts.push(`CPU em ${data.cpu.usage_percent}% (${data.cpu.model}, ${data.cpu.cores} núcleos)`);
        }
        if (data.memory) {
            parts.push(`RAM: ${data.memory.used_gb}GB de ${data.memory.total_gb}GB usados (${data.memory.usage_percent}%)`);
        }
        if (data.battery) {
            if (data.battery.charge_percent !== null) {
                parts.push(`Bateria: ${data.battery.charge_percent}% (${data.battery.status})`);
            } else {
                parts.push(`Bateria: ${data.battery.status}`);
            }
        }
        if (data.uptime) {
            parts.push(`Sistema ligado há ${data.uptime.formatted}`);
        }
        if (data.disk && Array.isArray(data.disk)) {
            for (const d of data.disk) {
                if (d.Name && d.Free_GB) {
                    parts.push(`Disco ${d.Name}: ${d.Free_GB}GB livres`);
                }
            }
        }
        if (data.processes && Array.isArray(data.processes)) {
            const top = data.processes.slice(0, 3).map((p: any) => `${p.Name} (${p.RAM_MB}MB)`).join(', ');
            parts.push(`Processos mais pesados: ${top}`);
        }

        return parts.join('. ') + '.';
    }
}
