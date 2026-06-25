import fs from 'fs';
const content = fs.readFileSync('c:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth/src/services/distributed-runtime/ZavorthDistributedRuntimeSnapshotBuilder.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes(': any') || line.includes('any[]')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
