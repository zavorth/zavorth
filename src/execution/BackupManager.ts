import fs from 'fs';
import path from 'path';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { FileManager } from './FileManager.js';

export class BackupManager {

  public static createBackup(workspace: string, targetPath: string, taskId: string): void {
    const resolvedWorkspace = WorkspaceResolver.validate(workspace);
    const safePath = WorkspaceResolver.ensurePathInsideWorkspace(resolvedWorkspace, targetPath);

    // If the file does not exist, the rollback backup is a delete marker for the new file.
    let content = null;
    if (fs.existsSync(safePath)) {
      content = FileManager.readSafe(workspace, targetPath);
    }

    const backupDir = path.join(resolvedWorkspace, '.zavorth', 'backups', taskId);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Use base64 for the filename to avoid path conflicts in the backup folder.
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
