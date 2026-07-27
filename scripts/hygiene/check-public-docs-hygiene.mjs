import fs from 'fs';
import path from 'path';

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

export function verifyPublicDocsHygiene() {
  const failures = [];
  const baseDocsDir = path.resolve(process.cwd(), 'docs');

  if (!fs.existsSync(baseDocsDir)) {
    return failures;
  }

  // Determine target directories
  let targetDirs = [];
  const publicDir = path.join(baseDocsDir, 'public');
  const userDir = path.join(baseDocsDir, 'user');

  if (fs.existsSync(publicDir)) {
    targetDirs.push(publicDir);
  } else if (fs.existsSync(userDir)) {
    targetDirs.push(userDir);
  } else {
    // Closest public-doc equivalent: docs/ and docs/product/ excluding internal/architecture/security/roadmap
    targetDirs.push(baseDocsDir);
  }

  const walk = (dir) => {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      file = path.join(dir, file);
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        const dirName = path.basename(file);
        // Exclude internal directories
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

  const filesToScan = [];
  targetDirs.forEach(dir => {
    filesToScan.push(...walk(dir));
  });

  // Remove duplicates
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

  return failures;
}

// If run directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) {
  const failures = verifyPublicDocsHygiene();
  if (failures.length > 0) {
    console.error('Public Docs Hygiene Check FAILED:');
    failures.forEach(f => console.error(` ? ${f}`));
    process.exit(1);
  } else {
    console.log('Public Docs Hygiene Check PASSED: no internal phase details leaked in public docs.');
  }
}
