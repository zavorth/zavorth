import { ZavorthAnyoneAgentPathService } from '../src/services/ZavorthAnyoneAgentPathService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const positional = args.filter((arg) => !arg.startsWith('--'));
const command = positional[0] || 'status';

function flag(name: string): string | null {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  const prefix = `${name}=`;
  const hit = args.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function printHuman(snapshot: ReturnType<ZavorthAnyoneAgentPathService['buildSnapshot']>): void {
  console.log(snapshot.headline);
  console.log(snapshot.promise);
  console.log('');
  for (const area of snapshot.areas) {
    console.log(`[${area.id}] ${area.title} — ${area.status}`);
    console.log(`    ${area.summary}`);
    if (area.humanNext) console.log(`    next: ${area.humanNext}`);
  }
  console.log('');
  console.log('Comandos:');
  console.log(`  ${snapshot.commands.onboard}`);
  console.log(`  ${snapshot.commands.digest}`);
  console.log(`  ${snapshot.commands.undo}`);
  console.log(`  ${snapshot.commands.enableLearning}`);
}

async function main(): Promise<void> {
  const service = new ZavorthAnyoneAgentPathService({ projectRoot: process.cwd() });

  if (command === 'onboard' || command === 'setup') {
    const snapshot = service.onboard({
      language: flag('--lang') || flag('--language') || positional[1] || 'pt',
      surface: flag('--surface') || flag('--where') || positional[2] || 'desktop',
      allowLearning: !(args.includes('--no-learning') || args.includes('--learn-off')),
    });
    if (json) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }
    console.log('Pronto. Perfil pessoal + aprendizado configurados.');
    printHuman(snapshot);
    return;
  }

  if (command === 'learn-on' || command === 'learning-on') {
    const snapshot = service.enableLearning(true);
    if (json) console.log(JSON.stringify(snapshot, null, 2));
    else {
      console.log('Learning is active and records preferences and drafts with undo support.');
      printHuman(snapshot);
    }
    return;
  }

  if (command === 'learn-off' || command === 'learning-off') {
    const snapshot = service.enableLearning(false);
    if (json) console.log(JSON.stringify(snapshot, null, 2));
    else {
      console.log('Learning is in reviewed mode and does not write by itself.');
      printHuman(snapshot);
    }
    return;
  }

  if (command === 'digest' || command === 'learned' || command === 'o-que-aprendi') {
    const snapshot = service.buildSnapshot();
    if (json) {
      console.log(JSON.stringify(snapshot.learning, null, 2));
      return;
    }
    for (const line of snapshot.learning.digestLines) console.log(line);
    return;
  }

  if (command === 'undo' || command === 'desfazer' || command === 'forget') {
    const id = positional[1] || flag('--id') || '';
    const result = service.undoLearned(id);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(result.summary);
    return;
  }

  if (command === 'powers' || command === 'superpowers' || command === 'skills') {
    const snapshot = service.buildSnapshot();
    if (json) {
      console.log(JSON.stringify(snapshot.superpowers, null, 2));
      return;
    }
    for (const power of snapshot.superpowers) {
      console.log(`- ${power.title} (${power.trust})`);
      console.log(`  ${power.summary}`);
      console.log(`  Como: ${power.howToUse}`);
    }
    return;
  }

  if (command === 'reach' || command === 'canais' || command === 'where') {
    const { ZavorthHumanReachService } = await import('../src/services/ZavorthHumanReachService.js');
    const reach = new ZavorthHumanReachService({ projectRoot: process.cwd() });
    const guideArg = positional[1];
    if (guideArg && /telegram|whatsapp|desktop|web|cli|baileys/i.test(guideArg)) {
      const id = /baileys/i.test(guideArg)
        ? 'whatsapp-baileys'
        : /whatsapp/i.test(guideArg)
          ? 'whatsapp-cloud'
          : /telegram/i.test(guideArg)
            ? 'telegram'
            : /web/i.test(guideArg)
              ? 'web'
              : /cli|terminal/i.test(guideArg)
                ? 'cli'
                : 'desktop';
      const lines = reach.formatPathGuide(id as any);
      if (json) console.log(JSON.stringify({ pathId: id, lines }, null, 2));
      else lines.forEach((line) => console.log(line));
      return;
    }
    const snapshot = reach.buildSnapshot();
    if (json) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }
    snapshot.digestLines.forEach((line) => console.log(line));
    return;
  }

  const snapshot = service.buildSnapshot();
  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  printHuman(snapshot);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
