import fs from 'fs';
import path from 'path';

describe('Public Documentation Hygiene', () => {
  it('should ensure public-facing docs do not leak internal phase or release details', () => {
    const failures: string[] = [];
    const baseDocsDir = path.resolve(process.cwd(), 'docs');

    if (!fs.existsSync(baseDocsDir)) {
      return;
    }

    const FORBIDDEN_TERMS = [
      /Review path1/i,
      /21Q/,
      /21R-A/,
      /21S-A/,
      /internal tester/i,
      /dry run/i,
      /local artifact/i,
      /tmp\/internal-tester/i,
      /task\.md/i,
      /walkthrough\.md/i
    ];

    let targetDirs: string[] = [];
    const publicDir = path.join(baseDocsDir, 'public');
    const userDir = path.join(baseDocsDir, 'user');

    if (fs.existsSync(publicDir)) {
      targetDirs.push(publicDir);
    } else if (fs.existsSync(userDir)) {
      targetDirs.push(userDir);
    } else {
      targetDirs.push(baseDocsDir);
    }

    const walk = (dir: string): string[] => {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
          const dirName = path.basename(file);
          if (!['internal', 'architecture', 'security', 'roadmap', 'node_modules', 'dist', '.git'].includes(dirName)) {
            results = results.concat(walk(file));
          }
        } else {
          if (path.extname(file) === '.md') {
            results.push(file);
          }
        }
      });
      return results;
    };

    const filesToScan: string[] = [];
    targetDirs.forEach(dir => {
      filesToScan.push(...walk(dir));
    });

    const uniqueFiles = [...new Set(filesToScan)];

    for (const file of uniqueFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const pattern of FORBIDDEN_TERMS) {
          if (pattern.test(line)) {
            const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');
            failures.push(`Public-facing document "${relativePath}" contains internal keyword matching ${pattern} at line ${index + 1}: "${line.trim()}"`);
          }
        }
      });
    }

    expect(failures).toEqual([]);
  });
});
