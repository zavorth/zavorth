import { runAutoRepairCli } from './cli/AutoRepairCli.js';

void runAutoRepairCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(`Falha no CLI de autoreparo: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
