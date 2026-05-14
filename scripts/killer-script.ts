import { execSync } from 'child_process';

try {
    const output = execSync('powershell.exe -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, CommandLine | ConvertTo-Json"').toString();
    const processes = JSON.parse(output);
    
    for (const proc of processes) {
        if (proc.CommandLine && (proc.CommandLine.includes('Zavorth') || proc.CommandLine.includes('nodemon')) && !proc.CommandLine.includes('killer-script')) {
            console.log(`Killing process ${proc.ProcessId}: ${proc.CommandLine}`);
            try {
                execSync(`taskkill /F /PID ${proc.ProcessId}`);
            } catch (e) {}
        }
    }
} catch (e) {
    console.error('Error during cleanup:', e.message);
}
