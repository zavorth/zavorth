#!/usr/bin/env node
/**
 * Regex hygiene lint: detects fragile sentinel patterns (`...`) in regex literals only.
 * Per clean-code skill: regex must be strictly typed, well-bounded, and backed by tests.
 * Per AGENTS.md: fragile regex is prohibited. This script only flags actual regex literals.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXTS = ['.ts', '.mjs'];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    // Only check regex literals (between /.../), not spread syntax
    const regexMatches = line.matchAll(/\/(?:[^\/\\]|\\.)*?\.\.\.(?:[^\/\\]|\\.)*?\//g);
    for (const match of regexMatches) {
      if (match.index !== undefined) {
        issues.push({
          file: filePath,
          line: lineNum,
          snippet: match[0].slice(0, 120),
          reason: 'corrupted-quantifier-sentinel-in-regex',
        });
      }
    }
  }
  return issues;
}

function findFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('node_modules') && entry.name !== 'dist') {
      results.push(...findFiles(full));
    } else if (entry.isFile() && EXTS.some((e) => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const files = findFiles('src');
let totalIssues = 0;
for (const file of files) {
  const issues = scanFile(file);
  if (issues.length > 0) {
    console.log(`FAIL: ${path.relative(ROOT, file)}`);
    for (const issue of issues) {
      console.log(`  line ${issue.line}: ${issue.reason} -> ${issue.snippet}`);
      totalIssues++;
    }
  }
}

if (totalIssues === 0) {
  console.log('PASS: No regex sentinel corruption detected in regex literals.');
  process.exit(0);
} else {
  console.log(`FAIL: ${totalIssues} regex hygiene issue(s) found in regex literals.`);
  process.exit(1);
}