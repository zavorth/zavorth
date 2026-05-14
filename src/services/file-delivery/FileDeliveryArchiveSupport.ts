import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import type { FileDeliveryEntry } from './FileDeliveryTypes.js';
import { MAX_ZIP_FILES } from './FileDeliveryTypes.js';

export class FileDeliveryArchiveSupport {
  constructor(private readonly tmpDir: string) {}

  public async buildDirectoryArchive(entry: FileDeliveryEntry, shouldSkipAbsolutePath: (absolutePath: string, isDirectoryHint?: boolean) => boolean): Promise<string> {
    const zip = new JSZip();
    let fileCounter = 0;
    await this.addDirectoryToZip(zip, entry.absolutePath, entry.baseName, shouldSkipAbsolutePath, () => {
      fileCounter += 1;
      if (fileCounter > MAX_ZIP_FILES) {
        throw new Error(`A pasta ${entry.baseName} tem arquivos demais para compactacao rapida.`);
      }
    });

    await fs.promises.mkdir(this.tmpDir, { recursive: true });
    const archivePath = path.join(this.tmpDir, `${entry.baseName.replace(/[^\w.-]+/g, '_')}_${Date.now()}.zip`);
    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    await fs.promises.writeFile(archivePath, content);
    return archivePath;
  }

  private async addDirectoryToZip(
    zip: JSZip,
    currentDir: string,
    archivePrefix: string,
    shouldSkipAbsolutePath: (absolutePath: string, isDirectoryHint?: boolean) => boolean,
    onFile: () => void,
  ): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      if (shouldSkipAbsolutePath(absolutePath, entry.isDirectory())) {
        continue;
      }

      const archivePath = `${archivePrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await this.addDirectoryToZip(zip, absolutePath, archivePath, shouldSkipAbsolutePath, onFile);
        continue;
      }

      onFile();
      zip.file(archivePath, await fs.promises.readFile(absolutePath));
    }
  }
}
