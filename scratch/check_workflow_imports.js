import fs from 'fs';
const workflowContent = fs.readFileSync('c:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth/src/orchestrator/real-zavorth-bridge-watcher/RealZavorthBridgeWatcherWorkflow.ts', 'utf8');

// Find all type/interface imports
const importMatches = workflowContent.match(/import\s+type\s+{[^}]+}\s+from\s+['"][^'"]+['"]/g) || [];
console.log('Imports in Workflow:');
importMatches.forEach(m => console.log(m));
