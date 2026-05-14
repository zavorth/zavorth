import fs from 'fs';
import path from 'path';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { FileManager } from './FileManager.js';

export class BackupManager {
  
  public static createBackup(workspace: string, targetPath: string, taskId: string): void {
    const resolvedWorkspace = WorkspaceResolver.validate(workspace);
    const safePath = WorkspaceResolver.ensurePathInsideWorkspace(resolvedWorkspace, targetPath);
    
    // Se o arquivo não existe (será uma criação nova), o "backup" é anotar a deleção para o rollback.
    let content = null;
    if (fs.existsSync(safePath)) {
      content = FileManager.readSafe(workspace, targetPath);
    }

    const backupDir = path.join(resolvedWorkspace, '.zavorth', 'backups', taskId);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Usamos base64 para o nome do arquivo para evitar conflitos de caminhos no backup
    const safeName = Buffer.from(targetPath).toString('base64');
    const backupFile = path.join(backupDir, safeName + '.json');

    const backupData = {
      original_path: targetPath,
      existed_before: content !== null,
      content: content
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  }
}
