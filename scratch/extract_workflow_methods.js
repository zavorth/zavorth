import fs from 'fs';
const content = fs.readFileSync('c:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth/src/orchestrator/real-zavorth-bridge-watcher/RealZavorthBridgeWatcherWorkflow.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('async ') || line.includes('public ') || line.includes('private ')) {
    if (line.trim().startsWith('public ') || line.trim().startsWith('private ')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  }
});
