import { execSync } from 'child_process';
import { asErrorLike } from '../src/utils/errorLike';

try {
    const output = execSync('powershell.exe -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, CommandLine | ConvertTo-Json"').toString();
    const processes = JSON.parse(output);
    
    for (const proc of processes) {
        if (proc.CommandLine && (proc.CommandLine.includes('Zavorth') || proc.CommandLine.includes('nodemon')) && !proc.CommandLine.includes('killer-script')) {
            console.log(`Killing process ${proc.ProcessId}: ${proc.CommandLine}`);
            try {
                execSync(`taskkill /F /PID ${proc.ProcessId}`);
            } catch (error: unknown) {}
        }
    }
} catch (error: unknown) { const err = asErrorLike(error); const e = err; console.error('Error during cleanup:', e.message);
}
